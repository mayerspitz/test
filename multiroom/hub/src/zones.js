import { EventEmitter } from 'node:events';
import * as Q from './queue.js';
import { badRequest, HttpError, notFound } from './errors.js';

export const ZONE_ID_RE = /^[a-z0-9][a-z0-9_-]{0,39}$/;

// A zone = one speaker. The hub owns each zone's queue, play state and volume;
// the bridge ("agent") that drives the speaker is a thin player that follows orders.
//
// Hub -> agent messages: load, sync, pause, resume, stop, seek, volume, bt-reconnect
// Agent -> hub messages: hello, status, ended, restarted
export class ZoneManager extends EventEmitter {
  constructor({ store, mediaUrl, log }) {
    super();
    this.store = store;
    this.mediaUrl = mediaUrl;
    this.log = log;
    this.runtime = new Map();
    store.data.zones ??= {};
    for (const z of Object.values(this.zones)) this.#normalize(z);
    // Position ticks are not persisted one by one; save them every 30 s while something plays.
    this.saveTimer = setInterval(() => {
      if (Object.values(this.zones).some((z) => z.state === 'playing')) this.store.save();
    }, 30_000);
    this.saveTimer.unref();
  }

  get zones() {
    return this.store.data.zones;
  }

  #normalize(z) {
    z.name ||= z.id;
    z.order ??= Object.keys(this.zones).length;
    z.volume = clampVolume(z.volume ?? 40);
    z.queue ??= [];
    z.index ??= z.queue.length ? 0 : -1;
    z.repeat = Q.REPEAT_MODES.includes(z.repeat) ? z.repeat : 'off';
    z.shuffle = Boolean(z.shuffle);
    z.state ??= 'stopped';
    z.position ??= 0;
    z.duration ??= null;
    z.queueVersion ??= 1;
    return z;
  }

  zone(id) {
    const z = this.zones[id];
    if (!z) throw notFound(`Speaker "${id}"`);
    return z;
  }

  rt(id) {
    let r = this.runtime.get(id);
    if (!r) {
      r = { agent: null, agentInfo: null, player: null, bluetooth: null, lastSeen: null, error: null, errorStreak: 0, positionAt: Date.now() };
      this.runtime.set(id, r);
    }
    return r;
  }

  list() {
    return Object.values(this.zones)
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
      .map((z) => this.publicZone(z.id));
  }

  publicZone(id) {
    const z = this.zone(id);
    const r = this.rt(id);
    const cur = Q.current(z);
    const actuallyPlaying = z.state === 'playing' && r.player?.state === 'playing' && r.player?.uid === cur?.uid;
    const duration = z.duration ?? cur?.duration ?? null;
    let position = z.position + (actuallyPlaying ? (Date.now() - r.positionAt) / 1000 : 0);
    if (duration) position = Math.min(position, duration);
    const nextIdx = Q.nextIndex(z, false);
    return {
      id: z.id,
      name: z.name,
      volume: z.volume,
      repeat: z.repeat,
      shuffle: z.shuffle,
      state: z.state, // what the hub wants: playing | paused | stopped
      playback: r.agent ? r.player?.state ?? null : null, // what the bridge reports: playing | paused | loading | idle
      position: Math.max(0, position),
      duration,
      index: z.index,
      queueLength: z.queue.length,
      queueVersion: z.queueVersion,
      current: cur,
      next: nextIdx >= 0 && nextIdx !== z.index ? z.queue[nextIdx] : null,
      streamTitle: cur?.kind === 'url' && r.player?.uid === cur.uid ? r.player?.title ?? null : null,
      online: Boolean(r.agent),
      lastSeen: r.lastSeen,
      speaker: r.bluetooth, // { configured, paired, connected, name, address, battery, message }
      bridge: r.agentInfo,
      error: r.error,
    };
  }

  // ---- bridge connections -------------------------------------------------

  attachAgent(hello, handle) {
    const id = String(hello.zone?.id ?? '').toLowerCase();
    if (!ZONE_ID_RE.test(id)) throw badRequest('Zone id must be 1-40 chars of a-z, 0-9, - or _');
    if (!this.zones[id]) {
      const order = Math.max(-1, ...Object.values(this.zones).map((z) => z.order)) + 1;
      this.zones[id] = this.#normalize({ id, name: String(hello.zone.name || id).slice(0, 60), order });
      this.log.info(`New speaker registered: ${id}`);
    }
    const r = this.rt(id);
    if (r.agent && r.agent !== handle) r.agent.close(4001, 'Replaced by a newer connection');
    r.agent = handle;
    r.agentInfo = { host: hello.host ?? null, version: hello.version ?? null, player: hello.playerType ?? null, address: handle.address ?? null };
    r.lastSeen = Date.now();
    r.bluetooth = hello.bluetooth ?? null;
    r.player = hello.player ?? null;
    this.#reconcile(id, hello);
    this.#changed(id);
    return id;
  }

  detachAgent(id, handle) {
    const r = this.runtime.get(id);
    if (!r || r.agent !== handle) return;
    r.agent = null;
    r.player = null;
    r.lastSeen = Date.now();
    if (this.zones[id]) this.#changed(id, { persist: false });
  }

  handleAgentMessage(id, msg) {
    if (!this.zones[id]) return;
    this.rt(id).lastSeen = Date.now();
    if (msg.type === 'status') this.#onStatus(id, msg);
    else if (msg.type === 'ended') this.#onEnded(id, msg);
    else if (msg.type === 'restarted' && this.zone(id).state !== 'stopped') this.#load(id);
  }

  // After a bridge (re)connects, bring it in line with the hub without
  // interrupting a track it is already playing.
  #reconcile(id, hello) {
    const z = this.zone(id);
    const r = this.rt(id);
    const cur = Q.current(z);
    const p = hello.player ?? {};
    this.#send(id, { type: 'volume', value: z.volume });
    if (!cur || z.state === 'stopped') {
      if (p.state && p.state !== 'idle') this.#send(id, { type: 'stop' });
      return;
    }
    if (hello.lastEnded?.uid === cur.uid && (!p.state || p.state === 'idle')) {
      this.#onEnded(id, hello.lastEnded);
      return;
    }
    if (p.uid === cur.uid && p.state && p.state !== 'idle') {
      if (Number.isFinite(p.position)) {
        z.position = p.position;
        r.positionAt = Date.now();
      }
      this.#send(id, { type: 'sync', paused: z.state === 'paused' });
      return;
    }
    this.#load(id);
  }

  #onStatus(id, msg) {
    const z = this.zone(id);
    const r = this.rt(id);
    if (msg.bluetooth !== undefined) r.bluetooth = msg.bluetooth;
    if (msg.player) {
      r.player = msg.player;
      const cur = Q.current(z);
      if (cur && msg.player.uid === cur.uid) {
        if (Number.isFinite(msg.player.position)) {
          z.position = msg.player.position;
          r.positionAt = Date.now();
        }
        if (Number.isFinite(msg.player.duration) && msg.player.duration > 0) {
          z.duration = msg.player.duration;
          if (!cur.duration && cur.kind !== 'url') cur.duration = Math.round(msg.player.duration);
        }
        if (msg.player.state === 'playing') {
          r.errorStreak = 0;
          r.error = null;
        }
      }
    }
    this.#changed(id, { persist: false });
  }

  #onEnded(id, { uid, reason, error }) {
    const z = this.zone(id);
    const r = this.rt(id);
    const cur = Q.current(z);
    if (!cur || cur.uid !== uid || z.state === 'stopped') return;
    if (reason !== 'error') {
      r.errorStreak = 0;
      this.#advance(id, true);
      return;
    }
    r.errorStreak += 1;
    r.error = `Couldn't play "${cur.title}"${error ? `: ${error}` : ''}`;
    this.log.warn(`[${id}] ${r.error}`);
    if (r.errorStreak >= Math.min(z.queue.length, 5)) {
      z.state = 'stopped';
      z.position = 0;
      this.#changed(id);
      return;
    }
    // Skip the broken item after a short pause so a dead source can't spin.
    this.#changed(id, { persist: false });
    setTimeout(() => {
      if (this.zones[id] === z && Q.current(z)?.uid === uid && z.state !== 'stopped') this.#advance(id, true);
    }, 1000).unref();
  }

  #advance(id, auto) {
    const z = this.zone(id);
    const idx = Q.nextIndex(z, auto);
    if (idx < 0) {
      z.state = 'stopped';
      z.position = 0;
      z.duration = null;
      z.index = z.queue.length ? 0 : -1;
      this.#send(id, { type: 'stop' });
      this.#changed(id);
      return;
    }
    const wrapped = idx === 0 && z.index === z.queue.length - 1 && idx !== z.index;
    z.index = idx;
    if (wrapped && z.shuffle && z.queue.length > 1) {
      z.queue = Q.shuffled(z.queue);
      z.queueVersion += 1;
    }
    this.#startCurrent(id);
  }

  #startCurrent(id, position = 0) {
    const z = this.zone(id);
    z.state = 'playing';
    z.position = position;
    z.duration = Q.current(z)?.duration ?? null;
    this.#load(id);
    this.#changed(id);
  }

  #load(id) {
    const z = this.zone(id);
    const cur = Q.current(z);
    if (!cur) return;
    this.rt(id).positionAt = Date.now();
    this.#send(id, {
      type: 'load',
      item: { uid: cur.uid, url: this.mediaUrl(cur), title: cur.title, artist: cur.artist, duration: cur.duration },
      position: z.position,
      paused: z.state === 'paused',
    });
  }

  #send(id, msg) {
    this.rt(id).agent?.send(msg);
  }

  #changed(id, { persist = true } = {}) {
    if (persist) this.store.save();
    this.emit('zone', id);
  }

  #bumpQueue(z) {
    z.queueVersion += 1;
  }

  // ---- commands (called by the REST API) ----------------------------------

  play(id, items, { mode = 'replace', startIndex = 0 } = {}) {
    const z = this.zone(id);
    if (!items.length) throw badRequest('Nothing to play');
    const wasEmpty = !Q.current(z);
    if (mode === 'replace') {
      Q.setQueue(z, items, startIndex);
      this.#bumpQueue(z);
      this.#startCurrent(id);
      return;
    }
    if (mode === 'now') {
      // Play immediately but keep the rest of the queue: insert after the current item and jump to it.
      Q.insertNext(z, items);
      if (!wasEmpty) z.index += 1;
      this.#bumpQueue(z);
      this.#startCurrent(id);
      return;
    }
    if (mode === 'next') Q.insertNext(z, items);
    else if (mode === 'append') Q.append(z, items);
    else throw badRequest('mode must be replace, now, next or append');
    this.#bumpQueue(z);
    if (wasEmpty) this.#startCurrent(id);
    else this.#changed(id);
  }

  pause(id) {
    const z = this.zone(id);
    if (z.state !== 'playing') return;
    z.state = 'paused';
    z.position = this.publicZone(id).position;
    this.#send(id, { type: 'pause' });
    this.#changed(id);
  }

  resume(id) {
    const z = this.zone(id);
    const r = this.rt(id);
    const cur = Q.current(z);
    if (!cur) throw badRequest('The queue is empty — choose something to play');
    if (z.state === 'playing') return;
    const loaded = r.player?.uid === cur.uid && r.player?.state && r.player.state !== 'idle';
    z.state = 'playing';
    r.positionAt = Date.now();
    if (loaded) this.#send(id, { type: 'resume' });
    else this.#load(id);
    this.#changed(id);
  }

  toggle(id) {
    if (this.zone(id).state === 'playing') this.pause(id);
    else this.resume(id);
  }

  stop(id) {
    const z = this.zone(id);
    z.state = 'stopped';
    z.position = 0;
    this.#send(id, { type: 'stop' });
    this.#changed(id);
  }

  next(id) {
    if (!this.zone(id).queue.length) return;
    this.#advance(id, false);
  }

  previous(id) {
    const z = this.zone(id);
    const idx = Q.previousIndex(z, this.publicZone(id).position);
    if (idx < 0) return;
    z.index = idx;
    this.#startCurrent(id);
  }

  jump(id, index) {
    const z = this.zone(id);
    if (!Number.isInteger(index) || index < 0 || index >= z.queue.length) throw badRequest('No such queue position');
    z.index = index;
    this.#startCurrent(id);
  }

  seek(id, position) {
    const z = this.zone(id);
    const r = this.rt(id);
    const cur = Q.current(z);
    if (!cur) return;
    if (!Number.isFinite(position) || position < 0) throw badRequest('position must be seconds >= 0');
    z.position = position;
    r.positionAt = Date.now();
    if (z.state === 'stopped') z.state = 'paused';
    if (r.player?.uid === cur.uid && r.player?.state !== 'idle') this.#send(id, { type: 'seek', position });
    else this.#load(id);
    this.#changed(id);
  }

  setVolume(id, volume) {
    const z = this.zone(id);
    if (!Number.isFinite(volume)) throw badRequest('volume must be a number 0-100');
    z.volume = clampVolume(volume);
    this.#send(id, { type: 'volume', value: z.volume });
    this.#changed(id);
  }

  setMode(id, { repeat, shuffle }) {
    const z = this.zone(id);
    if (repeat !== undefined) {
      if (!Q.REPEAT_MODES.includes(repeat)) throw badRequest('repeat must be off, all or one');
      z.repeat = repeat;
    }
    if (shuffle !== undefined) {
      const turnOn = Boolean(shuffle) && !z.shuffle;
      z.shuffle = Boolean(shuffle);
      if (turnOn && z.queue.length > 1) {
        Q.shuffleUpcoming(z);
        this.#bumpQueue(z);
      }
    }
    this.#changed(id);
  }

  getQueue(id) {
    const z = this.zone(id);
    return { index: z.index, queueVersion: z.queueVersion, items: z.queue };
  }

  removeQueueItem(id, index) {
    const z = this.zone(id);
    if (!Number.isInteger(index) || index < 0 || index >= z.queue.length) throw badRequest('No such queue position');
    const wasCurrent = Q.removeAt(z, index);
    this.#bumpQueue(z);
    if (wasCurrent) {
      if (!Q.current(z)) this.stop(id);
      else if (z.state !== 'stopped') this.#startCurrent(id);
      else this.#changed(id);
    } else {
      this.#changed(id);
    }
  }

  moveQueueItem(id, from, to) {
    const z = this.zone(id);
    Q.move(z, from, to);
    this.#bumpQueue(z);
    this.#changed(id);
  }

  clearQueue(id) {
    const z = this.zone(id);
    z.queue = [];
    z.index = -1;
    z.duration = null;
    this.#bumpQueue(z);
    this.stop(id);
  }

  rename(id, name) {
    const z = this.zone(id);
    const clean = String(name ?? '').trim().slice(0, 60);
    if (!clean) throw badRequest('Name cannot be empty');
    z.name = clean;
    this.#changed(id);
  }

  remove(id) {
    this.zone(id);
    if (this.rt(id).agent) throw new HttpError(409, 'This speaker\'s bridge is online; stop it before removing the speaker');
    delete this.zones[id];
    this.runtime.delete(id);
    this.store.save();
    this.emit('removed', id);
  }

  reconnectBluetooth(id) {
    this.zone(id);
    const r = this.rt(id);
    if (!r.agent) throw new HttpError(409, 'The bridge for this speaker is offline');
    r.agent.send({ type: 'bt-reconnect' });
  }

  pauseAll() {
    for (const id of Object.keys(this.zones)) this.pause(id);
  }

  stopAll() {
    for (const id of Object.keys(this.zones)) if (this.zones[id].state !== 'stopped') this.stop(id);
  }

  // Cloud mode: bring back speakers and queues from the home Pi's backup after the
  // cloud service restarted with an empty disk.
  restore(data) {
    this.store.data.zones = structuredClone(data?.zones ?? {});
    for (const z of Object.values(this.zones)) this.#normalize(z);
    this.store.save();
    for (const id of Object.keys(this.zones)) this.emit('zone', id);
    this.log.info(`Restored ${Object.keys(this.zones).length} speakers from the home Pi's backup`);
  }

  close() {
    clearInterval(this.saveTimer);
  }
}

function clampVolume(v) {
  return Math.round(Math.min(100, Math.max(0, Number(v) || 0)));
}
