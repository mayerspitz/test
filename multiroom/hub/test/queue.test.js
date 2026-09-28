import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as Q from '../src/queue.js';

const zone = (n, index = 0, extra = {}) => ({
  queue: Array.from({ length: n }, (_, i) => ({ uid: `u${i}`, title: `t${i}` })),
  index,
  repeat: 'off',
  shuffle: false,
  ...extra,
});

test('nextIndex walks forward and ends when repeat is off', () => {
  assert.equal(Q.nextIndex(zone(3, 0)), 1);
  assert.equal(Q.nextIndex(zone(3, 2)), -1);
  assert.equal(Q.nextIndex(zone(0, -1)), -1);
});

test('repeat all wraps, repeat one only repeats automatically', () => {
  assert.equal(Q.nextIndex(zone(3, 2, { repeat: 'all' })), 0);
  assert.equal(Q.nextIndex(zone(3, 1, { repeat: 'one' }), true), 1);
  assert.equal(Q.nextIndex(zone(3, 1, { repeat: 'one' }), false), 2);
});

test('previous restarts the song after 3 seconds', () => {
  assert.equal(Q.previousIndex(zone(3, 2), 10), 2);
  assert.equal(Q.previousIndex(zone(3, 2), 1), 1);
  assert.equal(Q.previousIndex(zone(3, 0), 1), 0);
});

test('removeAt keeps the current item stable', () => {
  const z = zone(5, 2);
  assert.equal(Q.removeAt(z, 0), false);
  assert.equal(z.index, 1);
  assert.equal(Q.current(z).uid, 'u2');
  assert.equal(Q.removeAt(z, 1), true);
  assert.equal(Q.current(z).uid, 'u3');
  const last = zone(2, 1);
  Q.removeAt(last, 1);
  assert.equal(last.index, 0);
  const one = zone(1, 0);
  Q.removeAt(one, 0);
  assert.equal(one.index, -1);
});

test('move tracks the current item', () => {
  const z = zone(5, 2);
  Q.move(z, 2, 4);
  assert.equal(z.index, 4);
  Q.move(z, 0, 4);
  assert.equal(z.index, 3);
  assert.equal(Q.current(z).uid, 'u2');
  Q.move(z, 4, 0);
  assert.equal(z.index, 4);
  assert.equal(Q.current(z).uid, 'u2');
});

test('insertNext and append on an empty queue select the first item', () => {
  const z = zone(0, -1);
  Q.append(z, [{ uid: 'a' }]);
  assert.equal(z.index, 0);
  Q.insertNext(z, [{ uid: 'b' }]);
  assert.deepEqual(z.queue.map((i) => i.uid), ['a', 'b']);
});

test('shuffleUpcoming never moves played or current items', () => {
  const z = zone(30, 5);
  Q.shuffleUpcoming(z);
  assert.deepEqual(z.queue.slice(0, 6).map((i) => i.uid), ['u0', 'u1', 'u2', 'u3', 'u4', 'u5']);
  assert.equal(new Set(z.queue.map((i) => i.uid)).size, 30);
});
