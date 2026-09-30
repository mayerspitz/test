import { OFF, dbToPower, powerToDb } from './units.js';

/**
 * The steps of an automatic calibration: measure the room quiet, then play
 * pink noise into one zone at a time while every sensor listens.
 */
export function calibrationPlan(venue, { testLevelDbfs = -20, busGainDb = -10, settleS = 2, measureS = 5 } = {}) {
  return [
    { action: 'measure-background', settleS, measureS },
    ...venue.zones.map((zone) => ({
      action: 'play-noise',
      zoneId: zone.id,
      bus: zone.bus,
      testLevelDbfs,
      busGainDb,
      settleS,
      measureS,
    })),
  ];
}

/**
 * Turns calibration measurements into the coupling table: the level each
 * sensor hears for 0 dBFS on a zone's bus at 0 dB gain. Background noise is
 * subtracted; paths too quiet to measure are left out (treated as silent).
 *
 * @param {object} args
 * @param {Array<{id: string, name?: string, sensorId?: string}>} args.zones
 * @param {Record<string, number>} args.backgroundDb  sensor → level with everything quiet
 * @param {Array<{zoneId: string, testLevelDbfs: number, busGainDb: number,
 *   measuredDb: Record<string, number>}>} args.runs
 * @returns {{couplingDb: Record<string, Record<string, number>>, warnings: string[]}}
 */
export function computeCoupling({ zones, backgroundDb, runs, minSnrDb = 3 }) {
  const couplingDb = {};
  const warnings = [];
  const nameOf = (id) => zones.find((z) => z.id === id)?.name ?? id;

  for (const run of runs) {
    for (const [sensorId, measured] of Object.entries(run.measuredDb)) {
      const background = backgroundDb[sensorId] ?? OFF;
      const ownZone = zones.find((z) => z.sensorId === sensorId);
      couplingDb[sensorId] ??= {};
      if (measured - background < minSnrDb) {
        if (ownZone?.id === run.zoneId) {
          warnings.push(
            `Sensor ${sensorId} could not hear its own zone (${nameOf(run.zoneId)}) over the background. ` +
              'Check that zone\'s speakers and cabling, or raise the test level.',
          );
        }
        continue;
      }
      const programDb = powerToDb(dbToPower(measured) - dbToPower(background));
      couplingDb[sensorId][run.zoneId] = round1(programDb - run.testLevelDbfs - run.busGainDb);
    }
  }

  for (const zone of zones) {
    const row = couplingDb[zone.sensorId];
    const own = row?.[zone.id];
    if (!row || own === undefined) continue;
    const louder = Object.entries(row).filter(([id, db]) => id !== zone.id && db > own);
    if (louder.length) {
      warnings.push(
        `Sensor ${zone.sensorId} hears ${louder.map(([id]) => nameOf(id)).join(', ')} louder than its own zone ` +
          `(${nameOf(zone.id)}). Move it into its zone's listening area, or check which bus feeds which speakers.`,
      );
    }
  }
  return { couplingDb, warnings };
}

const round1 = (x) => Math.round(x * 10) / 10;
