import { EventEmitter } from 'node:events';
import WebSocket from 'ws';

// Persistent WebSocket to the hub with automatic reconnect (1 s .. 30 s backoff).
export class HubLink extends EventEmitter {
  constructor({ hubUrl, token, log, hello }) {
    super();
    this.wsUrl = `${hubUrl.replace(/\/+$/, '').replace(/^http/, 'ws')}/ws/agent`;
    this.token = token;
    this.log = log;
    this.hello = hello;
    this.delay = 1000;
    this.closed = false;
    this.connected = false;
  }

  connect() {
    if (this.closed) return;
    const ws = new WebSocket(this.wsUrl, {
      headers: this.token ? { Authorization: `Bearer ${this.token}` } : {},
      handshakeTimeout: 10_000,
    });
    this.ws = ws;
    let lastPing = Date.now();
    const watchdog = setInterval(() => {
      if (Date.now() - lastPing > 60_000) ws.terminate(); // hub vanished without closing
    }, 10_000);
    ws.on('ping', () => (lastPing = Date.now()));
    ws.on('open', () => {
      lastPing = Date.now();
      this.delay = 1000;
      this.connected = true;
      ws.send(JSON.stringify(this.hello()));
    });
    ws.on('message', (data) => {
      lastPing = Date.now();
      try {
        this.emit('message', JSON.parse(data.toString()));
      } catch { /* ignore */ }
    });
    ws.on('unexpected-response', (_req, res) => {
      this.log.error(res.statusCode === 401 ? 'Hub rejected the access token (check "token")' : `Hub answered HTTP ${res.statusCode}`);
    });
    ws.on('error', (err) => {
      if (!this.lastError || this.lastError !== err.message) this.log.warn(`Hub connection: ${err.message}`);
      this.lastError = err.message;
    });
    ws.on('close', (code, reason) => {
      clearInterval(watchdog);
      const was = this.connected;
      this.connected = false;
      if (was) this.log.warn(`Disconnected from hub (${code}${reason.length ? ` ${reason}` : ''})`);
      if (this.closed) return;
      const wait = this.delay + Math.random() * 500;
      this.delay = Math.min(this.delay * 2, 30_000);
      setTimeout(() => this.connect(), wait);
    });
  }

  send(msg) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  close() {
    this.closed = true;
    this.ws?.close();
  }
}
