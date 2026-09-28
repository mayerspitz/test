import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';
import { badRequest, notFound } from './errors.js';

// Saved playlists that mix anything: library songs, YouTube / YouTube Music songs and
// stream URLs, in any order. Stored next to the speakers' state (so in cloud mode they're
// part of the home Pi's backup too). Items are kept as ready-to-play snapshots:
//   { kind: 'track'|'youtube'|'url', ref, title, artist, album, duration, artwork }
export class Playlists extends EventEmitter {
  constructor(store) {
    super();
    this.store = store;
    store.data.playlists ??= {};
  }

  get all() {
    return this.store.data.playlists;
  }

  get(id) {
    const p = this.all[id];
    if (!p) throw notFound('Playlist');
    return p;
  }

  list() {
    return Object.values(this.all)
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))
      .map((p) => summary(p));
  }

  create(name, items = []) {
    const clean = cleanName(name);
    const id = `pl${crypto.randomBytes(5).toString('hex')}`;
    this.all[id] = { id, name: clean, items: items.map(snapshot), createdAt: Date.now(), updatedAt: Date.now() };
    return this.#changed(id);
  }

  rename(id, name) {
    this.get(id).name = cleanName(name);
    return this.#changed(id);
  }

  remove(id) {
    this.get(id);
    delete this.all[id];
    this.store.save();
    this.emit('changed', id);
  }

  add(id, items, position) {
    const p = this.get(id);
    const at = Number.isInteger(position) && position >= 0 && position <= p.items.length ? position : p.items.length;
    p.items.splice(at, 0, ...items.map(snapshot));
    if (p.items.length > 20_000) throw badRequest('Playlists are limited to 20,000 songs');
    return this.#changed(id);
  }

  removeItem(id, index) {
    const p = this.get(id);
    if (!Number.isInteger(index) || index < 0 || index >= p.items.length) throw badRequest('No such playlist position');
    p.items.splice(index, 1);
    return this.#changed(id);
  }

  move(id, from, to) {
    const p = this.get(id);
    const n = p.items.length;
    if (![from, to].every((i) => Number.isInteger(i) && i >= 0 && i < n)) throw badRequest('No such playlist position');
    const [item] = p.items.splice(from, 1);
    p.items.splice(to, 0, item);
    return this.#changed(id);
  }

  // Cloud mode: bring playlists back from the home Pi's backup.
  restore(playlists) {
    this.store.data.playlists = structuredClone(playlists ?? {});
    this.store.save();
    this.emit('changed', null);
  }

  #changed(id) {
    const p = this.get(id);
    p.updatedAt = Date.now();
    this.store.save();
    this.emit('changed', id);
    return p;
  }
}

function snapshot({ kind, ref, title, artist = null, album = null, duration = null, artwork = null }) {
  return { kind, ref, title, artist, album, duration, artwork };
}

function summary(p) {
  const art = p.items.find((i) => i.artwork)?.artwork ?? null;
  return {
    id: p.id,
    name: p.name,
    count: p.items.length,
    duration: p.items.reduce((n, i) => n + (i.duration ?? 0), 0),
    kinds: [...new Set(p.items.map((i) => i.kind))],
    artwork: art,
    updatedAt: p.updatedAt,
  };
}

function cleanName(name) {
  const s = String(name ?? '').trim().slice(0, 80);
  if (!s) throw badRequest('Give the playlist a name');
  return s;
}
