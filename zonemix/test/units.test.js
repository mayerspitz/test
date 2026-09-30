import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OFF, dbToPower, powerToDb, sumDb, slew, clamp, smoothing } from '../src/engine/units.js';

test('dB and power convert both ways, with silence as -Infinity', () => {
  assert.equal(dbToPower(0), 1);
  assert.equal(dbToPower(OFF), 0);
  assert.equal(powerToDb(0), OFF);
  assert.ok(Math.abs(powerToDb(dbToPower(87.3)) - 87.3) < 1e-9);
});

test('two equal sounds add up to 3 dB more', () => {
  assert.ok(Math.abs(sumDb([80, 80]) - 83.0103) < 1e-3);
  assert.equal(sumDb([80, OFF]), 80);
});

test('slew limits the step each way', () => {
  assert.equal(slew(0, 10, 1, 2), 1);
  assert.equal(slew(0, -10, 1, 2), -2);
  assert.equal(slew(0, 0.5, 1, 2), 0.5);
  assert.equal(clamp(5, 0, 3), 3);
  assert.equal(smoothing(1, 0), 1);
});
