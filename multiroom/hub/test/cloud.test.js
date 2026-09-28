import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { startHome } from '../src/home.js';
import { createHub } from '../src/server.js';
import { writeToneWav } from '../scripts/tones.js';
import { tmpDir, waitFor } from './helpers.js';

// Cloud mode end to end, all on localhost: the cloud app (control + web app) and the
// home Pi process (music on its disk + simulated speakers) talking through the tunnel.
const PW = 'Ms-test-pw!';
let cloud;
let home;
let port;
const homeDir = tmpDir();
const auth = { Authorization: `Bearer ${PW}` };
const call = async (method, p, body) => {
  let res;
  try {
    res = await fetch(`http://127.0.0.1:${port}${p}`, {
    method,
    headers: { ...auth, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  } catch {
    return { status: 0, data: null }; // the cloud is restarting
  }
  return { status: res.status, data: await res.json().catch(() => null) };
};
const startCloud = async (p = 0) => {
  cloud = await createHub({ dataDir: tmpDir(), port: p, host: '127.0.0.1', token: PW, quiet: true, remoteHome: true, homeWaitMs: 5000 });
  port = cloud.port;
};

before(async () => {
  writeToneWav(path.join(homeDir, 'library', 'Kitchen player', '01 Long.wav'), { seconds: 60, title: 'Long song' });
  writeToneWav(path.join(homeDir, 'library', 'Kitchen player', '02 Next.wav'), { seconds: 60, title: 'Next song' });
  await startCloud();
  home = await startHome(
    {
      cloud: `http://127.0.0.1:${port}`,
      token: PW,
      dataDir: homeDir,
      localPort: 0,
      speakers: [{ zone: { id: 'kitchen', name: 'Kitchen' }, bluetooth: { type: 'simulated' }, player: { type: 'simulated' } }],
    },
    { log: { info() {}, warn() {}, error() {} } },
  );
  await waitFor(async () => (await call('GET', '/api/health')).data?.home?.online, { message: 'home online' });
  await home.local.library.rescan();
});
after(async () => {
  await home?.stop();
  await cloud?.close();
});

test('library browsing, storage info and audio come from the home Pi', async () => {
  const cols = await call('GET', '/api/library/collections');
  assert.deepEqual(cols.data.map((c) => [c.name, c.tracks]), [['Kitchen player', 2]]);
  const tracks = await call('GET', '/api/library/tracks?q=long');
  const id = tracks.data.items[0].id;
  const media = await fetch(`http://127.0.0.1:${port}/media/tracks/${id}?token=${encodeURIComponent(PW)}`, { headers: { Range: 'bytes=0-99' } });
  assert.equal(media.status, 206);
  assert.equal((await media.arrayBuffer()).byteLength, 100);
  assert.ok((await call('GET', '/api/system')).data.disk.free > 0);
  assert.equal((await fetch(`http://127.0.0.1:${port}/api/library/collections`)).status, 401);
});

test('uploads through the cloud land on the home Pi', async () => {
  const wav = fs.readFileSync(path.join(homeDir, 'library', 'Kitchen player', '02 Next.wav'));
  const fd = new FormData();
  fd.append('files', new Blob([wav]), 'Den/New song.wav');
  const res = await fetch(`http://127.0.0.1:${port}/api/library/upload?collection=Uploads`, { method: 'POST', headers: auth, body: fd });
  const out = await res.json();
  assert.equal(res.status, 200, JSON.stringify(out));
  assert.equal(out.saved.length, 1);
  assert.ok(fs.existsSync(path.join(homeDir, 'library', 'Uploads', 'Den', 'New song.wav')));
});

test('playing a collection: the cloud decides, the Pi plays from its own disk', async () => {
  await waitFor(async () => (await call('GET', '/api/zones/kitchen')).data?.online, { message: 'kitchen online' });
  const { status, data } = await call('POST', '/api/zones/kitchen/play', { items: [{ kind: 'collection', name: 'Kitchen player' }] });
  assert.equal(status, 200, JSON.stringify(data));
  const player = home.agents[0].player;
  await waitFor(() => player.state === 'playing', { message: 'playing' });
  assert.equal(data.current.title, 'Long song');
});

test('the cloud restarting with an empty disk gets speakers and queues back from the Pi', async () => {
  const player = home.agents[0].player;
  const uid = player.uid;
  const oldPort = port;
  await new Promise((r) => setTimeout(r, 800)); // let the backup reach the Pi
  await cloud.close();
  await startCloud(oldPort);
  const z = await waitFor(async () => {
    const r = await call('GET', '/api/zones/kitchen');
    return r.data?.online && r.data;
  }, { message: 'kitchen back online', timeout: 20000 });
  assert.equal(z.queueLength, 2);
  assert.equal(z.current.title, 'Long song');
  assert.equal(player.uid, uid, 'the song kept playing through the restart');
  assert.equal(player.state, 'playing');
});

test('with the Pi offline the library answers 503 with a clear message', async () => {
  home.client.close();
  await waitFor(async () => (await call('GET', '/api/health')).data?.home?.online === false, { message: 'home offline' });
  const r = await call('GET', '/api/library/collections');
  assert.equal(r.status, 503);
  assert.match(r.data.error, /home Pi is offline/);
});
