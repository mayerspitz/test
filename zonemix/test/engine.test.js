import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ZoneMixEngine } from '../src/engine/engine.js';
import { makeRandom } from '../src/sim/world.js';
import { smallVenue } from './helpers.js';

// Steps the engine at its tick rate from `from` to `to` seconds.
function run(engine, from, to, inputs) {
  const dt = engine.control.tickMs / 1000;
  let out;
  for (let t = from; t < to - 1e-9; t += dt) {
    const i = typeof inputs === 'function' ? inputs(t) : inputs;
    out = engine.tick({ t, ...i });
  }
  return out;
}

const zone = (out, id) => out.zones.find((z) => z.id === id);
const codes = (out, id) => out.alarms.filter((a) => a.zoneId === id).map((a) => a.code);
const music = { mic: -80, music: -20 };

test('the first tick sends every gain and send; a repeat sends nothing new', () => {
  const engine = new ZoneMixEngine(smallVenue());
  const first = engine.tick({ t: 0, channelDb: music });
  assert.equal(first.changes.filter((c) => c.type === 'bus').length, 3);
  assert.equal(first.changes.filter((c) => c.type === 'send').length, 6);
  const second = engine.tick({ t: 0.1, channelDb: music });
  assert.deepEqual(second.changes, []);
});

test('auto zones start on their calibrated targets; background music is not pushed up', () => {
  const out = new ZoneMixEngine(smallVenue()).tick({ t: 0, channelDb: music });
  // Zone a: music at -20 dBFS through a 100 dB path to a 70 dB target.
  assert.ok(Math.abs(out.gainsDb.a + 10) < 0.2, `a at ${out.gainsDb.a}`);
  // Zone b's target is for speech; its music is 6 dB under that by design,
  // so the gain is set for speech (-15), not raised to make music hit 65 (-9).
  // Zone a leaks in 10 dB under b's target, so b sits about 0.5 dB lower.
  assert.ok(Math.abs(out.gainsDb.b + 15.45) < 0.1, `b at ${out.gainsDb.b}`);
  assert.equal(out.gainsDb.main, -20);
});

test('speech ducks the music only in zones set to duck', () => {
  const engine = new ZoneMixEngine(smallVenue());
  run(engine, 0, 2, { channelDb: music });
  let out = run(engine, 2, 3, { channelDb: { mic: -20, music: -20 } });
  assert.equal(out.speechActive, true);
  assert.equal(zone(out, 'a').duckDb, 10);
  assert.equal(out.sendsDb.music.a, -10);
  assert.equal(out.sendsDb.music.b, -6);
  out = run(engine, 3, 8, { channelDb: music });
  assert.equal(out.speechActive, false);
  assert.equal(out.sendsDb.music.a, 0);
});

test('scene changes fade the mix over the scene\'s fade time', () => {
  const engine = new ZoneMixEngine(smallVenue());
  run(engine, 0, 5, { channelDb: music });
  engine.setScene('quiet', 5);
  let out = run(engine, 5, 7.05, { channelDb: music });
  assert.ok(Math.abs(out.sendsDb.music.a + 5) < 0.3, `halfway ${out.sendsDb.music.a}`);
  out = run(engine, 7.05, 10, { channelDb: music });
  assert.equal(out.sendsDb.music.a, -10);
  assert.equal(out.sendsDb.music.b, -Infinity);
  assert.throws(() => engine.setScene('nope', 10), /Unknown scene "nope"/);
});

test('the safety limiter pulls a zone down fast when its sensor reads over the limit', () => {
  const engine = new ZoneMixEngine(smallVenue());
  const before = run(engine, 0, 5, { channelDb: music, sensors: { 's-main': 70, 's-a': 70, 's-b': 65 } });
  let out = run(engine, 5, 7, { channelDb: music, sensors: { 's-main': 70, 's-a': 96, 's-b': 65 } });
  assert.ok(zone(out, 'a').safetyCutDb > 8, `cut ${zone(out, 'a').safetyCutDb}`);
  assert.ok(out.gainsDb.a < before.gainsDb.a - 8);
  assert.ok(codes(out, 'a').includes('over-limit'));
  out = run(engine, 7, 60, { channelDb: music, sensors: { 's-main': 70, 's-a': 70, 's-b': 65 } });
  assert.equal(zone(out, 'a').safetyCutDb, 0);
});

test('a zone made too loud by a neighbour says so and does not cut itself to silence', () => {
  const venue = smallVenue((raw) => {
    raw.scenes.show.zones.main.gainDb = 0;
    raw.scenes.show.zones.b.targetDb = 60;
    raw.calibration.couplingDb['s-b'].main = 99;
    return raw;
  });
  const engine = new ZoneMixEngine(venue);
  const out = run(engine, 0, 5, { channelDb: music, sensors: { 's-main': 90, 's-a': 70, 's-b': 95 } });
  assert.ok(codes(out, 'b').includes('spill'));
  const over = out.alarms.find((a) => a.zoneId === 'b' && a.code === 'over-limit');
  assert.match(over.message, /mostly from main/);
  assert.equal(zone(out, 'b').safetyCutDb, 0);
});

test('a silent sensor raises an alarm while the zone keeps running on its model', () => {
  const engine = new ZoneMixEngine(smallVenue());
  run(engine, 0, 2, { channelDb: music, sensors: { 's-main': 70, 's-a': 70, 's-b': 65 } });
  const out = run(engine, 2, 6, { channelDb: music, sensors: { 's-main': 70, 's-b': 65 } });
  assert.ok(codes(out, 'a').includes('sensor-offline'));
  assert.equal(zone(out, 'a').sensorOnline, false);
  assert.ok(Number.isFinite(out.gainsDb.a));
});

test('a limit-only zone is held back to stay inside its Leq limit', () => {
  const venue = smallVenue((raw) => {
    raw.zones[0].leqLimit = { windowMin: 2, maxDb: 85 };
    return raw;
  });
  const engine = new ZoneMixEngine(venue);
  const out = run(engine, 0, 75, { channelDb: music, sensors: { 's-main': 95, 's-a': 70, 's-b': 65 } });
  assert.ok(codes(out, 'main').includes('leq-budget'));
  assert.ok(out.gainsDb.main < -35, `main at ${out.gainsDb.main}`);
});

test('a manual zone is never changed, only reported', () => {
  const venue = smallVenue((raw) => {
    raw.zones[0].mode = 'manual';
    return raw;
  });
  const engine = new ZoneMixEngine(venue);
  const out = run(engine, 0, 3, { channelDb: music, sensors: { 's-main': 105, 's-a': 70, 's-b': 65 } });
  assert.equal(out.gainsDb.main, -20);
  const alarm = out.alarms.find((a) => a.zoneId === 'main');
  assert.match(alarm.message, /manual zone/);
});

test('a zone that goes quiet (speaker off) is flagged for checking', () => {
  const engine = new ZoneMixEngine(smallVenue());
  const r = makeRandom(7);
  const out = run(engine, 0, 90, () => ({
    channelDb: { mic: -80, music: -20 + (r() - 0.5) * 12 },
    sensors: { 's-main': 70, 's-a': 50 + r.gauss() * 0.3, 's-b': 65 },
  }));
  const alarm = out.alarms.find((a) => a.zoneId === 'a' && a.code === 'model-mismatch');
  assert.ok(alarm, JSON.stringify(out.alarms));
  assert.match(alarm.message, /quieter than at calibration/);
});
