import { OFF, dbToPower, powerToDb, clamp, slew, smoothing, isNum } from './units.js';
import { solveZoneGains, predictDb } from './solver.js';
import { SensorEstimator } from './estimator.js';
import { RollingLeq } from './leq.js';

const OFF_BELOW_DB = -90; // sends and gains at or below this are switched off
const FADE_FLOOR_DB = -60; // "off" fades in from, and out to, this level
const SEND_STEP_DB = 0.1; // smallest send change worth sending to the mixer
const MIN_TARGET_DB = 30; // a target is never pushed below this

function lerpDb(from, to, x) {
  if (x >= 1) return to;
  if (x <= 0) return from;
  if (from === OFF && to === OFF) return OFF;
  const a = from === OFF ? FADE_FLOOR_DB : from;
  const b = to === OFF ? FADE_FLOOR_DB : to;
  return a + (b - a) * x;
}

const differs = (a, b, step) => (a === OFF) !== (b === OFF) || (a !== OFF && Math.abs(a - b) >= step);

/**
 * The automatic mixer. Call tick() every control period with the latest
 * channel meters (dBFS, post-fader) and sensor readings (dB(A)); it returns
 * the zone bus gains and channel-to-zone sends to put on the mixer, which of
 * them changed, and a status for the operator's screen.
 *
 * It is plain computation with no timers, sockets or clocks, so the
 * simulator and the tests drive exactly the code that runs at an event.
 */
export class ZoneMixEngine {
  constructor(venue, { scene = venue.initialScene, adaptive = true } = {}) {
    if (!venue.scenes[scene]) throw new Error(`Unknown scene "${scene}".`);
    this.venue = venue;
    this.control = venue.control;
    this.t = null;
    this.sceneName = scene;
    this.fadeFrom = null;
    this.fadeStart = -Infinity;
    this.fadeS = 0;
    this.speechUntil = -Infinity;
    this.blockStart = null;
    this.lastSendsDb = null;
    this.chRef = new Map(venue.channels.map((ch) => [ch.id, dbToPower(ch.nominalDbfs)]));
    this.lastActive = new Map();
    this.groupChannels = new Map(venue.groups.map((g) => [g, venue.channels.filter((ch) => ch.group === g)]));
    const c = this.control;
    this.zones = new Map(
      venue.zones.map((zone) => [
        zone.id,
        {
          zone,
          gainDb: null, // controller gain, before any safety cut
          appliedDb: null, // what is on the mixer now
          prevAppliedDb: null,
          safetyCutDb: 0,
          duckDb: 0,
          estimator:
            zone.sensorId && adaptive
              ? new SensorEstimator({ windowBlocks: Math.round(c.estimatorWindowS / c.blockS), driftLimitDb: c.driftLimitDb })
              : null,
          leq: zone.leqLimit ? new RollingLeq(zone.leqLimit.windowMin * 60, c.blockS) : null,
          lastSensorT: null,
          online: true,
          fastPower: null, // ~1 s average of the sensor, for the limiter
          slowPower: null, // ~10 s average, for display
          delayLine: [],
          block: { q: 0, m: 0, n: 0 },
          targetDb: null,
          ambientBoostDb: 0,
          budgetLimited: false,
          cannotReach: false,
          spillFrom: null, // neighbour making this zone too loud on its own
          overFrom: null, // neighbour mostly to blame for going over the limit
        },
      ]),
    );
    this.sent = { gains: new Map(), sends: new Map() };
  }

  get sceneNames() {
    return Object.keys(this.venue.scenes);
  }

  /** Switches scene, fading from wherever the current fade has got to. */
  setScene(name, t = this.t) {
    if (!this.venue.scenes[name]) {
      throw new Error(`Unknown scene "${name}". Known scenes: ${this.sceneNames.join(', ')}.`);
    }
    if (t === null) {
      this.sceneName = name;
      return;
    }
    this.fadeFrom = this.#sceneValues(t);
    this.sceneName = name;
    this.fadeStart = t;
    this.fadeS = this.venue.scenes[name].fadeS;
  }

