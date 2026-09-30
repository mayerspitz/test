import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadVenue, ConfigError, CONTROL_DEFAULTS } from '../src/engine/config.js';
import { exampleVenue, smallVenueRaw } from './helpers.js';

test('the example venue loads without problems or warnings', () => {
  const venue = exampleVenue();
  assert.equal(venue.zones.length, 5);
  assert.deepEqual(venue.warnings, []);
  assert.equal(venue.initialScene, 'reception');
});

test('defaults are filled in', () => {
  const venue = loadVenue(smallVenueRaw());
  assert.equal(venue.control.tickMs, CONTROL_DEFAULTS.tickMs);
  assert.equal(venue.zones[1].mode, 'auto');
  assert.equal(venue.channels[0].trimDb, 0);
  assert.equal(venue.scenes.quiet.zones.b.mix.music, -Infinity);
});

test('every problem is reported at once, in plain English', () => {
  const raw = smallVenueRaw();
  raw.channels[1].group = 'drums';
  raw.zones[1].gainRangeDb = [-40, 12];
  raw.zones[2].bus = 2;
  delete raw.scenes.quiet.zones.b;
  raw.calibration.couplingDb['s-a'] = { main: 85, b: 85 };
  let error;
  try {
    loadVenue(raw);
  } catch (err) {
    error = err;
  }
  assert.ok(error instanceof ConfigError);
  const text = error.problems.join('\n');
  assert.match(text, /group "drums" is not in "groups"/);
  assert.match(text, /faders stop at \+10 dB/);
  assert.match(text, /share the zone bus "2"/);
  assert.match(text, /Scene "quiet", zone b: missing/);
  assert.match(text, /no calibration from its speakers to its sensor "s-a"/);
});

test('a sensor that hears another zone louder than its own is flagged', () => {
  const raw = smallVenueRaw();
  raw.calibration.couplingDb['s-b'].main = 105;
  const venue = loadVenue(raw);
  assert.equal(venue.warnings.length, 1);
  assert.match(venue.warnings[0], /s-b hears main louder than its own zone/);
});

test('an empty configuration is refused', () => {
  assert.throws(() => loadVenue(null), ConfigError);
});
