import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calibrationPlan, computeCoupling } from '../src/engine/calibration.js';
import { dbToPower, powerToDb } from '../src/engine/units.js';
import { exampleVenue } from './helpers.js';

test('the plan measures the quiet room, then each zone in turn', () => {
  const plan = calibrationPlan(exampleVenue());
  assert.equal(plan[0].action, 'measure-background');
  assert.deepEqual(plan.slice(1).map((s) => s.zoneId), ['dance', 'dining-l', 'dining-r', 'bar', 'foyer']);
});

test('measurements turn back into the coupling table', () => {
  const venue = exampleVenue();
  const backgroundDb = { 's-dance': 50, 's-dining-l': 45, 's-dining-r': 45, 's-bar': 52, 's-foyer': 48 };
  const runs = venue.zones.map((zone) => {
    const measuredDb = {};
    for (const [sensorId, row] of Object.entries(venue.coupling)) {
      const program = row[zone.id] - 20 - 10;
      measuredDb[sensorId] = powerToDb(dbToPower(program) + dbToPower(backgroundDb[sensorId]));
    }
    return { zoneId: zone.id, testLevelDbfs: -20, busGainDb: -10, measuredDb };
  });
  const { couplingDb, warnings } = computeCoupling({ zones: venue.zones, backgroundDb, runs });
  for (const [sensorId, row] of Object.entries(couplingDb)) {
    for (const [zoneId, db] of Object.entries(row)) {
      assert.ok(Math.abs(db - venue.coupling[sensorId][zoneId]) <= 0.1, `${sensorId}/${zoneId}: ${db}`);
    }
  }
  // Paths under the background (the foyer barely reaches the dance floor) are left out.
  assert.equal(couplingDb['s-dance'].foyer, undefined);
  assert.deepEqual(warnings, []);
});

test('a zone its own sensor cannot hear, and a misplaced sensor, are reported', () => {
  const zones = [
    { id: 'a', name: 'Zone A', sensorId: 's-a' },
    { id: 'b', name: 'Zone B', sensorId: 's-b' },
  ];
  const { warnings } = computeCoupling({
    zones,
    backgroundDb: { 's-a': 50, 's-b': 50 },
    runs: [
      { zoneId: 'a', testLevelDbfs: -20, busGainDb: -10, measuredDb: { 's-a': 72, 's-b': 60 } },
      { zoneId: 'b', testLevelDbfs: -20, busGainDb: -10, measuredDb: { 's-a': 80, 's-b': 51 } },
    ],
  });
  assert.equal(warnings.length, 2);
  assert.match(warnings[0], /s-b could not hear its own zone \(Zone B\)/);
  assert.match(warnings[1], /s-a hears Zone B louder/);
});
