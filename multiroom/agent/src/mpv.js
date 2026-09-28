import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

const OBSERVED = ['pause', 'time-pos', 'duration', 'idle-active', 'media-title', 'paused-for-cache', 'volume'];

// Drives one long-running mpv process over its JSON IPC socket.
// Volume is mpv's own software volume: the audio is scaled before it leaves
// this device, so the speaker's hardware volume is never touched.
//
// Events: status (something changed), loaded (uid), ended ({ uid, reason, error }), restarted
export class MpvPlayer extends EventEmitter {
  constructor({ bin = 'mpv', zoneId, audioDevice = null, extraArgs = [], volume = 40, log }) {
    super();
    this.bin = bin;
    this.zoneId = zoneId;
    this.audioDevice = audioDevice;
    this.extraArgs = extraArgs;
    this.volume = volume;
    this.log = log;
    this.sock = path.join(os.tmpdir(), `multiroom-mpv-${zoneId}-${process.pid}.sock`);
    this.requests = new Map();
    this.nextRequestId = 1;
    this.stopping = false;
    this.#reset();
  }

  #reset() {
    this.ready = false;
    this.props = {};
    this.pending = []; // uids of loadfile calls whose start-file event hasn't arrived yet
    this.activeUid = null;
    this.loaded = false;
    this.startAt = 0;
    this.title = null;
  }

  get type() {
    return 'mpv';
  }

  async start() {
    this.stopping = false;
    await this.#spawn();
  }

  async #spawn() {
    fs.rmSync(this.sock, { force: true });
    const args = [
      '--idle=yes',
      '--no-config',
      '--no-terminal',
      '--no-video',
      '--audio-display=no',
      '--ytdl=no',
      '--load-scripts=no',
      '--keep-open=no',
      '--cache=yes',
      '--network-timeout=20',
      '--replaygain=track',
      '--volume-max=100',
      `--volume=${this.volume}`,
      `--audio-client-name=multiroom-${this.zoneId}`,
      `--input-ipc-server=${this.sock}`,
      ...(this.audioDevice ? [`--audio-device=${this.audioDevice}`] : []),
      ...this.extraArgs,
    ];
    const proc = spawn(this.bin, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    this.proc = proc;
    let stderrTail = '';
    proc.stderr.on('data', (d) => {
      stderrTail = (stderrTail + d.toString()).slice(-2000);
    });
    proc.on('error', (err) => {
      this.log.error(err.code === 'ENOENT' ? `mpv not found ("${this.bin}"). Install it: sudo apt install mpv` : `mpv: ${err.message}`);
    });
    proc.on('exit', (code, signal) => {
      if (this.proc !== proc) return;
      this.conn?.destroy();
      for (const { reject } of this.requests.values()) reject(new Error('mpv exited'));
      this.requests.clear();
      this.#reset();
      if (this.stopping) return;
      this.log.warn(`mpv exited (${signal ?? code}); restarting in 2 s. ${stderrTail.trim().split('\n').pop() ?? ''}`);
      this.emit('status');
      setTimeout(() => this.#spawn().then(() => this.emit('restarted')).catch((e) => this.log.error(e.message)), 2000).unref();
    });
    await this.#connect(proc);
  }

  async #connect(proc) {
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      if (this.proc !== proc || proc.exitCode !== null) return;
      try {
        await new Promise((resolve, reject) => {
          const conn = net.connect(this.sock);
          conn.once('connect', () => {
            this.conn = conn;
            resolve();
          });
          conn.once('error', reject);
        });
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    if (!this.conn || this.conn.destroyed) throw new Error('Could not connect to mpv IPC socket');
    let buf = '';
    this.conn.setEncoding('utf8');
    this.conn.on('data', (chunk) => {
      buf += chunk;
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl);
        buf = buf.slice(nl + 1);
        if (line.trim()) {
          try {
            this.#onMessage(JSON.parse(line));
          } catch { /* ignore malformed line */ }
        }
      }
    });
    this.conn.on('error', () => {});
    for (const [i, name] of OBSERVED.entries()) await this.command(['observe_property', i + 1, name]);
    this.ready = true;
    this.emit('status');
  }

  command(args) {
    return new Promise((resolve, reject) => {
      if (!this.conn || this.conn.destroyed) {
        reject(new Error('mpv is not running'));
        return;
      }
      const id = this.nextRequestId++;
      const timer = setTimeout(() => {
        this.requests.delete(id);
        reject(new Error(`mpv command timed out: ${args[0]}`));
      }, 10_000);
      this.requests.set(id, {
        resolve: (v) => (clearTimeout(timer), resolve(v)),
        reject: (e) => (clearTimeout(timer), reject(e)),
      });
      this.conn.write(`${JSON.stringify({ command: args, request_id: id })}\n`);
    });
  }

  #onMessage(m) {
    if (m.request_id !== undefined && this.requests.has(m.request_id)) {
      const req = this.requests.get(m.request_id);
      this.requests.delete(m.request_id);
      if (m.error === 'success') req.resolve(m.data);
      else req.reject(new Error(m.error));
      return;
    }
    switch (m.event) {
      case 'property-change':
        this.props[m.name] = m.data;
        if (m.name === 'media-title') this.title = m.data ?? null;
        this.emit('status');
        break;
      case 'start-file':
        this.activeUid = this.pending.shift() ?? null;
        this.loaded = false;
        this.emit('status');
        break;
      case 'file-loaded':
        this.loaded = true;
        this.#afterLoad(this.activeUid);
        break;
      case 'end-file': {
        const uid = this.activeUid;
        this.activeUid = null;
        this.loaded = false;
        if (uid && (m.reason === 'eof' || m.reason === 'error')) {
          this.emit('ended', { uid, reason: m.reason, error: m.file_error ?? null });
        }
        this.emit('status');
        break;
      }
      default:
    }
  }

  async #afterLoad(uid) {
    const startAt = this.startAt;
    this.startAt = 0;
    if (startAt > 0.5) await this.command(['seek', startAt, 'absolute']).catch(() => {});
    this.emit('loaded', uid);
    this.emit('status');
  }

  // Loads a URL paused; the agent unpauses once it is loaded (and the speaker is ready).
  async load({ uid, url, startAt = 0, headers = [] }) {
    await this.command(['set_property', 'pause', true]);
    await this.command(['set_property', 'http-header-fields', headers]);
    this.startAt = startAt;
    this.pending.push(uid);
    try {
      await this.command(['loadfile', url, 'replace']);
    } catch (err) {
      this.pending = this.pending.filter((u) => u !== uid);
      this.emit('ended', { uid, reason: 'error', error: err.message });
    }
  }

  setPaused(paused) {
    return this.command(['set_property', 'pause', Boolean(paused)]).catch(() => {});
  }

  seek(position) {
    return this.command(['seek', position, 'absolute']).catch(() => {});
  }

  stop() {
    this.pending = [];
    return this.command(['stop']).catch(() => {});
  }

  setVolume(volume) {
    this.volume = volume;
    return this.command(['set_property', 'volume', volume]).catch(() => {});
  }

  setAudioDevice(device) {
    if (!device || device === this.audioDevice) return Promise.resolve();
    this.audioDevice = device;
    return this.command(['set_property', 'audio-device', device]).catch((e) => this.log.warn(`audio-device: ${e.message}`));
  }

  status() {
    let state = 'idle';
    if (this.ready && this.activeUid && !this.props['idle-active']) {
      if (!this.loaded) state = 'loading';
      else if (this.props.pause) state = 'paused';
      else if (this.props['paused-for-cache']) state = 'loading';
      else state = 'playing';
    }
    return {
      state,
      uid: state === 'idle' ? null : this.activeUid,
      position: typeof this.props['time-pos'] === 'number' ? this.props['time-pos'] : null,
      duration: typeof this.props.duration === 'number' ? this.props.duration : null,
      volume: typeof this.props.volume === 'number' ? Math.round(this.props.volume) : this.volume,
      title: this.title,
    };
  }

  async stopProcess() {
    this.stopping = true;
    try {
      await this.command(['quit']);
    } catch {
      this.proc?.kill();
    }
    fs.rmSync(this.sock, { force: true });
  }
}
