// One web service, two sites (for the cloud deployment on Render):
//   demo.<your domain>  -> the demo hub (simulated speakers, sample music, no login)
//   app.<your domain>   -> the real hub: your phone and your home Pi connect here (MULTIROOM_TOKEN required)
// Any other address (e.g. the *.onrender.com one) goes to SITE_DEFAULT ("demo" unless set to "app").
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startDemo } from '../scripts/demo.js';
import { HUB_ROOT } from './config.js';
import { createHub } from './server.js';

export async function startSite({ port = 8080, host = '0.0.0.0', token = '', prodDataDir, demoDataDir, defaultSite = 'demo' } = {}) {
  // The demo hub listens on a private port only so its simulated bridges can reach it.
  const demo = await startDemo({ dataDir: demoDataDir, port: 0, host: '127.0.0.1' });
  const prod = token ? await createHub({ dataDir: prodDataDir ?? path.join(HUB_ROOT, 'data'), token, listen: false }) : null;

  const pick = (req) => {
    const name = String(req.headers.host ?? '').toLowerCase().split(':')[0];
    if (name.startsWith('demo.')) return demo.hub;
    if (name.startsWith('app.')) return prod;
    return defaultSite === 'app' ? prod : demo.hub;
  };

  const server = http.createServer((req, res) => {
    const hub = pick(req);
    if (!hub) {
      res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('The app is not configured yet: set MULTIROOM_TOKEN on the server.');
      return;
    }
    hub.server.emit('request', req, res);
  });
  server.on('upgrade', (req, socket, head) => {
    const hub = pick(req);
    if (!hub) socket.destroy();
    else hub.server.emit('upgrade', req, socket, head);
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, resolve);
  });

  return {
    server,
    port: server.address().port,
    demo: demo.hub,
    prod,
    async close() {
      await demo.stop();
      await prod?.close();
      await new Promise((resolve) => {
        server.close(resolve);
        server.closeAllConnections?.();
      });
    },
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const site = await startSite({
    port: Number(process.env.PORT || 8080),
    token: process.env.MULTIROOM_TOKEN ?? '',
    prodDataDir: process.env.MULTIROOM_DATA_DIR,
    defaultSite: process.env.SITE_DEFAULT === 'app' ? 'app' : 'demo',
  });
  console.log(`Site listening on port ${site.port}: demo.* -> demo, app.* -> ${site.prod ? 'real hub' : 'NOT CONFIGURED (no MULTIROOM_TOKEN)'}`);
  for (const sig of ['SIGINT', 'SIGTERM']) {
    process.on(sig, async () => {
      await site.close();
      process.exit(0);
    });
  }
}