  #sceneValues(t) {
    const target = this.venue.scenes[this.sceneName].zones;
    const x = this.fadeFrom && this.fadeS > 0 ? clamp((t - this.fadeStart) / this.fadeS, 0, 1) : 1;
    if (x >= 1) return target;
    const out = {};
    for (const [id, to] of Object.entries(target)) {
      const from = this.fadeFrom[id];
      const mix = {};
      for (const g of Object.keys(to.mix)) mix[g] = lerpDb(from.mix[g], to.mix[g], x);
      out[id] = { level: lerpDb(from.level, to.level, x), mix };
    }
    return out;
  }

  tick({ t, channelDb = {}, sensors = {} }) {
    const c = this.control;
    const { channels, zones, coupling } = this.venue;
    const dt = this.t === null ? c.tickMs / 1000 : Math.max(0, t - this.t);
    this.t = t;
    this.blockStart ??= t;
    const scene = this.#sceneValues(t);
    const fading = t < this.fadeStart + this.fadeS + c.blockS;
    const states = [...this.zones.values()];

    // Speech priority: any speech mic above threshold ducks music where configured.
    const speechGroups = c.speech.groups;
    if (channels.some((ch) => speechGroups.includes(ch.group) && (channelDb[ch.id] ?? OFF) > c.speech.thresholdDbfs)) {
      this.speechUntil = t + c.speech.holdS;
    }
    const speechActive = t < this.speechUntil;
    for (const s of states) {
      const duck = s.zone.duck;
      if (!duck) continue;
      const rate = duck.depthDb * dt;
      s.duckDb = slew(s.duckDb, speechActive ? duck.depthDb : 0, rate / duck.attackS, rate / duck.releaseS);
    }

    // Sends: the scene's level for the channel's group, plus the channel trim,
    // minus any ducking. "Nominal" leaves the ducking out.
    const nominalSend = {};
    const sendsDb = {};
    for (const ch of channels) {
      nominalSend[ch.id] = {};
      sendsDb[ch.id] = {};
      for (const s of states) {
        const id = s.zone.id;
        const mixDb = scene[id].mix[ch.group];
        const nominal = mixDb === OFF ? OFF : Math.min(10, mixDb + ch.trimDb);
        const ducked = s.zone.duck?.groups.includes(ch.group) ? nominal - s.duckDb : nominal;
        nominalSend[ch.id][id] = nominal <= OFF_BELOW_DB ? OFF : nominal;
        sendsDb[ch.id][id] = ducked <= OFF_BELOW_DB ? OFF : ducked;
      }
    }

    // Typical level of each channel while it plays; gaps and silence don't count.
    for (const ch of channels) {
      const db = channelDb[ch.id];
      if (isNum(db) && db > c.activeThresholdDbfs) {
        const ref = this.chRef.get(ch.id);
        this.chRef.set(ch.id, ref + (dbToPower(db) - ref) * smoothing(dt, c.programWindowS));
        this.lastActive.set(ch.id, t);
      }
    }

    // Program on each zone bus before its fader: typical (to choose gains)
    // and right now with the sends actually on the mixer (to check the model
    // against the sensors).
    const onMixer = this.lastSendsDb ?? sendsDb;
    const progRefDb = {};
    const progNowDb = {};
    for (const z of zones) {
      let now = 0;
      for (const ch of channels) {
        const db = channelDb[ch.id];
        if (isNum(db)) now += dbToPower(db + onMixer[ch.id][z.id]);
      }
      progRefDb[z.id] = this.#referenceDb(z.id, nominalSend, t);
      progNowDb[z.id] = powerToDb(now);
    }

    this.#readSensors(t, dt, sensors, progNowDb, states);
    if (t - this.blockStart >= c.blockS - dt / 2) {
      this.#closeBlock(states, progNowDb);
      this.blockStart = t;
    }

    // Model of the room: program level at a sensor for 0 dB on a zone's bus.
    const driftDb = {};
    for (const s of states) {
      if (s.zone.sensorId) driftDb[s.zone.sensorId] = this.#driftOf(s);
    }
    const pathDb = (sensorId, zoneId) => progRefDb[zoneId] + (coupling[sensorId]?.[zoneId] ?? OFF) + (driftDb[sensorId] ?? 0);

    const desired = this.#desiredGains(states, scene, pathDb);

    for (const s of states) {
      const { zone } = s;
      const want = desired[zone.id];
      if (s.gainDb === null || zone.mode === 'manual') {
        s.gainDb = want;
      } else {
        const up = (fading ? Math.max(c.maxUpDbPerS, c.sceneSlewDbPerS) : c.maxUpDbPerS) * dt;
        const down = (fading ? Math.max(c.maxDownDbPerS, c.sceneSlewDbPerS) : c.maxDownDbPerS) * dt;
        s.gainDb = slew(s.gainDb, want, up, down);
      }
      if (zone.mode !== 'manual') this.#limit(s, dt, pathDb);
      const applied = s.gainDb - s.safetyCutDb;
      s.prevAppliedDb = s.appliedDb;
      s.appliedDb = applied <= OFF_BELOW_DB ? OFF : applied;
    }

    const gainsDb = Object.fromEntries(states.map((s) => [s.zone.id, s.appliedDb]));
    this.lastSendsDb = sendsDb;
    return {
      t,
      scene: this.sceneName,
      fading,
      speechActive,
      gainsDb,
      sendsDb,
      changes: this.#changes(states, sendsDb),
      zones: states.map((s) => this.#status(s, scene)),
      alarms: this.#alarms(t, states),
    };
  }

  /**
   * The program level a zone's target refers to: its main content at its
   * typical level. That is the loudest source group in the zone's mix, or the
   * sum of the groups actually playing if that is more. So a quiet
   * background group playing alone is not pushed up to the target, and a
   * mic nobody is using does not count.
   *
   * Within a group, only channels heard recently count (all of them if the
   * group is silent, as a guess for when it starts). In speech groups one
   * person talks at a time, so the loudest mic stands for the group.
   */
  #referenceDb(zoneId, nominalSend, t) {
    const hold = this.control.activeHoldS;
    const speechGroups = this.control.speech.groups;
    let playingSum = 0;
    let loudest = 0;
    for (const [group, members] of this.groupChannels) {
      const playing = members.filter((ch) => t - (this.lastActive.get(ch.id) ?? -Infinity) <= hold);
      const counted = playing.length ? playing : members;
      const levels = counted.map((ch) => this.chRef.get(ch.id) * dbToPower(nominalSend[ch.id][zoneId]));
      const level = speechGroups.includes(group) ? Math.max(0, ...levels) : levels.reduce((s, p) => s + p, 0);
      if (playing.length) playingSum += level;
      loudest = Math.max(loudest, level);
    }
    return powerToDb(Math.max(playingSum, loudest));
  }

  #readSensors(t, dt, sensors, progNowDb, states) {
    const latencyTicks = Math.round(this.control.sensorLatencyMs / this.control.tickMs);
    for (const s of states) {
      const sensorId = s.zone.sensorId;
      if (!sensorId) continue;
      s.lastSensorT ??= t; // grace period at start-up
      // What the sensor should be hearing now: the mixer's output a moment ago.
      s.delayLine.push(this.#rawProgramPower(sensorId, progNowDb));
      if (s.delayLine.length > latencyTicks + 1) s.delayLine.shift();
      const q = s.delayLine.length > latencyTicks ? s.delayLine[0] : null;
      const reading = sensors[sensorId];
      if (isNum(reading)) {
        s.lastSensorT = t;
        const m = dbToPower(reading);
        s.fastPower = s.fastPower === null ? m : s.fastPower + (m - s.fastPower) * smoothing(dt, 1);
        s.slowPower = s.slowPower === null ? m : s.slowPower + (m - s.slowPower) * smoothing(dt, 10);
        if (q !== null) {
          s.block.q += q;
          s.block.m += m;
          s.block.n += 1;
        }
      }
      s.online = t - s.lastSensorT <= this.control.sensorOfflineS;
    }
  }

  // Program power the calibration predicts at a sensor for the gains on the
  // mixer, before drift. Null until every zone has a gain.
  #rawProgramPower(sensorId, progDb) {
    let power = 0;
    for (const s of this.zones.values()) {
      if (s.appliedDb === null) return null;
      power += dbToPower(progDb[s.zone.id] + s.appliedDb + (this.venue.coupling[sensorId]?.[s.zone.id] ?? OFF));
    }
    return power;
  }

  #closeBlock(states, progNowDb) {
    for (const s of states) {
      const { block } = s;
      if (block.n > 0) {
        const m = block.m / block.n;
        s.estimator?.push(block.q / block.n, m, this.control.blockS);
        s.leq?.push(powerToDb(m));
      } else if (s.leq && s.zone.sensorId) {
        // Sensor silent: keep the compliance log going on the model.
        const q = this.#rawProgramPower(s.zone.sensorId, progNowDb);
        if (q !== null) s.leq.push(powerToDb(q * dbToPower(this.#driftOf(s)) + dbToPower(this.#noiseOf(s))));
      }
      s.block = { q: 0, m: 0, n: 0 };
    }
  }

  #driftOf(s) {
    const d = this.control.driftCompensationDb;
    return s.estimator ? clamp(s.estimator.driftDb, -d, d) : 0;
  }

  #noiseOf(s) {
    return s.estimator ? s.estimator.noiseDb : OFF;
  }

  // Highest program level the zone's Leq limit allows for the next minute.
  #allowedProgramDb(s) {
    const limit = s.zone.leqLimit;
    if (!limit || !s.leq) return Infinity;
    const total = dbToPower(s.leq.allowedDb(limit.maxDb, this.control.budgetLookaheadS));
    return powerToDb(Math.max(0, total - dbToPower(this.#noiseOf(s))));
  }

  #desiredGains(states, scene, pathDb) {
    const c = this.control;
    const solverZones = [];
    for (const s of states) {
      const { zone } = s;
      const level = scene[zone.id].level;
      s.ambientBoostDb = 0;
      s.budgetLimited = false;
      if (zone.mode !== 'auto') {
        s.targetDb = null;
        solverZones.push({ id: zone.id, auto: false, gainDb: level });
        continue;
      }
      let target = level;
      const noise = this.#noiseOf(s);
      if (zone.ambient && noise !== OFF) {
        s.ambientBoostDb = clamp(zone.ambient.slope * (noise - zone.ambient.thresholdDb), 0, zone.ambient.maxBoostDb);
        target += s.ambientBoostDb;
      }
      const allowed = this.#allowedProgramDb(s);
      if (target > allowed) {
        target = allowed;
        s.budgetLimited = true;
      }
      target = Math.max(MIN_TARGET_DB, Math.min(target, zone.maxLaeq1sDb - c.limitHeadroomDb));
      s.targetDb = target;
      solverZones.push({
        id: zone.id,
        sensorId: zone.sensorId,
        auto: true,
        targetDb: target,
        minDb: zone.gainMinDb,
        maxDb: zone.gainMaxDb,
      });
    }

    const desired = solveZoneGains({ zones: solverZones, pathDb });

    for (const s of states) {
      const { zone } = s;
      s.cannotReach = false;
      s.spillFrom = null;
      if (zone.mode === 'manual') continue;
      const predicted = predictDb({ sensorId: zone.sensorId, zones: solverZones, pathDb, gainsDb: desired });
      if (zone.mode === 'limit-only') {
        // The operator's level stands unless it would break the zone's limits.
        const ceiling = Math.min(this.#allowedProgramDb(s), zone.maxLaeq1sDb - c.limitHeadroomDb);
        if (predicted > ceiling) {
          desired[zone.id] -= predicted - ceiling;
          s.budgetLimited = ceiling < zone.maxLaeq1sDb - c.limitHeadroomDb;
        }
        desired[zone.id] = clamp(desired[zone.id], zone.gainMinDb, zone.gainMaxDb);
      } else {
        s.cannotReach = desired[zone.id] >= zone.gainMaxDb - 0.01 && predicted < s.targetDb - 2;
        s.spillFrom =
          desired[zone.id] <= zone.gainMinDb + 0.01 && predicted > s.targetDb + 2
            ? this.#loudestNeighbour(zone, pathDb, desired)
            : null;
      }
    }
    return desired;
  }

  // The other zone that contributes most at this zone's sensor.
  #loudestNeighbour(zone, pathDb, gainsDb) {
    let best = null;
    let bestDb = -Infinity;
    for (const other of this.venue.zones) {
      if (other === zone) continue;
      const db = pathDb(zone.sensorId, other.id) + gainsDb[other.id];
      if (db > bestDb) {
        best = other;
        bestDb = db;
      }
    }
    return best;
  }

  // Safety limiter: acts on what the sensor measures (or, with the sensor
  // offline, on the model), independently of the targets. It stops cutting
  // once the zone's own speakers are 10 dB under the sound arriving from
  // other zones: turning them down further would not help.
  #limit(s, dt, pathDb) {
    const c = this.control;
    const { zone } = s;
    s.overFrom = null;
    if (!zone.sensorId || [...this.zones.values()].some((o) => o.appliedDb === null)) return;
    const gains = Object.fromEntries([...this.zones.values()].map((o) => [o.zone.id, o.appliedDb]));
    gains[zone.id] = s.gainDb - s.safetyCutDb;
    const program = predictDb({ sensorId: zone.sensorId, zones: this.venue.zones, pathDb, gainsDb: gains });
    const ownDb = pathDb(zone.sensorId, zone.id) + gains[zone.id];
    const levelDb =
      s.online && s.fastPower !== null ? powerToDb(s.fastPower) : powerToDb(dbToPower(program) + dbToPower(this.#noiseOf(s)));
    if (levelDb > zone.maxLaeq1sDb) {
      const othersDb = powerToDb(dbToPower(program) - dbToPower(ownDb));
      if (ownDb > othersDb - 10) {
        s.safetyCutDb = Math.min(c.maxSafetyCutDb, s.safetyCutDb + c.safetyDownDbPerS * dt);
      }
      if (ownDb < othersDb) s.overFrom = this.#loudestNeighbour(zone, pathDb, gains);
    } else if (levelDb < zone.maxLaeq1sDb - c.safetyReleaseMarginDb) {
      s.safetyCutDb = Math.max(0, s.safetyCutDb - c.maxUpDbPerS * dt);
    }
  }

  #changes(states, sendsDb) {
    const changes = [];
    for (const s of states) {
      const { zone } = s;
      const db = s.appliedDb;
      const last = this.sent.gains.get(zone.id);
      const settled = s.prevAppliedDb !== null && !differs(db, s.prevAppliedDb, 1e-6);
      if (last === undefined || differs(db, last, this.control.deadbandDb) || (settled && differs(db, last, 0.05))) {
        changes.push({ type: 'bus', zoneId: zone.id, bus: zone.bus, db });
        this.sent.gains.set(zone.id, db);
      }
    }
    for (const ch of this.venue.channels) {
      for (const s of states) {
        const { zone } = s;
        const key = `${ch.id}>${zone.id}`;
        const db = sendsDb[ch.id][zone.id];
        const last = this.sent.sends.get(key);
        if (last === undefined || differs(db, last, SEND_STEP_DB)) {
          changes.push({ type: 'send', channelId: ch.id, mixerChannel: ch.mixerChannel, zoneId: zone.id, bus: zone.bus, db });
          this.sent.sends.set(key, db);
        }
      }
    }
    return changes;
  }

  #status(s, scene) {
    const { zone } = s;
    const noiseDb = this.#noiseOf(s);
    return {
      id: zone.id,
      name: zone.name,
      mode: zone.mode,
      sceneLevelDb: scene[zone.id].level,
      targetDb: s.targetDb,
      gainDb: s.appliedDb,
      measuredDb: s.fastPower === null ? null : powerToDb(s.fastPower),
      programDb: s.slowPower === null ? null : powerToDb(s.slowPower - dbToPower(noiseDb)),
      noiseDb: noiseDb === OFF ? null : noiseDb,
      driftDb: s.estimator?.driftDb ?? null,
      ambientBoostDb: s.ambientBoostDb,
      duckDb: s.duckDb,
      safetyCutDb: s.safetyCutDb,
      leqDb: s.leq ? s.leq.leqDb() : null,
      budgetLimited: s.budgetLimited,
      sensorOnline: zone.sensorId ? s.online : null,
    };
  }

  #alarms(t, states) {
    const alarms = [];
    const add = (zone, code, message) => alarms.push({ zoneId: zone.id, code, message });
    for (const s of states) {
      const { zone } = s;
      const f1 = (x) => x.toFixed(1);
      if (zone.sensorId && !s.online) {
        add(zone, 'sensor-offline', `${zone.name}: sensor ${zone.sensorId} has sent nothing for ${Math.round(t - s.lastSensorT)} s. ` +
          'The zone is running on its room model; check the sensor\'s power and network.');
      }
      if (s.overFrom) {
        add(zone, 'over-limit', `${zone.name} is above its ${zone.maxLaeq1sDb} dB(A) limit, mostly from ${s.overFrom.name}. ` +
          `Its own speakers are${s.safetyCutDb > 0.5 ? ` turned down ${f1(s.safetyCutDb)} dB and` : ''} not the main source; ` +
          `turn down ${s.overFrom.name} to fix it.`);
      } else if (s.safetyCutDb > 0.5) {
        add(zone, 'over-limit', `${zone.name} went above its ${zone.maxLaeq1sDb} dB(A) limit and has been turned down ${f1(s.safetyCutDb)} dB.`);
      } else if (zone.mode === 'manual' && s.fastPower !== null && powerToDb(s.fastPower) > zone.maxLaeq1sDb) {
        add(zone, 'over-limit', `${zone.name} is at ${f1(powerToDb(s.fastPower))} dB(A), above its ${zone.maxLaeq1sDb} dB(A) limit. ` +
          'It is a manual zone, so ZoneMix is not turning it down.');
      }
      if (s.budgetLimited) {
        add(zone, 'leq-budget', `${zone.name} is close to its ${zone.leqLimit.windowMin}-minute limit of ${zone.leqLimit.maxDb} dB(A) ` +
          'and is being held back to stay under it.');
      }
      if (s.cannotReach) {
        add(zone, 'cannot-reach-target', `${zone.name} can't reach ${f1(s.targetDb)} dB(A) even with its bus at maximum. ` +
          'Add or re-aim speakers there, raise its maximum gain, or lower the target.');
      }
      if (s.spillFrom) {
        add(zone, 'spill', `${zone.name} is louder than its ${f1(s.targetDb)} dB(A) target from sound arriving from ${s.spillFrom.name}, ` +
          `with its own speakers already at minimum. Turn down ${s.spillFrom.name} or accept the higher level here.`);
      }
      if (s.estimator?.mismatch) {
        const louder = s.estimator.driftDb > 0;
        add(zone, 'model-mismatch', `${zone.name} sounds more than ${this.control.driftLimitDb} dB ${louder ? 'louder' : 'quieter'} than at calibration. ` +
          `${louder ? 'Another sound system may be playing there, or the sensor moved.' : 'A speaker may be off or unplugged, or the sensor moved.'} ` +
          'Check it, then recalibrate.');
      }
    }
    return alarms;
  }
}
