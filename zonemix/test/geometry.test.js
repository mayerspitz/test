import { test } from 'node:test';
import assert from 'node:assert/strict';
import { speedOfSound, alignmentDelaysMs } from '../src/engine/geometry.js';
import { exampleVenue } from './helpers.js';

test('sound travels about 343 m/s at 20 °C', () => {
  assert.ok(Math.abs(speedOfSound(20) - 343.4) < 0.1);
});

test('fill speakers are delayed behind the main PA plus the precedence margin', () => {
  const venue = {
    geometry: { mainZone: 'main', temperatureC: 20, precedenceMs: 10 },
    zones: [
      { id: 'main', speakerPos: [0, 0] },
      { id: 'fill', speakerPos: [0, 20], listenPos: [0, 23.434] },
    ],
  };
  const delays = alignmentDelaysMs(venue);
  assert.equal(delays.main, 0);
  // 23.434 m - 3.434 m = 20 m ≈ 58.2 ms, plus 10 ms
  assert.ok(Math.abs(delays.fill - 68.2) < 0.2, `delay ${delays.fill}`);
});

test('the example venue gets a delay for every zone', () => {
  const delays = alignmentDelaysMs(exampleVenue());
  assert.deepEqual(Object.keys(delays).sort(), ['bar', 'dance', 'dining-l', 'dining-r', 'foyer']);
});
