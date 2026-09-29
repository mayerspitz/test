import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';
import { HttpError } from './errors.js';

// Cloud side of the link to the home Pi (cloud mode).
//
// The Pi can't accept connections from the internet, so it keeps a WebSocket open to
// the cloud (/ws/home). When the cloud needs something that lives at home — library
// browsing, uploads, audio for previews, YouTube search — it asks over that socket, and
// the Pi answers with ordinary HTTPS requests back to the cloud:
//   GET  /home/tunnel/:rid/body      the Pi downloads the request body (uploads)
//   POST /home/tunnel/:rid/response  the Pi streams the response (status + headers + body)
// Everything the Pi sends is authenticated with the same token as everything else.
//
// Messages over the socket:
//   cloud -> home  {type:'request', rid, method, path, headers, hasBody}
//                  {type:'state-save', state}        backup of speakers/queues (free hosting forgets)
//   home -> cloud  {type:'hello', state}             sent on connect, with the last backup
//                  {type:'library-changed'}
//                  {type:'request-failed', rid, error}
export class HomeTunnel extends EventEmitter {
  constructor({ log, timeoutMs = 60_000 }) {
    super();
    this.log = log;
    this.timeoutMs = timeoutMs;
    this.ws = null;
    this.pending = new Map();
    this.lastSeen = null;
  }

  get online() {
    return Boolean(this.ws && this.ws.readyState === this.ws.OPEN);
  }

  attach(ws, address) {
    if (this.ws && this.ws !== ws) this.ws.close(4001, 'Replaced by a newer connection');
    this.ws = ws;
    this.lastSeen = Date.now();
    this.log.info(`Home Pi connected from ${address}`);
    ws.on('message', (data) => {
      let msg;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return;
      }
      this.lastSeen = Date.now();
      if (msg.type === 'hello') this.emit('hello', msg);
      else if (msg.type === 'library-changed') this.emit('library-changed');
      else if (msg.type === 'forget-zone') this.emit('forget-zone', msg.id);
      else if (msg.type === 'request-failed') this.#fail(msg.rid, new HttpError(502, `Home Pi: ${msg.error}`));
    });
    ws.on('close', () => {
      if (this.ws !== ws) return;
      this.ws = null;
      this.lastSeen = Date.now();
      this.log.warn('Home Pi disconnected');
      for (const rid of [...this.pending.keys()]) this.#fail(rid, new HttpError(503, 'The home Pi went offline'));
      this.emit('offline');
    });
    this.emit('online');
  }

  send(msg) {
    if (this.online) this.ws.send(JSON.stringify(msg));
  }

  // Ask the home Pi to perform an HTTP request against its local hub.
  // Resolves with { status, headers, stream } once the Pi starts answering.
  request({ method = 'GET', path, headers = {}, body = null }) {
    if (!this.online) return Promise.reject(new HttpError(503, 'The home Pi is offline — library, uploads and previews come back when it reconnects'));
    const rid = crypto.randomBytes(12).toString('hex');
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => this.#fail(rid, new HttpError(504, 'The home Pi did not answer in time')), this.timeoutMs);
      this.pending.set(rid, { resolve, reject, body, timer });
      this.send({ type: 'request', rid, method, path, headers, hasBody: Boolean(body) });
    });
  }

  async fetchJson(path, init = {}) {
    const r = await this.request({ path, ...init });
    const chunks = [];
    for await (const c of r.stream) chunks.push(c);
    const text = Buffer.concat(chunks).toString('utf8');
    let data = null;
    try {
      data = JSON.parse(text);
    } catch { /* not JSON */ }
    return { status: r.status, data };
  }

  // Express middleware: send this client request to the home Pi and relay the answer.
  forward = async (req, res) => {
    const headers = {};
    for (const h of ['range', 'content-type', 'content-length', 'accept']) if (req.headers[h]) headers[h] = req.headers[h];
    const hasBody = !['GET', 'HEAD'].includes(req.method);
    try {
      const url = new URL(req.originalUrl, 'http://home');
      url.searchParams.delete('token'); // the Pi's local hub has its own auth
      const r = await this.request({ method: req.method, path: url.pathname + url.search, headers, body: hasBody ? req : null });
      res.status(r.status);
      for (const [k, v] of Object.entries(r.headers)) res.setHeader(k, v);
      res.on('close', () => r.stream.destroy());
      r.stream.pipe(res);
    } catch (err) {
      if (!res.headersSent) res.status(err.status ?? 502).json({ error: err.message });
      else res.destroy();
    }
  };

  // The Pi's side-channel HTTP requests.
  handleBodyRequest = (req, res) => {
    const p = this.pending.get(req.params.rid);
    if (!p || !p.body) return res.status(404).end();
    const body = p.body;
    p.body = null;
    if (Buffer.isBuffer(body)) res.end(body);
    else body.pipe(res);
  };

  handleResponse = (req, res) => {
    const p = this.pending.get(req.params.rid);
    if (!p) return res.status(404).end();
    this.pending.delete(req.params.rid);
    clearTimeout(p.timer);
    let headers = {};
    try {
      headers = JSON.parse(req.headers['x-tunnel-headers'] ?? '{}');
    } catch { /* ignore */ }
    req.on('end', () => res.status(204).end());
    req.on('close', () => {
      if (!res.headersSent) res.status(204).end();
    });
    p.resolve({ status: Number(req.headers['x-tunnel-status']) || 502, headers, stream: req });
  };

  #fail(rid, err) {
    const p = this.pending.get(rid);
    if (!p) return;
    this.pending.delete(rid);
    clearTimeout(p.timer);
    p.reject(err);
  }
}

// Stand-in for the local Library when the music lives on the home Pi.
export class RemoteLibrary extends EventEmitter {
  constructor(tunnel) {
    super();
    this.tunnel = tunnel;
    tunnel.on('library-changed', () => this.emit('changed'));
    tunnel.on('online', () => this.emit('changed'));
  }

  async #json(path) {
    const r = await this.tunnel.fetchJson(path);
    if (r.status !== 200) throw new HttpError(r.status, r.data?.error ?? `Home Pi answered ${r.status}`);
    return r.data;
  }

  get(id) {
    return this.#json(`/api/library/tracks/${encodeURIComponent(id)}`);
  }

  async tracksOfCollection(name) {
    return (await this.#json(`/api/library/tracks?collection=${encodeURIComponent(name)}&limit=100000`)).items;
  }

  flush() {}
}
