import { ZoneMixEngine } from '../engine/engine.js';
import { dbToPower, powerToDb } from '../engine/units.js';
import { VenueWorld } from './world.js';

// A wedding evening for the example venue, squeezed into 24 minutes. The
// room fills (absorbing 2 dB), the crowd gets louder, speeches interrupt the
// music, the band creeps 7 dB louder during the dance set, and the bar's
// sensor drops off the network for a minute.
export const weddingEvening = {
  name: 'Wedding evening (24 minutes)',
  durationS: 24 * 60,
  timeline: [
    {
      at: 0,
      scene: 'reception',
      playing: ['playback'],
      noiseDb: { 's-dance': 58, 's-dining-l': 55, 's-dining-r': 55, 's-bar': 62, 's-foyer': 60 },
    },
    {
      at: 240,
      scene: 'dinner',
      playing: ['band', 'vocals'],
      noiseDb: { 's-dance': 60, 's-dining-l': 62, 's-dining-r': 63, 's-bar': 66, 's-foyer': 58 },
    },
    {
      at: 600,
      scene: 'speeches',
      playing: ['speech', 'playback'],
      noiseDb: { 's-dance': 50, 's-dining-l': 50, 's-dining-r': 50, 's-bar': 55, 's-foyer': 52 },
    },
    {
      at: 780,
      scene: 'dance',
      playing: ['band', 'vocals'],
      noiseDb: { 's-dance': 80, 's-dining-l': 66, 's-dining-r': 67, 's-bar': 72, 's-foyer': 62 },
    },
  ],
  absorptionDb: (t) => Math.min(2, (t / 600) * 2),
  musicOffsetDb: (t) => Math.min(7, Math.max(0, ((t - 840) / 480) * 7)),
  dropouts: [{ sensorId: 's-bar', from: 1000, to: 1060 }],
};

/**
 * Runs the engine against the simulated venue. Returns one record per second
 * with the true (simulated) levels next to what the engine did, plus a summary.
 */
export function runScenario(venue, scenario, { seed = 1, adaptive = true, settleS = 60 } = {}) {
  const engine = new ZoneMixEngine(venue, { scene: scenario.timeline[0].scene, adaptive });
  const world = new VenueWorld(venue, { seed });
  const dt = venue.control.tickMs / 1000;
  const ticks = Math.round(scenario.durationS / dt);
  const perSecond = Math.round(1 / dt);
  const records = [];
  let next = 0;
  let out = null;
  let sceneStart = 0;
  let acc = null;

  for (let i = 0; i < ticks; i++) {
    const t = i * dt;
    while (next < scenario.timeline.length && scenario.timeline[next].at <= t + 1e-9) {
      const ev = scenario.timeline[next++];
      if (ev.scene && i > 0) engine.setScene(ev.scene, t);
      if (ev.scene) sceneStart = t;
      if (ev.playing) world.setPlaying(ev.playing);
      if (ev.noiseDb) world.setNoise(ev.noiseDb);
    }
    world.absorptionDb = scenario.absorptionDb?.(t) ?? 0;
    world.musicOffsetDb = scenario.musicOffsetDb?.(t) ?? 0;
    world.offline = new Set((scenario.dropouts ?? []).filter((d) => t >= d.from && t < d.to).map((d) => d.sensorId));

    const channelDb = world.sources(dt);
    const sensors = out ? world.measure(channelDb, out.sendsDb, out.gainsDb, dt) : {};
    out = engine.tick({ t, channelDb, sensors });

    acc ??= Object.fromEntries(venue.zones.map((z) => [z.id, { program: 0, total: 0 }]));
    for (const z of venue.zones) {
      const truth = world.truth[z.sensorId];
      if (!truth) continue;
      acc[z.id].program += dbToPower(truth.programDb);
      acc[z.id].total += dbToPower(truth.totalDb);
    }
    if ((i + 1) % perSecond === 0) {
      const zones = {};
      for (const s of out.zones) {
        const a = acc[s.id];
        const truth = world.truth[venue.zones.find((z) => z.id === s.id).sensorId];
        zones[s.id] = {
          ...s,
          trueProgramDb: powerToDb(a.program / perSecond),
          trueTotalDb: powerToDb(a.total / perSecond),
          trueNoiseDb: truth?.noiseDb ?? null,
        };
      }
      records.push({
        t: t + dt,
        scene: out.scene,
        sinceSceneS: t + dt - sceneStart,
        speechActive: out.speechActive,
        absorptionDb: world.absorptionDb,
        zones,
        alarms: out.alarms.map((a) => `${a.zoneId}:${a.code}`),
      });
      acc = null;
    }
  }
  return { records, summary: summarize(venue, records, settleS) };
}

/**
 * Per zone: how closely auto zones held their targets in music scenes
 * (60-second Leq of the true program against the target, after each scene
 * has settled), the loudest true second against the limit, and alarms seen.
 */
export function summarize(venue, records, settleS = 60) {
  const summary = {};
  for (const zone of venue.zones) {
    const errors = [];
    let window = [];
    let maxDb = -Infinity;
    const alarms = new Set();
    for (const r of records) {
      const z = r.zones[zone.id];
      if (Number.isFinite(z.trueTotalDb)) maxDb = Math.max(maxDb, z.trueTotalDb);
      for (const a of r.alarms) if (a.startsWith(`${zone.id}:`)) alarms.add(a.split(':')[1]);
      const steady = zone.mode === 'auto' && r.sinceSceneS >= settleS && !r.speechActive && r.scene !== 'speeches';
      if (!steady) {
        window = [];
        continue;
      }
      window.push(z);
      if (window.length === 60) {
        const leq = powerToDb(window.reduce((s, w) => s + dbToPower(w.trueProgramDb), 0) / 60);
        const target = window.reduce((s, w) => s + w.targetDb, 0) / 60;
        errors.push(leq - target);
        window = window.slice(10); // windows every 10 s
      }
    }
    // Worst rolling Leq over the zone's limit window, from the true levels.
    let maxLeqDb = null;
    if (zone.leqLimit) {
      const n = zone.leqLimit.windowMin * 60;
      let sum = 0;
      const powers = records.map((r) => dbToPower(r.zones[zone.id].trueTotalDb));
      powers.forEach((p, i) => {
        sum += p - (i >= n ? powers[i - n] : 0);
        if (i >= n - 1) maxLeqDb = Math.max(maxLeqDb ?? -Infinity, powerToDb(sum / n));
      });
    }
    const abs = errors.map(Math.abs).sort((a, b) => a - b);
    summary[zone.id] = {
      mode: zone.mode,
      windows: errors.length,
      meanAbsErrorDb: abs.length ? round1(abs.reduce((s, e) => s + e, 0) / abs.length) : null,
      p90AbsErrorDb: abs.length ? round1(abs[Math.floor(abs.length * 0.9)] ?? abs.at(-1)) : null,
      maxTrueLevelDb: round1(maxDb),
      limitDb: zone.maxLaeq1sDb,
      maxLeqDb: maxLeqDb === null ? null : round1(maxLeqDb),
      leqLimitDb: zone.leqLimit?.maxDb ?? null,
      alarms: [...alarms],
    };
  }
  return summary;
}

const round1 = (x) => Math.round(x * 10) / 10;
