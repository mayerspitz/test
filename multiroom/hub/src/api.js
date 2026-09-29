import fs from 'node:fs/promises';
import express from 'express';
import { badRequest } from './errors.js';
import { makeItem, shuffled } from './queue.js';

// REST API used by the web app — and by any custom mobile app you build.
// Every route answers JSON; see docs/API.md for the full reference.
export function createApi({ zones, library, youtube, playlists, setup }) {
  const api = express.Router();
  const wrap = (fn) => async (req, res, next) => {
    try {
      const out = await fn(req, res);
      if (out !== undefined && !res.headersSent) res.json(out);
    } catch (err) {
      next(err);
    }
  };
  const ok = { ok: true };
  const zoneOf = (req) => zones.publicZone(req.params.id);
  const cmd = (fn) => wrap((req) => {
    fn(req.params.id, req.body ?? {}, req);
    return zoneOf(req);
  });

  // ---- speakers (zones) ----
  api.get('/zones', wrap(() => zones.list()));
  api.post('/zones/pause-all', wrap(() => (zones.pauseAll(), ok)));
  api.post('/zones/stop-all', wrap(() => (zones.stopAll(), ok)));
  api.get('/zones/:id', wrap(zoneOf));
  api.patch('/zones/:id', cmd((id, b) => zones.rename(id, b.name)));
  api.delete('/zones/:id', wrap((req) => (zones.remove(req.params.id), ok)));

  api.post('/zones/:id/play', wrap(async (req) => {
    const id = req.params.id;
    const b = req.body ?? {};
    zones.zone(id);
    const mode = b.mode ?? 'replace';
    let items = await expandItems(b.items, library, playlists);
    let startIndex = Number(b.startIndex) || 0;
    if (mode === 'replace' && b.shuffle !== undefined) zones.setMode(id, { shuffle: Boolean(b.shuffle) });
    if (mode === 'replace' && zones.zone(id).shuffle && items.length > 1) {
      // Shuffle play: start with the chosen track (or a random one), then everything else in random order.
      items = shuffleKeepFirst(items, b.startIndex);
      startIndex = 0;
    }
    zones.play(id, items, { mode, startIndex });
    return zoneOf(req);
  }));
  api.post('/zones/:id/pause', cmd((id) => zones.pause(id)));
  api.post('/zones/:id/resume', cmd((id) => zones.resume(id)));
  api.post('/zones/:id/toggle', cmd((id) => zones.toggle(id)));
  api.post('/zones/:id/stop', cmd((id) => zones.stop(id)));
  api.post('/zones/:id/next', cmd((id) => zones.next(id)));
  api.post('/zones/:id/previous', cmd((id) => zones.previous(id)));
  api.post('/zones/:id/seek', cmd((id, b) => zones.seek(id, Number(b.position))));
  api.put('/zones/:id/volume', cmd((id, b) => zones.setVolume(id, Number(b.volume))));
  api.put('/zones/:id/mode', cmd((id, b) => zones.setMode(id, { repeat: b.repeat, shuffle: b.shuffle })));
  api.post('/zones/:id/bluetooth/reconnect', cmd((id) => zones.reconnectBluetooth(id)));

  api.get('/zones/:id/queue', wrap((req) => zones.getQueue(req.params.id)));
  api.post('/zones/:id/queue/jump', cmd((id, b) => zones.jump(id, Number(b.index))));
  api.post('/zones/:id/queue/move', cmd((id, b) => zones.moveQueueItem(id, Number(b.from), Number(b.to))));
  api.delete('/zones/:id/queue/:index', cmd((id, _b, req) => zones.removeQueueItem(id, Number(req.params.index))));
  api.delete('/zones/:id/queue', cmd((id) => zones.clearQueue(id)));

  // Save what a speaker has queued as a new playlist.
  api.post('/zones/:id/queue/save', wrap((req) => {
    const { items } = zones.getQueue(req.params.id);
    if (!items.length) throw badRequest('The queue is empty');
    return playlists.create(req.body?.name, items);
  }));

  // ---- saved playlists (mixed: library + YouTube + links) ----
  api.get('/playlists', wrap(() => playlists.list()));
  api.post('/playlists', wrap(async (req) => {
    const items = req.body?.items?.length ? await expandItems(req.body.items, library, playlists) : [];
    return playlists.create(req.body?.name, items);
  }));
  api.get('/playlists/:pid', wrap((req) => playlists.get(req.params.pid)));
  api.patch('/playlists/:pid', wrap((req) => playlists.rename(req.params.pid, req.body?.name)));
  api.delete('/playlists/:pid', wrap((req) => (playlists.remove(req.params.pid), ok)));
  api.post('/playlists/:pid/items', wrap(async (req) => {
    playlists.get(req.params.pid);
    const items = await expandItems(req.body?.items, library, playlists);
    return playlists.add(req.params.pid, items, req.body?.position);
  }));
  api.post('/playlists/:pid/items/move', wrap((req) => playlists.move(req.params.pid, Number(req.body?.from), Number(req.body?.to))));
  api.delete('/playlists/:pid/items/:index', wrap((req) => playlists.removeItem(req.params.pid, Number(req.params.index))));

  // ---- speaker setup (home Pi only): adapters, scan, pair, remove ----
  if (setup) {
    api.get('/setup', wrap(() => setup.status()));
    api.post('/setup/scan', wrap((req) => setup.scan(req.body?.seconds)));
    api.post('/setup/speakers', wrap((req) => setup.add({ address: req.body?.address, name: req.body?.name })));
    api.delete('/setup/speakers/:sid', wrap((req) => setup.remove(req.params.sid)));
  }

  // ---- library ----
  api.get('/library/collections', wrap(() => library.collections()));
  api.get('/library/tracks', wrap((req) => library.list({
    collection: req.query.collection,
    q: req.query.q,
    limit: Math.min(Number(req.query.limit) || 500, 100000),
    offset: Number(req.query.offset) || 0,
  })));
  api.get('/library/tracks/:tid', wrap((req) => library.get(req.params.tid)));
  api.delete('/library/tracks/:tid', wrap(async (req) => (await library.removeTrack(req.params.tid), ok)));
  api.get('/library/tracks/:tid/cover', wrap(async (req, res) => {
    const cover = await library.cover(req.params.tid);
    if (!cover) return res.status(404).end();
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.type(cover.type).send(cover.data);
  }));
  api.post('/library/upload', wrap((req) => library.handleUpload(req, req.query.collection)));
  api.post('/library/rescan', wrap(() => library.rescan()));
  api.delete('/library/collections/:name', wrap(async (req) => (await library.removeCollection(req.params.name), ok)));

  // ---- system: storage for the library disk ----
  api.get('/system', wrap(async () => {
    const st = await fs.statfs(library.dir);
    const tracks = Object.values(library.tracks);
    return {
      library: { tracks: tracks.length, bytes: tracks.reduce((n, t) => n + (t.size ?? 0), 0), collections: library.collections().length },
      disk: { total: st.blocks * st.bsize, free: st.bavail * st.bsize },
    };
  }));

  // ---- YouTube Music ----
  api.get('/youtube/status', wrap(() => youtube.status()));
  api.get('/youtube/search', wrap((req) => youtube.search(req.query.q, req.query.limit)));
  api.post('/youtube/resolve', wrap((req) => youtube.resolve(req.body?.url)));

  return api;
}

