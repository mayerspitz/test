// The home Pi in cloud mode. One process that:
//   1. keeps the music library on the local SSD and serves it on 127.0.0.1 (a local hub),
//   2. keeps a connection to the cloud app and answers its requests (library, uploads,
//      previews, YouTube — fetched from the home internet connection, which YouTube accepts),
//   3. keeps the cloud's backup of speakers and queues (free hosting forgets on restart),
//   4. drives every speaker: one player + one Bluetooth link per USB adapter,
//   5. pings the cloud every 10 minutes so the free Render service doesn't fall asleep.
//
//   node src/home.js --config /etc/multiroom/home.json
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';
import { Agent } from '../../agent/src/agent.js';
import { BluetoothLink } from '../../agent/src/bluetooth.js';
import { MpvPlayer } from '../../agent/src/mpv.js';
import { SimulatedBluetooth, SimulatedPlayer } from '../../agent/src/simulated.js';
import { createLogger } from './log.js';
import { createHub } from './server.js';

const PASS_HEADERS = ['content-type', 'content-length', 'content-range', 'accept-ranges', 'cache-control'];

export class HomeClient {
  constructor({ cloud, token, localBase, stateFile, log, keepAliveMs = 10 * 60_000 }) {
    this.cloud = cloud.replace(/\/+$/, '');
    this.token = token;
    this.localBase = localBase;
    this.stateFile = stateFile;
    this.log = log;
    this.keepAliveMs = keepAliveMs;
    this.delay = 1000;
    this.closed = false;
    this.auth = token ? { Authorization: `Bearer ${token}` } : {};
  }

  start() {
    this.connect();
    // Render's free plan sleeps after ~15 minutes without incoming requests.
    this.keepAlive = setInterval(() => fetch(`${this.cloud}/api/health`).catch(() => {}), this.keepAliveMs);
  }

  connect() {
    if (this.closed) return;
    const ws = new WebSocket(`${this.cloud.replace(/^http/, 'ws')}/ws/home`, { headers: this.auth, handshakeTimeout: 15_000 });
    this.ws = ws;
    ws.on('open', () => {
      this.delay = 1000;
      this.log.info(`Connected to the cloud app at ${this.cloud}`);
      ws.send(JSON.stringify({ type: 'hello', state: this.readState() }));
    });
    ws.on('message', (data) => {
      let msg;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return;
      }
      if (msg.type === 'request') this.handle(msg).catch((err) => this.send({ type: 'request-failed', rid: msg.rid, error: err.message }));
      else if (msg.type === 'state-save') this.writeState(msg.state);
    });
    ws.on('unexpected-response', (_req, res) => this.log.error(`Cloud refused the connection (HTTP ${res.statusCode}) — check the password/token`));
    ws.on('error', (err) => this.log.warn(`Cloud connection: ${err.message}`));
    ws.on('close', () => {
      if (this.closed) return;
      const wait = this.delay + Math.random() * 1000;
      this.delay = Math.min(this.delay * 2, 30_000);
      setTimeout(() => this.connect(), wait);
    });
  }

  send(msg) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  // Perform the cloud's request against the local hub and stream the answer back.
  async handle({ rid, method, path: p, headers, hasBody }) {
    let body;
    if (hasBody) {
      const r = await fetch(`${this.cloud}/home/tunnel/${rid}/body`, { headers: this.auth });
      if (!r.ok) throw new Error(`could not download the request body (${r.status})`);
      body = r.body;
    }
    const local = await fetch(`${this.localBase}${p}`, { method, headers, body, duplex: 'half', redirect: 'manual' });
    const out = {};
    for (const h of PASS_HEADERS) {
      const v = local.headers.get(h);
      if (v) out[h] = v;
    }
    await fetch(`${this.cloud}/home/tunnel/${rid}/response`, {
      method: 'POST',
      headers: { ...this.auth, 'Content-Type': 'application/octet-stream', 'X-Tunnel-Status': String(local.status), 'X-Tunnel-Headers': JSON.stringify(out) },
      body: local.body ?? Readable.toWeb(Readable.from([])),
      duplex: 'half',
    });
  }

  readState() {
    try {
      return JSON.parse(fs.readFileSync(this.stateFile, 'utf8'));
    } catch {
      return null;
    }
  }

  writeState(state) {
    const tmp = `${this.stateFile}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(state));
    fs.renameSync(tmp, this.stateFile);
  }

  close() {
    this.closed = true;
    clearInterval(this.keepAlive);
    this.ws?.close();
  }
}

export async function startHome(cfg, { log = createLogger(false) } = {}) {
  const dataDir = path.resolve(cfg.dataDir ?? '/srv/multiroom');
  // The local hub only serves this Pi (library, media, YouTube); control lives in the cloud.
  const local = await createHub({ dataDir, port: cfg.localPort ?? 8090, host: '127.0.0.1', token: '', quiet: true, ytdlpArgs: cfg.ytdlpArgs });
  const localBase = `http://127.0.0.1:${local.port}`;
  const client = new HomeClient({ cloud: cfg.cloud, token: cfg.token, localBase, stateFile: path.join(dataDir, 'cloud-state.json'), log, keepAliveMs: cfg.keepAliveMs });
  local.library.on('changed', () => client.send({ type: 'library-changed' }));
  client.start();

  const agents = [];
  for (const sp of cfg.speakers ?? []) {
    const alog = createLogger(false);
    const player = sp.player?.type === 'simulated'
      ? new SimulatedPlayer()
      : new MpvPlayer({ bin: sp.player?.mpvPath ?? 'mpv', zoneId: sp.zone.id, audioDevice: sp.player?.audioDevice && sp.player.audioDevice !== 'auto' ? sp.player.audioDevice : null, extraArgs: sp.player?.extraArgs ?? [], log: alog });
    let bluetooth = null;
    if (sp.bluetooth?.type === 'simulated') bluetooth = new SimulatedBluetooth(sp.bluetooth);
    else if (sp.bluetooth?.speaker) bluetooth = new BluetoothLink({ adapter: 'hci0', autoReconnect: true, pollSeconds: 5, lockSinkVolume: true, ...sp.bluetooth, speaker: sp.bluetooth.speaker.toUpperCase() }, alog);
    const agentCfg = {
      hub: cfg.cloud,
      token: cfg.token,
      mediaBase: localBase,
      zone: sp.zone,
      bluetooth: sp.bluetooth ? { pauseWhenDisconnected: true, ...sp.bluetooth } : null,
      player: { audioDevice: 'auto', ...sp.player },
    };
    const agent = new Agent({ cfg: agentCfg, player, bluetooth, log: alog });
    await agent.start();
    agents.push(agent);
  }
  log.info(`Home Pi running: ${agents.length} speaker(s), music in ${local.config.libraryDir}, cloud ${cfg.cloud}`);

  return {
    local,
    client,
    agents,
    async stop() {
      client.close();
      for (const a of agents) await a.stop().catch(() => {});
      await local.close();
    },
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf('--config');
  const file = i >= 0 ? process.argv[i + 1] : process.env.MULTIROOM_HOME_CONFIG ?? '/etc/multiroom/home.json';
  const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!cfg.cloud) throw new Error(`"cloud" (the cloud app address) is missing in ${file}`);
  const home = await startHome(cfg);
  for (const sig of ['SIGINT', 'SIGTERM']) {
    process.on(sig, async () => {
      await home.stop();
      process.exit(0);
    });
  }
}
