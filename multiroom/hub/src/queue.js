import crypto from 'node:crypto';

// Pure queue logic for one zone. A zone holds `queue` (array of items) and
// `index` (the current item, -1 when empty). Kept free of I/O so it is easy to test.

export const REPEAT_MODES = ['off', 'all', 'one'];

export function newUid() {
  return `q${crypto.randomBytes(6).toString('hex')}`;
}

export function makeItem({ kind, ref, title, artist = null, album = null, duration = null, artwork = null }) {
  return { uid: newUid(), kind, ref, title: title || ref, artist, album, duration, artwork };
}

export function shuffled(items) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function current(zone) {
  return zone.index >= 0 ? zone.queue[zone.index] ?? null : null;
}

export function setQueue(zone, items, startIndex = 0) {
  zone.queue = items;
  zone.index = items.length ? Math.min(Math.max(startIndex, 0), items.length - 1) : -1;
  if (zone.shuffle && items.length > 1) shuffleUpcoming(zone);
}

export function append(zone, items) {
  zone.queue.push(...items);
  if (zone.index < 0 && zone.queue.length) zone.index = 0;
}

export function insertNext(zone, items) {
  zone.queue.splice(zone.index + 1, 0, ...items);
  if (zone.index < 0 && zone.queue.length) zone.index = 0;
}

// Shuffle everything after the current item, keeping the current one in place.
export function shuffleUpcoming(zone) {
  const head = zone.queue.slice(0, zone.index + 1);
  zone.queue = [...head, ...shuffled(zone.queue.slice(zone.index + 1))];
}

// Returns true when the removed item was the one playing.
export function removeAt(zone, idx) {
  if (idx < 0 || idx >= zone.queue.length) return false;
  zone.queue.splice(idx, 1);
  const wasCurrent = idx === zone.index;
  if (idx < zone.index) zone.index -= 1;
  if (!zone.queue.length) zone.index = -1;
  else if (zone.index >= zone.queue.length) zone.index = zone.queue.length - 1;
  return wasCurrent;
}

export function move(zone, from, to) {
  const n = zone.queue.length;
  if (from < 0 || from >= n || to < 0 || to >= n || from === to) return;
  const [item] = zone.queue.splice(from, 1);
  zone.queue.splice(to, 0, item);
  if (zone.index === from) zone.index = to;
  else if (from < zone.index && to >= zone.index) zone.index -= 1;
  else if (from > zone.index && to <= zone.index) zone.index += 1;
}

// Index to play after the current one, or -1 when the queue is finished.
// `auto` = the track ended by itself (repeat-one only applies then).
export function nextIndex(zone, auto = false) {
  const n = zone.queue.length;
  if (!n) return -1;
  if (auto && zone.repeat === 'one' && zone.index >= 0) return zone.index;
  if (zone.index + 1 < n) return zone.index + 1;
  return zone.repeat === 'all' ? 0 : -1;
}

// "Previous" restarts the current track if we are more than 3 s in.
export function previousIndex(zone, position = 0) {
  if (!zone.queue.length) return -1;
  if (position > 3 || zone.index <= 0) return Math.max(zone.index, 0);
  return zone.index - 1;
}
