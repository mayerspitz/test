import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { Agent } from '../../agent/src/agent.js';
import { SimulatedBluetooth, SimulatedPlayer } from '../../agent/src/simulated.js';
import { startHub, waitFor } from './helpers.js';

let ctx;
let agent;
let player;
let tracks;
const loads = [];

before(async () => {
  ctx = await startHub({
    tracks: {
      'Kitchen player/01 Local one.wav': { seconds: 30, title: 'Local one' },
      'Kitchen player/02 Local two.wav': { seconds: 30, title: 'Local two' },
    },
  });
  tracks = (await ctx.call('GET', '/api/library/tracks')).data.items;
  player = new SimulatedPlayer();
  const load = player.load.bind(player);
  player.load = (o) => (loads.push(o.url), load(o));
  const cfg = { hub: ctx.base, token: '', zone: { id: 'patio', name: 'Patio' }, bluetooth: null, player: { type: 'simulated', audioDevice: 'auto' } };
  agent = new Agent({ cfg, player, bluetooth: null, log: { info() {}, warn() {}, error() {} } });
  await agent.start();
  await waitFor(async () => (await ctx.call('GET', '/api/zones/patio')).data?.online);
});
after(async () => {
  await agent.stop();
  await ctx.hub.close();
});

const yt = (id, title) => ({ kind: 'youtube', id, title, artist: 'YT artist', duration: 200 });

test('a playlist mixes local songs, YouTube songs and links, in the order given', async () => {
  const { status, data } = await ctx.call('POST', '/api/playlists', {
    name: 'Friday mix',
    items: [{ kind: 'track', id: tracks[0].id }, yt('AAAAAAAAAAA', 'YT one'), { kind: 'url', url: 'https://radio.example/live.mp3', title: 'Radio' }, yt('BBBBBBBBBBB', 'YT two')],
  });
  assert.equal(status, 200, JSON.stringify(data));
  assert.deepEqual(data.items.map((i) => [i.kind, i.title]), [['track', 'Local one'], ['youtube', 'YT one'], ['url', 'Radio'], ['youtube', 'YT two']]);
  const list = (await ctx.call('GET', '/api/playlists')).data;
  assert.deepEqual([list[0].name, list[0].count, list[0].kinds.sort()], ['Friday mix', 4, ['track', 'url', 'youtube']]);
});

test('edit: add a whole collection at a position, move, remove, rename', async () => {
  const [pl] = (await ctx.call('GET', '/api/playlists')).data;
  let r = await ctx.call('POST', `/api/playlists/${pl.id}/items`, { items: [{ kind: 'collection', name: 'Kitchen player' }], position: 1 });
  assert.deepEqual(r.data.items.map((i) => i.title), ['Local one', 'Local one', 'Local two', 'YT one', 'Radio', 'YT two']);
  r = await ctx.call('DELETE', `/api/playlists/${pl.id}/items/1`);
  r = await ctx.call('POST', `/api/playlists/${pl.id}/items/move`, { from: 4, to: 0 });
  assert.deepEqual(r.data.items.map((i) => i.title), ['YT two', 'Local one', 'Local two', 'YT one', 'Radio']);
  r = await ctx.call('PATCH', `/api/playlists/${pl.id}`, { name: 'Weekend mix' });
  assert.equal(r.data.name, 'Weekend mix');
  assert.equal((await ctx.call('POST', '/api/playlists', { name: '  ' })).status, 400);
});

test('playing a mixed playlist queues every kind; the bridge gets the right sources', async () => {
  const [pl] = (await ctx.call('GET', '/api/playlists')).data;
  const { data } = await ctx.call('POST', '/api/zones/patio/play', { items: [{ kind: 'playlist', id: pl.id }], startIndex: 1, shuffle: false });
  assert.equal(data.queueLength, 5);
  assert.equal(data.current.title, 'Local one');
  await waitFor(() => loads.length >= 1);
  assert.match(loads.at(-1), /\/media\/tracks\//);
  await ctx.call('POST', '/api/zones/patio/queue/jump', { index: 0 });
  await waitFor(() => loads.length >= 2);
  assert.match(loads.at(-1), /\/media\/youtube\/BBBBBBBBBBB$/);
  await ctx.call('POST', '/api/zones/patio/queue/jump', { index: 4 });
  await waitFor(() => loads.length >= 3);
  assert.equal(loads.at(-1), 'https://radio.example/live.mp3');
});

test('a YouTube playlist can be appended to a queue that already has local songs', async () => {
  await ctx.call('POST', '/api/zones/patio/play', { items: [{ kind: 'collection', name: 'Kitchen player' }] });
  const { data } = await ctx.call('POST', '/api/zones/patio/play', { items: [yt('CCCCCCCCCCC', 'P1'), yt('DDDDDDDDDDD', 'P2')], mode: 'append' });
  const q = (await ctx.call('GET', '/api/zones/patio/queue')).data;
  assert.equal(data.queueLength, 4);
  assert.deepEqual(q.items.map((i) => i.kind), ['track', 'track', 'youtube', 'youtube']);
});

test('the current queue can be saved as a playlist, and playlists survive a restart', async () => {
  const { data } = await ctx.call('POST', '/api/zones/patio/queue/save', { name: 'Saved from Patio' });
  assert.equal(data.items.length, 4);
  assert.ok(!('uid' in data.items[0]));
  const dataDir = ctx.dataDir;
  const port = ctx.hub.port;
  await agent.stop();
  await ctx.hub.close();
  ctx = await startHub({ dataDir, hub: { port } });
  const names = (await ctx.call('GET', '/api/playlists')).data.map((p) => p.name);
  assert.deepEqual(names, ['Saved from Patio', 'Weekend mix']);
  await ctx.call('DELETE', `/api/playlists/${(await ctx.call('GET', '/api/playlists')).data[0].id}`);
  assert.equal((await ctx.call('GET', '/api/playlists')).data.length, 1);
  agent = { stop: async () => {} };
});
