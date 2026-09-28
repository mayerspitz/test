import crypto from 'node:crypto';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { WebSocketServer } from 'ws';
import { createApi } from './api.js';
import { HUB_ROOT, loadConfig } from './config.js';
import { Library } from './library.js';
import { createLogger } from './log.js';
import { JsonStore } from './store.js';
import { YouTube } from './youtube.js';
import { ZoneManager } from './zones.js';

export const VERSION = '0.1.0';

export async function createHub(overrides = {}) {
  const config = loadConfig(overrides);
  const log = createLogger(config.quiet);

  const store = new JsonStore(path.join(config.dataDir, 'state.json'), { zones: {} }, { log });
  const library = new Library({
    dir: config.libraryDir,
    indexFile: path.join(config.dataDir, 'library-index.json'),
    maxUploadBytes: config.maxUploadMb * 1024 * 1024,
    log,
  });
  await library.init();
  const youtube = new YouTube({ bin: config.ytdlpPath, extraArgs: config.ytdlpArgs, log });

  // Bridges get paths relative to the hub (they know the hub URL); plain URLs pass through.
  const mediaUrl = (item) =>
    item.kind === 'track' ? `/media/tracks/${item.ref}` : item.kind === 'youtube' ? `/media/youtube/${item.ref}` : item.ref;
  const zones = new ZoneManager({ store, mediaUrl, log });

  const authorized = (req) => {
    if (!config.token) return true;
    const header = req.headers.authorization ?? '';
    const given = header.startsWith('Bearer ') ? header.slice(7) : new URL(req.url, 'http://x').searchParams.get('token') ?? '';
    return safeEqual(given, config.token);
  };
  const requireAuth = (req, res, next) =>
    authorized(req) ? next() : res.status(401).json({ error: 'Missing or wrong access token' });

  const app = express();
  app.disable('x-powered-by');
  app.set('etag', false);
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req, res) => res.json({ ok: true, version: VERSION, auth: Boolean(config.token), demo: Boolean(config.demo) }));
  app.use('/api', requireAuth, createApi({ zones, library, youtube }));

  // Media endpoints read by the bridges (and by the browser for previews).
  app.get('/media/tracks/:tid', requireAuth, (req, res, next) => {
    let t;
    try {
      t = library.get(req.params.tid);
    } catch (err) {
      return next(err);
    }
    res.sendFile(library.absPath(t), { acceptRanges: true, dotfiles: 'allow', headers: { 'Cache-Control': 'no-store' } }, (err) => {
      if (err && !res.headersSent) next(err);
    });
  });
  app.get('/media/youtube/:vid', requireAuth, async (req, res, next) => {
    try {
      await youtube.proxy(req, res, req.params.vid);
    } catch (err) {
      if (res.headersSent) res.destroy();
      else next(err);
    }
  });

  app.use(express.static(path.join(HUB_ROOT, 'public'), { index: 'index.html', maxAge: 0 }));

  // JSON errors everywhere.
  app.use((err, _req, res, _next) => {
    const status = err.status ?? err.statusCode ?? 500;
    if (status >= 500) log.error(err.stack || err.message);
    if (res.headersSent) return res.destroy();
    res.status(status).json({ error: status >= 500 && !err.status ? 'Internal error' : err.message });
  });

  const server = http.createServer(app);

  // ---- WebSockets: /ws/ui for apps (live state), /ws/agent for bridges ----
  const wss = new WebSocketServer({ noServer: true, maxPayload: 1024 * 1024 });
  const uiClients = new Set();

  server.on('upgrade', (req, socket, head) => {
    const { pathname } = new URL(req.url, 'http://x');
    if ((pathname !== '/ws/ui' && pathname !== '/ws/agent') || !authorized(req)) {
      socket.write(`HTTP/1.1 ${authorized(req) ? '404 Not Found' : '401 Unauthorized'}\r\nConnection: close\r\n\r\n`);
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => (pathname === '/ws/ui' ? onUi(ws) : onAgent(ws, req)));
  });

  const sendJson = (ws, msg) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
  };
  const broadcast = (msg) => {
    const data = JSON.stringify(msg);
    for (const ws of uiClients) if (ws.readyState === ws.OPEN) ws.send(data);
  };

  function onUi(ws) {
    uiClients.add(ws);
    ws.isAlive = true;
    ws.on('pong', () => (ws.isAlive = true));
    ws.on('close', () => uiClients.delete(ws));
    ws.on('error', () => {});
    sendJson(ws, { type: 'snapshot', zones: zones.list(), version: VERSION });
  }

  function onAgent(ws, req) {
    ws.isAlive = true;
    ws.on('pong', () => (ws.isAlive = true));
    ws.on('error', () => {});
    let zoneId = null;
    const handle = {
      // Behind a proxy (Render, site.js) the bridge's real address is in X-Forwarded-For.
      address: (req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress)?.replace(/^::ffff:/, '') ?? null,
      send: (msg) => sendJson(ws, msg),
      close: (code, reason) => ws.close(code, reason),
    };
    const helloTimer = setTimeout(() => ws.close(4000, 'No hello received'), 10_000);
    ws.on('message', (data) => {
      let msg;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return;
      }
      if (!zoneId) {
        if (msg.type !== 'hello') return;
        clearTimeout(helloTimer);
        try {
          zoneId = zones.attachAgent(msg, handle);
          sendJson(ws, { type: 'welcome', zone: zoneId, version: VERSION });
          log.info(`Bridge connected: ${zoneId} from ${handle.address}`);
        } catch (err) {
          ws.close(4002, err.message.slice(0, 120));
        }
        return;
      }
      zones.handleAgentMessage(zoneId, msg);
    });
    ws.on('close', () => {
      clearTimeout(helloTimer);
      if (zoneId) {
        zones.detachAgent(zoneId, handle);
        log.info(`Bridge disconnected: ${zoneId}`);
      }
    });
  }

  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.isAlive) {
        ws.terminate();
        continue;
      }
      ws.isAlive = false;
      ws.ping();
    }
  }, 20_000);

  // Coalesce zone updates: at most one message per zone every 200 ms.
  const dirty = new Set();
  let flushTimer = null;
  zones.on('zone', (id) => {
    dirty.add(id);
    flushTimer ??= setTimeout(() => {
      flushTimer = null;
      for (const zid of dirty) if (zones.zones[zid]) broadcast({ type: 'zone', zone: zones.publicZone(zid) });
      dirty.clear();
    }, 200);
  });
  zones.on('removed', (id) => broadcast({ type: 'zone-removed', id }));
  library.on('changed', () => broadcast({ type: 'library' }));

  // listen: false = don't open a port; a front server (site.js) hands requests to `server`.
  let port = null;
  if (overrides.listen !== false) {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(config.port, config.host, resolve);
    });
    ({ port } = server.address());
  }

  let closed = false;
  async function close() {
    if (closed) return;
    closed = true;
    clearInterval(heartbeat);
    clearTimeout(flushTimer);
    zones.close();
    for (const ws of wss.clients) ws.terminate();
    store.flush();
    library.flush();
    await new Promise((resolve) => {
      if (server.listening) server.close(resolve);
      else resolve();
      server.closeAllConnections?.();
    });
  }

  return { config, log, server, port, zones, library, youtube, store, close };
}

function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function lanAddresses() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => i.address);
}

// Run directly: `node src/server.js`
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const hub = await createHub();
  const { log, port, config } = hub;
  log.info(`Multiroom hub ${VERSION} listening on port ${port}`);
  for (const ip of lanAddresses()) log.info(`  Open on your phone: http://${ip}:${port}`);
  log.info(`  Library folder: ${config.libraryDir}`);
  if (!config.token) log.warn('No MULTIROOM_TOKEN set: anyone on your network can control the speakers.');
  const yt = await hub.youtube.status();
  log.info(yt.available ? `  YouTube Music: yt-dlp ${yt.version}` : '  YouTube Music: disabled (yt-dlp not found)');
  const shutdown = async (sig) => {
    log.info(`${sig} received, shutting down`);
    await hub.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
