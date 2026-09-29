import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { startHome } from '../src/home.js';
import { createHub } from '../src/server.js';
import { tmpDir, waitFor } from './helpers.js';

// Adding speakers from the app, end to end through cloud → home Pi, with fake BlueZ tools.
const here = path.dirname(fileURLToPath(import.meta.url));
const PW = 'pw';
let cloud;
let home;
const bin = tmpDir();
const stateFile = path.join(bin, 'bluez.json');
const configFile = path.join(tmpDir(), 'home.json');
const oldPath = process.env.PATH;
const call = async (method, p, body) => {
  const res = await fetch(`http://127.0.0.1:${cloud.port}${p}`, {
    method,
    headers: { Authorization: `Bearer ${PW}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => null) };
};

before(async () => {
  for (const tool of ['busctl', 'bluetoothctl', 'pactl', 'parec', 'bt-agent']) {
    fs.writeFileSync(path.join(bin, tool), `#!/usr/bin/env node\nrequire(${JSON.stringify(path.join(here, 'fake-bluez.cjs'))});\n`, { mode: 0o755 });
  }
  fs.writeFileSync(stateFile, JSON.stringify({
    adapters: { hci0: { address: '00:1A:7D:00:00:01' }, hci1: { address: '00:1A:7D:00:00:02' } },
    nearby: [
      { address: 'F8:DF:15:00:00:AA', name: 'JBL Flip 6', icon: 'audio-card', rssi: -50 },
      { address: '11:22:33:44:55:66', name: "Someone's phone", icon: 'phone', rssi: -40 },
      { address: 'C0:28:8D:00:00:BB', name: 'UE BOOM 3', icon: 'audio-card', rssi: -70 },
    ],
    incoming: [{ address: '00:0A:95:00:00:11', name: 'Sony Walkman' }],
    sources: ['bluez_input.00_0A_95_00_00_11.2', 'alsa_input.usb-Burr-Brown_USB_Audio_CODEC-00.analog-stereo', 'alsa_output.platform-107c706400.hdmi.monitor'],
  }));
  process.env.FAKE_BLUEZ_STATE = stateFile;
  process.env.PATH = `${bin}:${oldPath}`;
  fs.writeFileSync(configFile, JSON.stringify({ speakers: [] }));
  cloud = await createHub({ dataDir: tmpDir(), port: 0, host: '127.0.0.1', token: PW, quiet: true, remoteHome: true, homeWaitMs: 2000 });
  const cfg = { cloud: `http://127.0.0.1:${cloud.port}`, token: PW, dataDir: tmpDir(), localPort: 0, speakers: [], setupOptions: { scanSeconds: 3, pairWaitMs: 200 } };
  home = await startHome(cfg, { configFile, log: { info() {}, warn() {}, error() {} } });
  await waitFor(async () => (await call('GET', '/api/health')).data?.home?.online);
});
after(async () => {
  await home?.stop();
  await cloud?.close();
  process.env.PATH = oldPath;
});

test('the app lists the Pi\'s Bluetooth adapters', async () => {
  const { status, data } = await call('GET', '/api/setup');
  assert.equal(status, 200, JSON.stringify(data));
  assert.deepEqual(data.adapters.map((a) => [a.name, a.address, a.speaker]), [['hci0', '00:1A:7D:00:00:01', null], ['hci1', '00:1A:7D:00:00:02', null]]);
  assert.equal(data.free, 2);
});

test('scan finds speakers first (phones last) and add pairs + starts a speaker', async () => {
  const scan = await call('POST', '/api/setup/scan', { seconds: 3 });
  assert.equal(scan.status, 200, JSON.stringify(scan.data));
  assert.deepEqual(scan.data.map((d) => d.name), ['JBL Flip 6', 'UE BOOM 3', "Someone's phone"]);
  const add = await call('POST', '/api/setup/speakers', { address: 'F8:DF:15:00:00:AA', name: 'Kitchen' });
  assert.equal(add.status, 200, JSON.stringify(add.data));
  assert.equal(add.data.id, 'kitchen');
  const z = await waitFor(async () => {
    const r = await call('GET', '/api/zones/kitchen');
    return r.data?.online && r.data.speaker?.connected && r.data;
  }, { message: 'kitchen online and connected', timeout: 15000 });
  assert.equal(z.speaker.address, 'F8:DF:15:00:00:AA');
  const saved = JSON.parse(fs.readFileSync(configFile, 'utf8'));
  assert.deepEqual(saved.speakers.map((s) => [s.zone.id, s.bluetooth.adapter]), [['kitchen', '00:1A:7D:00:00:01']]);
  const status = (await call('GET', '/api/setup')).data;
  assert.equal(status.free, 1);
  assert.equal(status.adapters[0].speaker, 'kitchen');
});

test('a second speaker gets the other adapter; with none free the app says so', async () => {
  const add = await call('POST', '/api/setup/speakers', { address: 'C0:28:8D:00:00:BB', name: 'Patio' });
  assert.equal(add.data.adapter, '00:1A:7D:00:00:02');
  const again = await call('POST', '/api/setup/scan', { seconds: 3 });
  assert.equal(again.status, 409);
  assert.match(again.data.error, /Plug in another USB Bluetooth adapter/);
});

test('removing a speaker frees its adapter and takes it off the app', async () => {
  const r = await call('DELETE', '/api/setup/speakers/patio');
  assert.equal(r.status, 200);
  assert.equal((await call('GET', '/api/setup')).data.free, 1);
  await waitFor(async () => (await call('GET', '/api/zones/patio')).status === 404, { message: 'patio gone from the app' });
  assert.deepEqual(JSON.parse(fs.readFileSync(configFile, 'utf8')).speakers.map((s) => s.zone.id), ['kitchen']);
});

test('pairing failure gives a clear message', async () => {
  const st = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  st.nearby.push({ address: 'AA:AA:AA:AA:AA:AA', name: 'Stubborn', icon: 'audio-card', refusePairing: true });
  fs.writeFileSync(stateFile, JSON.stringify(st));
  await call('POST', '/api/setup/scan', { seconds: 3 });
  const r = await call('POST', '/api/setup/speakers', { address: 'AA:AA:AA:AA:AA:AA' });
  assert.equal(r.status, 502);
  assert.match(r.data.error, /pairing mode/);
});

test('the system check runs on the Pi and its report reaches the app', async () => {
  const r = await call('GET', '/api/setup/check');
  assert.equal(r.status, 200);
  assert.match(r.data.report, /Home Audio system check/);
  assert.match(r.data.report, /Node\.js/);
});

test('receiver mode: an MP3 player pairs to "Home Audio" and becomes a live input', async () => {
  const before = (await call('GET', '/api/setup')).data.free;
  const r = await call('POST', '/api/setup/receiver', { seconds: 60 });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.name, 'Home Audio');
  const st = await waitFor(async () => {
    const s = (await call('GET', '/api/setup')).data;
    return s.receiver?.players.length && s;
  }, { message: 'player paired' });
  assert.equal(st.receiver.players[0].name, 'Sony Walkman');
  assert.equal(st.free, before - 1, 'the receiver adapter is reserved, not used for a speaker');
  await waitFor(() => JSON.parse(fs.readFileSync(stateFile, 'utf8')).devices[`${st.adapters.find((a) => a.receiver).name}/dev_00_0A_95_00_00_11`].trusted, { message: 'player trusted' });
  const inputs = (await call('GET', '/api/inputs')).data;
  assert.deepEqual(inputs.map((i) => [i.name, i.kind]), [['Sony Walkman', 'bluetooth'], ['USB line-in', 'line-in']]);
});