// Turns what the client sends into queue items. Accepted shapes:
//   { kind: 'track', id }            a library track
//   { kind: 'collection', name }     every track of a collection, in folder order
//   { kind: 'youtube', id, title?, artist?, duration?, artwork? }
//   { kind: 'url', url, title? }     any http(s) audio stream / file (internet radio, your own app's media)
//   { kind: 'playlist', id }         a saved playlist (may itself mix all of the above)
export async function expandItems(raw, library, playlists) {
  if (!Array.isArray(raw) || !raw.length) throw badRequest('items must be a non-empty array');
  const out = [];
  for (const it of raw) {
    switch (it?.kind) {
      case 'track':
        out.push(trackItem(await library.get(String(it.id))));
        break;
      case 'collection':
        out.push(...(await library.tracksOfCollection(String(it.name))).map(trackItem));
        break;
      case 'playlist':
        if (!playlists) throw badRequest('Playlists are not available');
        out.push(...playlists.get(String(it.id)).items.map((i) => makeItem(i)));
        break;
      case 'youtube':
        if (!/^[A-Za-z0-9_-]{11}$/.test(it.id ?? '')) throw badRequest('Invalid YouTube id');
        out.push(makeItem({
          kind: 'youtube',
          ref: it.id,
          title: str(it.title) || 'YouTube',
          artist: str(it.artist),
          album: str(it.album),
          duration: num(it.duration),
          artwork: /^https:\/\//.test(it.artwork ?? '') ? it.artwork : `https://i.ytimg.com/vi/${it.id}/hqdefault.jpg`,
        }));
        break;
      case 'url': {
        let u;
        try {
          u = new URL(String(it.url));
        } catch {
          throw badRequest('Invalid URL');
        }
        if (!/^https?:$/.test(u.protocol)) throw badRequest('Only http(s) URLs can be played');
        out.push(makeItem({ kind: 'url', ref: u.toString(), title: str(it.title) || u.hostname + u.pathname }));
        break;
      }
      default:
        throw badRequest(`Unknown item kind "${it?.kind}"`);
    }
  }
  if (out.length > 10_000) throw badRequest('Too many items');
  if (!out.length) throw badRequest('That collection is empty');
  return out;
}

function trackItem(t) {
  return makeItem({
    kind: 'track',
    ref: t.id,
    title: t.title,
    artist: t.artist,
    album: t.album,
    duration: t.duration,
    artwork: t.hasCover || t.folderArt ? `/api/library/tracks/${t.id}/cover` : null,
  });
}

function shuffleKeepFirst(items, startIndex) {
  const i = startIndex === undefined || startIndex === null ? -1 : Number(startIndex);
  const first = Number.isInteger(i) && i >= 0 && i < items.length ? items[i] : null;
  const rest = shuffled(items.filter((x) => x !== first));
  return first ? [first, ...rest] : rest;
}

const str = (v) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 300) : null);
const num = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.round(Number(v)) : null);
