import { readFileSync } from 'node:fs';
import { loadVenue } from '../src/engine/config.js';

export function exampleVenue() {
  return loadVenue(JSON.parse(readFileSync(new URL('../config/example-venue.json', import.meta.url), 'utf8')));
}

/**
 * Two auto zones and one limit-only zone, small enough to reason about by
 * hand. Overrides are merged into the raw config before validation.
 */
export function smallVenueRaw() {
  return {
    name: 'Test hall',
    groups: ['speech', 'music'],
    channels: [
      { id: 'mic', mixerChannel: 1, group: 'speech', nominalDbfs: -20 },
      { id: 'music', mixerChannel: 2, group: 'music', nominalDbfs: -20 },
    ],
    zones: [
      { id: 'main', bus: 1, sensorId: 's-main', mode: 'limit-only', gainRangeDb: [-40, 0], maxLaeq1sDb: 100 },
      {
        id: 'a',
        bus: 2,
        sensorId: 's-a',
        gainRangeDb: [-40, 0],
        maxLaeq1sDb: 90,
        duck: { groups: ['music'], depthDb: 10, attackS: 0.5, releaseS: 2 },
      },
      { id: 'b', bus: 3, sensorId: 's-b', gainRangeDb: [-40, 0], maxLaeq1sDb: 90 },
    ],
    scenes: {
      show: {
        fadeS: 0,
        zones: {
          main: { gainDb: -20, mix: { speech: 0, music: 0 } },
          a: { targetDb: 70, mix: { speech: 0, music: 0 } },
          b: { targetDb: 65, mix: { speech: 0, music: -6 } },
        },
      },
      quiet: {
        fadeS: 4,
        zones: {
          main: { gainDb: -30, mix: { speech: 0, music: -10 } },
          a: { targetDb: 60, mix: { speech: 0, music: -10 } },
          b: { targetDb: 60, mix: { speech: 0, music: 'off' } },
        },
      },
    },
    calibration: {
      couplingDb: {
        's-main': { main: 110, a: 85, b: 80 },
        's-a': { main: 85, a: 100, b: 85 },
        's-b': { main: 80, a: 85, b: 100 },
      },
    },
  };
}

export function smallVenue(patch = (raw) => raw) {
  return loadVenue(patch(smallVenueRaw()));
}

export const near = (actual, expected, tolerance) =>
  Math.abs(actual - expected) <= tolerance || `${actual} is not within ${tolerance} of ${expected}`;
