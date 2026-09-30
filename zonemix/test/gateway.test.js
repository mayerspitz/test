import { test } from 'node:test';
import assert from 'node:assert/strict';
import dgram from 'node:dgram';
import { parseSensorPacket, SensorGateway } from '../src/sensors/gateway.js';

const packet = (fields) => Buffer.from(JSON.stringify({ v: 1, id: 's-bar', seq: 1, up: 1000, laeq: 70, ...fields }));

test('valid packets parse; bad ones say why', () => {
  assert.equal(parseSensorPacket(packet({})).reading.laeq, 70);
  assert.equal(parseSensorPacket(Buffer.from('nope')).reason, 'not JSON');
  assert.match(parseSensorPacket(packet({ v: 2 })).reason, /version/);
  assert.match(parseSensorPacket(packet({ laeq: 400 })).reason, /laeq/);
  assert.match(parseSensorPacket(packet({ id: '../etc' })).reason, /sensor id/);
});

test('readings are energy-averaged between takes; late and duplicate packets are dropped', () => {
  const gw = new SensorGateway({ socket: dgram.createSocket('udp4') });
  gw.receive(packet({ seq: 1, laeq: 70 }));
  gw.receive(packet({ seq: 2, laeq: 80 }));
  gw.receive(packet({ seq: 2, laeq: 99 })); // duplicate
  gw.receive(packet({ seq: 1, laeq: 99 })); // late
  const taken = gw.take();
  assert.ok(Math.abs(taken['s-bar'] - 77.4) < 0.05, `got ${taken['s-bar']}`);
  assert.deepEqual(gw.take(), {});
  gw.receive(packet({ seq: 5, up: 5000, laeq: 70 }));
  assert.equal(gw.stats()['s-bar'].lost, 2);
  gw.receive(packet({ seq: 1, up: 20, laeq: 71 })); // rebooted: sequence restarts
  assert.equal(gw.take()['s-bar'] > 70, true);
  gw.close();
});

test('packets arrive over UDP', async () => {
  const gw = new SensorGateway({ port: 0 });
  const port = await gw.start();
  const node = dgram.createSocket('udp4');
  node.send(packet({ seq: 9, laeq: 66.6 }), port, '127.0.0.1');
  for (let i = 0; i < 50 && !gw.stats()['s-bar']; i++) await new Promise((r) => setTimeout(r, 10));
  node.close();
  gw.close();
  assert.equal(gw.take()['s-bar'], 66.6);
});
