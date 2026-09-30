import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeMessage, decodeMessage } from '../src/mixer/osc.js';

test('a message without arguments is address plus an empty type tag', () => {
  const buf = encodeMessage('/xremote');
  assert.equal(buf.length, 16);
  assert.equal(buf.toString('latin1'), '/xremote\0\0\0\0,\0\0\0');
});

test('a fader message encodes as a big-endian float', () => {
  const buf = encodeMessage('/bus/01/mix/fader', [0.75]);
  assert.equal(buf.length, 28);
  assert.equal(buf.subarray(24).toString('hex'), '3f400000');
});

test('all argument types survive a round trip', () => {
  const blob = Buffer.from([1, 2, 3, 4, 5]);
  const msg = decodeMessage(encodeMessage('/meters', ['/meters/2', { type: 'i', value: -7 }, 0.5, blob]));
  assert.equal(msg.address, '/meters');
  assert.deepEqual(msg.args.map((a) => a.type), ['s', 'i', 'f', 'b']);
  assert.equal(msg.args[0].value, '/meters/2');
  assert.equal(msg.args[1].value, -7);
  assert.equal(msg.args[2].value, 0.5);
  assert.deepEqual([...msg.args[3].value], [1, 2, 3, 4, 5]);
});

test('garbage is rejected', () => {
  assert.throws(() => decodeMessage(Buffer.from('hello\0\0\0')), /Not an OSC message/);
});
