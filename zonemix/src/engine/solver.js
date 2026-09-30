import { dbToPower, powerToDb, clamp } from './units.js';

/**
 * Picks bus gains so every auto zone hears its target program level at its
 * own sensor, counting the sound that leaks in from neighbouring zones.
 *
 * With p = 10^(gain/10), the program power at a sensor is a weighted sum of
 * the zones' p values, so meeting all targets at once is a bounded linear
 * least-squares problem. Each error is taken relative to its target, so a
 * quiet foyer counts as much as a loud dance floor. Projected coordinate
 * descent solves it exactly enough for the dozen or so zones a venue has.
 *
 * @param {object} args
 * @param {Array<{id: string, sensorId?: string, auto: boolean, targetDb?: number,
 *   gainDb?: number, minDb: number, maxDb: number}>} args.zones
 *   Auto zones are solved for; the others stay at their gainDb.
 * @param {(sensorId: string, zoneId: string) => number} args.pathDb
 *   Program level at the sensor for 0 dB gain on the zone's bus.
 * @returns {Record<string, number>} bus gain per zone, dB
 */
export function solveZoneGains({ zones, pathDb, sweeps = 200 }) {
  const autoZones = zones.filter((z) => z.auto);
  const fixedZones = zones.filter((z) => !z.auto);

  // One row per auto zone: what its sensor hears, relative to its target.
  const rows = autoZones.map((z) => {
    const target = dbToPower(z.targetDb);
    const coef = (zoneId) => dbToPower(pathDb(z.sensorId, zoneId)) / target;
    return {
      fixed: fixedZones.reduce((sum, f) => sum + coef(f.id) * dbToPower(f.gainDb), 0),
      a: autoZones.map((j) => coef(j.id)),
    };
  });
  const lo = autoZones.map((z) => dbToPower(z.minDb));
  const hi = autoZones.map((z) => dbToPower(z.maxDb));

  // Start from each zone meeting its own target alone.
  const p = autoZones.map((_, j) => {
    const own = rows[j].a[j];
    return own > 0 ? clamp((1 - rows[j].fixed) / own, lo[j], hi[j]) : lo[j];
  });

  for (let sweep = 0; sweep < sweeps; sweep++) {
    let changeDb = 0;
    for (let j = 0; j < p.length; j++) {
      let num = 0;
      let den = 0;
      for (const row of rows) {
        const aj = row.a[j];
        if (aj === 0) continue;
        let rest = row.fixed;
        for (let k = 0; k < p.length; k++) if (k !== j) rest += row.a[k] * p[k];
        num += aj * (1 - rest);
        den += aj * aj;
      }
      const next = den > 0 ? clamp(num / den, lo[j], hi[j]) : lo[j];
      changeDb = Math.max(changeDb, Math.abs(powerToDb(next) - powerToDb(p[j])));
      p[j] = next;
    }
    if (changeDb < 1e-4) break;
  }

  const gains = {};
  for (const f of fixedZones) gains[f.id] = f.gainDb;
  autoZones.forEach((z, j) => {
    gains[z.id] = powerToDb(p[j]);
  });
  return gains;
}

/** Program level a sensor would hear with the given bus gains. */
export function predictDb({ sensorId, zones, pathDb, gainsDb }) {
  let power = 0;
  for (const z of zones) power += dbToPower(pathDb(sensorId, z.id) + gainsDb[z.id]);
  return powerToDb(power);
}
