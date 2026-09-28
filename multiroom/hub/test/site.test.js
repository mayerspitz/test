import http from 'node:http';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { Agent } from '../../agent/src/agent.js';
import { SimulatedBluetooth, SimulatedPlayer } from '../../agent/src/simulated.js';
import { startSite } from '../src/site.js';
import { tmpDir, waitFor } from './helpers.js';

let site;
// fetch() won't send a custom Host header, so use node:http.
const get = (host, p, headers = {}) =>
  new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: site.port, path: p, headers: { Host: host, ...headers } }, (res) => {
      let body = '';
      res.on('data', (d) => (body += d));
      res.on('end', () => {
        let data = null;
        try {
          data = JSON.parse(body);
        } catch { /* not JSON */ }
        resolve({ status: res.statusCode, data });
      });
    }).on('error', reject);
  });

before(async () => {
  site = await startSite({ port: 0, host: '127.0.0.1', token: 'prod-secret', prodDataDir: tmpDir(), demoDataDir: tmpDir(), defaultSite: 'app' });
});
after(() => site.close());

test('demo.* and app.* reach different hubs', async () => {
  const demo = await get('demo.example.com', '/api/health');
  const app = await get('app.example.com', '/api/health');
  assert.deepEqual([demo.data.demo, demo.data.auth], [true, false]);
  assert.deepEqual([app.data.demo, app.data.auth], [false, true]);
  assert.equal((await get('demo.example.com', '/api/zones')).status, 200);
  assert.equal((await get('app.example.com', '/api/zones')).status, 401);
  const prodZones = await get('app.example.com', '/api/zones', { Authorization: 'Bearer prod-secret' });
  assert.deepEqual(prodZones.data, []);
  const demoZones = await waitFor(async () => (await get('demo.example.com', '/api/zones')).data?.length >= 5 && true);
  assert.ok(demoZones);
});

test('a home bridge connects to the real hub over the same address', async () => {
  // defaultSite is "app", so the bare address used here goes to the real hub
  const cfg = { hub: `http://127.0.0.1:${site.port}`, token: 'prod-secret', zone: { id: 'home-kitchen', name: 'Home kitchen' }, bluetooth: { type: 'simulated' }, player: { type: 'simulated', audioDevice: 'auto' } };
  const agent = new Agent({ cfg, player: new SimulatedPlayer(), bluetooth: new SimulatedBluetooth(), log: { info() {}, warn() {}, error() {} } });
  await agent.start();
  try {
    await waitFor(async () => (await get('app.example.com', '/api/zones/home-kitchen', { Authorization: 'Bearer prod-secret' })).data?.online);
    const demoHasIt = await get('demo.example.com', '/api/zones/home-kitchen');
    assert.equal(demoHasIt.status, 404);
  } finally {
    await agent.stop();
  }
});