test('a live input streams through the app as audio, and can be queued on a speaker', async () => {
  const id = 'bluez_input.00_0A_95_00_00_11.2';
  const ac = new AbortController();
  const res = await fetch(`http://127.0.0.1:${cloud.port}/media/input/${encodeURIComponent(id)}?token=${PW}`, { signal: ac.signal });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'audio/wav');
  const reader = res.body.getReader();
  let got = Buffer.alloc(0);
  while (got.length < 20000) got = Buffer.concat([got, Buffer.from((await reader.read()).value)]);
  ac.abort();
  assert.equal(got.subarray(0, 4).toString(), 'RIFF');
  assert.equal((await fetch(`http://127.0.0.1:${cloud.port}/media/input/nope?token=${PW}`)).status, 404);
  const play = await call('POST', '/api/zones/kitchen/play', { items: [{ kind: 'input', id, title: 'Sony Walkman' }] });
  assert.equal(play.status, 200, JSON.stringify(play.data));
  assert.equal(play.data.current.kind, 'input');
  assert.equal(play.data.current.title, 'Sony Walkman');
  assert.equal((await call('POST', '/api/zones/kitchen/play', { items: [{ kind: 'input', id: '../../etc' }] })).status, 400);
  const off = await call('DELETE', '/api/setup/receiver');
  assert.equal(off.status, 200);
  assert.equal((await call('GET', '/api/setup')).data.receiver, null);
});
