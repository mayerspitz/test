import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solveZoneGains, predictDb } from '../src/engine/solver.js';

const table = {
  s1: { z1: 100, z2: 90 },
  s2: { z1: 90, z2: 100 },
};
const pathDb = (s, z) => table[s][z] ?? -Infinity;

test('a lone zone gets target minus its path', () => {
  const gains = solveZoneGains({
    zones: [{ id: 'z1', sensorId: 's1', auto: true, targetDb: 80, minDb: -40, maxDb: 0 }],
    pathDb: () => 100,
  });
  assert.ok(Math.abs(gains.z1 + 20) < 1e-3);
});

test('two zones leaking into each other both land on target', () => {
  const zones = [
    { id: 'z1', sensorId: 's1', auto: true, targetDb: 80, minDb: -40, maxDb: 0 },
    { id: 'z2', sensorId: 's2', auto: true, targetDb: 75, minDb: -40, maxDb: 0 },
  ];
  const gains = solveZoneGains({ zones, pathDb });
  for (const z of zones) {
    const level = predictDb({ sensorId: z.sensorId, zones, pathDb, gainsDb: gains });
    assert.ok(Math.abs(level - z.targetDb) < 0.05, `${z.id} at ${level}`);
  }
  // Setting each zone as if alone would overshoot the quieter zone.
  const naive = { z1: -20, z2: -25 };
  assert.ok(predictDb({ sensorId: 's2', zones, pathDb, gainsDb: naive }) > 75.5);
});

test('gain limits are respected', () => {
  const zones = [{ id: 'z1', sensorId: 's1', auto: true, targetDb: 110, minDb: -40, maxDb: 0 }];
  assert.equal(solveZoneGains({ zones, pathDb }).z1, 0);
});

test('a zone already too loud from a fixed neighbour goes to its minimum', () => {
  const zones = [
    { id: 'z1', auto: false, gainDb: 0 },
    { id: 'z2', sensorId: 's2', auto: true, targetDb: 80, minDb: -40, maxDb: 0 },
  ];
  const gains = solveZoneGains({ zones, pathDb });
  assert.equal(gains.z1, 0);
  assert.ok(Math.abs(gains.z2 + 40) < 1e-6);
});
