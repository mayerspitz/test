import { dbToPower, powerToDb, clamp, smoothing } from './units.js';

/**
 * Learns, for one sensor, how the room differs from its calibration.
 *
 * Each block (about a second) it gets q, the program power the calibration
 * predicts at the sensor from what the mixer is sending, and m, the power the
 * sensor measured. It fits m ≈ a·q + n over a sliding window:
 *   a  drift: the room now passes more or less sound than at calibration
 *      (a full room absorbs sound, a door opened, a speaker was bumped);
 *   n  ambient noise: crowd, bar, kitchen.
 * Music has loud and quiet moments and gaps between songs, while the crowd
 * stays roughly steady; that contrast is what separates the two.
 *
 * Noise far under the program cannot be measured (it changes the reading
 * by a fraction of a dB), so the noise estimate only moves when the fit pins
 * it down; in practice that is during quiet passages and the gaps between
 * songs, as with the "gap" ambient-noise compensators of installed sound
 * systems. Otherwise it holds its last value.
 */
export class SensorEstimator {
  constructor(options = {}) {
    this.opts = {
      windowBlocks: 60,
      minBlocks: 10,
      driftLimitDb: 12,
      driftTauS: 30,
      noiseTauS: 10,
      noiseFloorDb: 30,
      initialNoiseDb: 45,
      // Drift is only learned when the program is at least this share of
      // what the sensor hears; below that the crowd drowns it out.
      minProgramShare: 0.25,
      ...options,
    };
    this.samples = [];
    this.driftDb = 0;
    this.noiseDb = this.opts.initialNoiseDb;
    this.mismatch = false;
  }

  push(q, m, blockS = 1) {
    if (!(m > 0) || !(q >= 0)) return;
    this.samples.push([q, m]);
    if (this.samples.length > this.opts.windowBlocks) this.samples.shift();
    if (this.samples.length < this.opts.minBlocks) return;
    const fit = this.#fit();
    this.driftDb += (fit.driftDb - this.driftDb) * smoothing(blockS, this.opts.driftTauS);
    this.noiseDb += (fit.noiseDb - this.noiseDb) * smoothing(blockS, this.opts.noiseTauS);
  }

  #fit() {
    const { driftLimitDb, noiseFloorDb, minProgramShare } = this.opts;
    const count = this.samples.length;
    let sumQ = 0;
    let sumM = 0;
    for (const [q, m] of this.samples) {
      sumQ += q;
      sumM += m;
    }
    const scale = sumM / count;

    // Errors relative to m: minimise Σ (1 − a·r − b·u)², r = q/m, u = scale/m.
    let rr = 0, ru = 0, uu = 0, r1 = 0, u1 = 0;
    for (const [q, m] of this.samples) {
      const r = q / m;
      const u = scale / m;
      rr += r * r;
      ru += r * u;
      uu += u * u;
      r1 += r;
      u1 += u;
    }

    const floor = dbToPower(noiseFloorDb) / scale;
    const prevA = dbToPower(this.driftDb);
    const prevB = dbToPower(this.noiseDb) / scale;
    const det = rr * uu - ru * ru;

    let a = prevA;
    let b = null; // null: hold the noise estimate
    if ((prevA * sumQ) / sumM < minProgramShare) {
      b = (u1 - a * ru) / uu; // the crowd is most of what the sensor hears
    } else {
      if (det > 0.02 * rr * uu) {
        const fitA = (r1 * uu - u1 * ru) / det;
        const fitB = (rr * u1 - ru * r1) / det;
        // Keep the noise only if the fit pins it down to within about ±2 dB.
        let sse = 0;
        for (const [q, m] of this.samples) sse += (1 - (fitA * q) / m - (fitB * scale) / m) ** 2;
        const seB = Math.sqrt(((sse / Math.max(1, count - 2)) * rr) / det);
        if (fitB >= floor && seB < 0.5 * fitB) {
          a = fitA;
          b = fitB;
        }
      }
      if (b === null) a = (r1 - prevB * ru) / rr; // drift only; noise held
    }

    let driftDb = a > 0 ? powerToDb(a) : -Infinity;
    this.mismatch = !(Math.abs(driftDb) < driftLimitDb);
    driftDb = clamp(driftDb, -driftLimitDb, driftLimitDb);
    if (b !== null && driftDb !== powerToDb(a)) b = (u1 - dbToPower(driftDb) * ru) / uu;
    return { driftDb, noiseDb: b === null ? this.noiseDb : powerToDb(Math.max(b, floor) * scale) };
  }
}
