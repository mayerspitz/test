import { test } from 'node:test';
import assert from 'node:assert/strict';
import dgram from 'node:dgram';
import { once } from 'node:events';
import {
  levelToDb, dbToLevel, MODELS, SEND_STEPS, checkVenueForMixer, parseX32MeterBlob, meterToDbfs, BehringerMixer,
} from '../src/mixer/behringer.js';
import { decodeMessage } from '../src/mixer/osc.js';
import { exampleVenue } from './helpers.js';

test('the fader law matches the consoles at its corner points', () => {
  assert.equal(levelToDb(1), 10);
  assert.equal(levelToDb(0.75), 0);
  assert.equal(levelToDb(0.5), -10);
  assert.equal(levelToDb(0.25), -30);
  assert.equal(levelToDb(0.0625), -60);
  assert.equal(levelToDb(0), -Infinity);
  assert.equal(dbToLevel(0, SEND_STEPS), 0.75);
  assert.equal(dbToLevel(-10, SEND_STEPS), 0.5);
  assert.equal(dbToLevel(-Infinity), 0);
  assert.equal(dbToLevel(25), 1);
});

test('dB survives the trip through fader steps to within half a step', () => {
  for (let db = -60; db <= 10; db += 0.37) {
    assert.ok(Math.abs(levelToDb(dbToLevel(db)) - db) <= 0.08, `fader ${db}`);
    assert.ok(Math.abs(levelToDb(dbToLevel(db, SEND_STEPS)) - db) <= 0.5, `send ${db}`);
  }
});

test('X32 and X Air address their buses differently', () => {
  assert.equal(MODELS.x32.busFader(3), '/bus/03/mix/fader');
  assert.equal(MODELS.xair.busFader(3), '/bus/3/mix/fader');
  assert.equal(MODELS.x32.send(9, 12), '/ch/09/mix/12/level');
});

test('a venue needing more buses than the mixer has is caught', () => {
  assert.deepEqual(checkVenueForMixer(exampleVenue(), 'x32'), []);
  const venue = exampleVenue();
  venue.zones[4].bus = 7;
  assert.match(checkVenueForMixer(venue, 'xair')[0], /bus 7.*6 mix buses/);
  assert.match(checkVenueForMixer(venue, 'mackie')[0], /Unknown mixer type/);
});

test('X32 meter blobs decode to linear values', () => {
  const blob = Buffer.alloc(4 + 3 * 4);
  blob.writeInt32LE(3, 0);
  [1, 0.5, 0].forEach((v, i) => blob.writeFloatLE(v, 4 + i * 4));
  const values = parseX32MeterBlob(blob);
  assert.deepEqual([...values], [1, 0.5, 0]);
  assert.equal(meterToDbfs(1), 0);
  assert.ok(Math.abs(meterToDbfs(0.5) + 6.02) < 0.01);
});

test('the driver subscribes and sends fader and send changes to the mixer', async () => {
  const mixer = dgram.createSocket('udp4');
  mixer.bind(0, '127.0.0.1');
  await once(mixer, 'listening');
  const received = [];
  const got = new Promise((resolve) => {
    mixer.on('message', (buf) => {
      received.push(decodeMessage(buf));
      if (received.length === 3) resolve();
    });
  });
  const driver = new BehringerMixer({ model: 'xair', host: '127.0.0.1', port: mixer.address().port });
  driver.start();
  driver.apply([
    { type: 'bus', bus: 2, db: 0 },
    { type: 'send', mixerChannel: 3, bus: 2, db: -10 },
  ]);
  await got;
  driver.close();
  mixer.close();
  assert.deepEqual(received.map((m) => m.address), ['/xremote', '/bus/2/mix/fader', '/ch/03/mix/02/level']);
  assert.ok(Math.abs(received[1].args[0].value - 0.75) < 0.001);
  assert.equal(received[2].args[0].value, 0.5);
});

test('the driver refuses to start without a mixer address', () => {
  assert.throws(() => new BehringerMixer({ model: 'x32' }), /ZONEMIX_MIXER_HOST/);
});
