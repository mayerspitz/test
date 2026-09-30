import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SensorEstimator } from '../src/engine/estimator.js';
import { dbToPower } from '../src/engine/units.js';
import { makeRandom } from '../src/sim/world.js';

// Music between 70 and 82 dB with a gap every 30 blocks.
function feed(est, { blocks, driftDb, noiseDb, program = (i, r) => (i % 30 < 2 ? 40 : 70 + r() * 12), seed = 3 }) {
  const r = makeRandom(seed);
  for (let i = 0; i < blocks; i++) {
    const qDb = program(i, r);
    const m = dbToPower(qDb + driftDb) + dbToPower(noiseDb + r.gauss() * 0.5);
    est.push(dbToPower(qDb), m * dbToPower(r.gauss() * 0.15));
  }
}

test('learns room drift and crowd noise from varying music', () => {
  const est = new SensorEstimator();
  feed(est, { blocks: 240, driftDb: -2, noiseDb: 65 });
  assert.ok(Math.abs(est.driftDb + 2) < 0.3, `drift ${est.driftDb}`);
  assert.ok(Math.abs(est.noiseDb - 65) < 2, `noise ${est.noiseDb}`);
  assert.equal(est.mismatch, false);
});

test('holds the noise estimate when the program buries it', () => {
  const est = new SensorEstimator();
  feed(est, { blocks: 120, driftDb: 0, noiseDb: 68 });
  // Now loud, steady music with no gaps: the crowd cannot be heard under it.
  feed(est, { blocks: 120, driftDb: 0, noiseDb: 50, program: (i, r) => 88 + r() * 3 });
  assert.ok(est.noiseDb > 63, `noise collapsed to ${est.noiseDb}`);
  assert.ok(Math.abs(est.driftDb) < 0.5);
});

test('learns noise but not drift when the crowd drowns the program', () => {
  const est = new SensorEstimator();
  feed(est, { blocks: 120, driftDb: -6, noiseDb: 80, program: (i, r) => 60 + r() * 6 });
  assert.equal(est.driftDb, 0);
  assert.ok(Math.abs(est.noiseDb - 80) < 1);
});

test('flags a zone that has gone silent', () => {
  const est = new SensorEstimator();
  feed(est, { blocks: 200, driftDb: -40, noiseDb: 55 });
  assert.equal(est.mismatch, true);
  assert.ok(est.driftDb < -10);
});
