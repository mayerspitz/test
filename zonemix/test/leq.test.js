import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RollingLeq } from '../src/engine/leq.js';

test('Leq of a steady level is that level', () => {
  const leq = new RollingLeq(600);
  for (let i = 0; i < 900; i++) leq.push(90);
  assert.ok(Math.abs(leq.leqDb() - 90) < 1e-9);
});

test('the budget allows the rest of the window at the limit when it has been quiet', () => {
  const leq = new RollingLeq(900);
  // Missing time counts as quiet, so early on the next minute may be louder than the limit.
  assert.ok(leq.allowedDb(100, 60) > 111);
  for (let i = 0; i < 900; i++) leq.push(100);
  assert.ok(Math.abs(leq.allowedDb(100, 60) - 100) < 1e-9);
});

test('after a loud stretch the budget asks for less', () => {
  const leq = new RollingLeq(900);
  for (let i = 0; i < 900; i++) leq.push(102);
  const allowed = leq.allowedDb(100, 60);
  assert.ok(allowed < 90, `allowed ${allowed}`);
});
