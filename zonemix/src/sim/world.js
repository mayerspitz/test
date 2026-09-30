import { OFF, dbToPower, powerToDb, slew } from '../engine/units.js';

// A pretend venue for trying the engine without hardware. It makes program
// material for each source group, mixes it the way the mixer would with the
// sends and bus gains the engine chose, and "measures" it at every sensor
// through the room's true coupling, plus crowd noise, sensor jitter, lost
// packets and a little latency.

export function makeRandom(seed = 1) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.gauss = () => Math.sqrt(-2 * Math.log(1 - next())) * Math.cos(2 * Math.PI * next());
  return next;
}

const SILENT_DBFS = -80;

/** Level of music relative to its nominal: songs, sections, gaps between songs. */
class MusicEnvelope {
  constructor(rand) {
    this.rand = rand;
    this.newSong();
  }

  newSong() {
    this.songLeftS = 150 + this.rand() * 90;
    this.songDb = (this.rand() - 0.5) * 6;
    this.sectionLeftS = 0;
  }

  next(dt) {
    this.songLeftS -= dt;
    if (this.songLeftS <= -2.5) this.newSong(); // 2.5 s between songs
    if (this.songLeftS <= 0) return OFF;
    this.sectionLeftS -= dt;
    if (this.sectionLeftS <= 0) {
      this.sectionLeftS = 12 + this.rand() * 20;
      this.sectionDb = (this.rand() - 0.5) * 6;
    }
    return this.songDb + this.sectionDb + this.rand.gauss() * 1.5;
  }
}

/** Talk-spurts and pauses. */
class SpeechEnvelope {
  constructor(rand) {
    this.rand = rand;
    this.on = false;
    this.leftS = 0;
  }

  next(dt) {
    this.leftS -= dt;
    if (this.leftS <= 0) {
      this.on = !this.on;
      this.leftS = (this.on ? 1.2 : 0.35) * -Math.log(1 - this.rand());
    }
    return this.on ? this.rand.gauss() * 2 : OFF;
  }
}

export class VenueWorld {
  constructor(venue, { seed = 1, couplingDb = venue.coupling, jitterDb = 0.5, packetLoss = 0.02, latencyTicks = 2 } = {}) {
    this.venue = venue;
    this.rand = makeRandom(seed);
    this.couplingDb = couplingDb;
    this.jitterDb = jitterDb;
    this.packetLoss = packetLoss;
    this.latencyTicks = latencyTicks;
    const speech = new Set(venue.control.speech.groups);
    this.envelopes = Object.fromEntries(
      venue.groups.map((g) => [g, speech.has(g) ? new SpeechEnvelope(this.rand) : new MusicEnvelope(this.rand)]),
    );
    this.speechGroups = speech;
    this.playing = new Set();
    this.noiseDb = {};
    this.noiseTargetDb = {};
    this.absorptionDb = 0;
    this.musicOffsetDb = 0; // the band creeping louder as the night goes on
    this.offline = new Set();
    this.inFlight = [];
    this.truth = {};
  }

  setPlaying(groups) {
    this.playing = new Set(groups);
  }

  /** Crowd noise per sensor, dB(A); it drifts toward new values at 0.3 dB/s. */
  setNoise(targets) {
    for (const [id, db] of Object.entries(targets)) {
      this.noiseTargetDb[id] = db;
      this.noiseDb[id] ??= db;
    }
  }

  /** Channel levels (dBFS) for the next tick. */
  sources(dt) {
    const env = {};
    for (const g of this.venue.groups) env[g] = this.playing.has(g) ? this.envelopes[g].next(dt) : OFF;
    const firstOfGroup = new Set();
    const out = {};
    for (const ch of this.venue.channels) {
      // Only one person talks at a time: the group's first mic.
      const muted = this.speechGroups.has(ch.group) && firstOfGroup.has(ch.group);
      firstOfGroup.add(ch.group);
      const e = env[ch.group];
      const offset = this.speechGroups.has(ch.group) ? 0 : this.musicOffsetDb;
      out[ch.id] = e === OFF || muted ? SILENT_DBFS + this.rand.gauss() : ch.nominalDbfs + e + offset;
    }
    return out;
  }

  /** Sensor readings for this tick, given what is on the mixer. */
  measure(channelDb, sendsDb, gainsDb, dt) {
    const busOut = {};
    for (const z of this.venue.zones) {
      let p = 0;
      for (const ch of this.venue.channels) p += dbToPower(channelDb[ch.id] + sendsDb[ch.id][z.id]);
      busOut[z.id] = p * dbToPower(gainsDb[z.id]);
    }
    const now = {};
    for (const z of this.venue.zones) {
      const id = z.sensorId;
      if (!id) continue;
      this.noiseDb[id] = slew(this.noiseDb[id] ?? 40, this.noiseTargetDb[id] ?? 40, 0.3 * dt, 0.3 * dt);
      let program = 0;
      for (const src of this.venue.zones) {
        program += busOut[src.id] * dbToPower((this.couplingDb[id]?.[src.id] ?? OFF) - this.absorptionDb);
      }
      const noise = dbToPower(this.noiseDb[id] + this.rand.gauss());
      this.truth[id] = { programDb: powerToDb(program), noiseDb: this.noiseDb[id], totalDb: powerToDb(program + noise) };
      if (!this.offline.has(id) && this.rand() >= this.packetLoss) {
        now[id] = powerToDb(program + noise) + this.rand.gauss() * this.jitterDb;
      }
    }
    // Sound and network take a moment to arrive.
    this.inFlight.push(now);
    return this.inFlight.length > this.latencyTicks ? this.inFlight.shift() : {};
  }
}
