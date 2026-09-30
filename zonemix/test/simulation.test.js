import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runScenario, weddingEvening } from '../src/sim/scenario.js';
import { exampleVenue } from './helpers.js';

// End to end: the wedding evening from the simulator, with three different
// random seeds for the music, crowd and sensor noise.
for (const seed of [1, 2, 3]) {
  test(`simulated wedding evening, seed ${seed}: zones hold targets and stay inside limits`, () => {
    const venue = exampleVenue();
    const { summary } = runScenario(venue, weddingEvening, { seed });
    for (const [id, s] of Object.entries(summary)) {
      if (s.mode === 'auto') {
        assert.ok(s.windows > 50, `${id}: only ${s.windows} windows`);
        assert.ok(s.meanAbsErrorDb <= 1, `${id}: mean error ${s.meanAbsErrorDb} dB`);
        assert.ok(s.p90AbsErrorDb <= 2, `${id}: 90% error ${s.p90AbsErrorDb} dB`);
      }
      assert.ok(s.maxTrueLevelDb <= s.limitDb, `${id}: loudest second ${s.maxTrueLevelDb} over ${s.limitDb}`);
      assert.ok(!s.alarms.includes('model-mismatch'), `${id}: false speaker alarm`);
    }
    assert.ok(summary.dance.maxLeqDb <= 100, `dance floor Leq ${summary.dance.maxLeqDb}`);
    assert.ok(summary.bar.alarms.includes('sensor-offline'));
  });
}
