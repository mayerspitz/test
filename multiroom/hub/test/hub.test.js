import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { Agent } from '../../agent/src/agent.js';
import { SimulatedBluetooth, SimulatedPlayer } from '../../agent/src/simulated.js';
import { startHub, tmpDir, waitFor } from './helpers.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const quietLog = { info() {}, warn() {}, error() {} };
const hasMpv = spawnSync('mpv', ['--version']).status === 0;

function simAgent(base, token, zone, { connected = true } = {}) {
  const player = new SimulatedPlayer();
  const bluetooth = new SimulatedBluetooth({ name: 'Test speaker', connected, battery: 50 });
  const cfg = { hub: base, token, zone, bluetooth: { type: 'simulated' }, player: { type: 'simulated', audioDevice: 'auto' } };
  const agent = new Agent({ cfg, player, bluetooth, log: quietLog });
  return { agent, player, bluetooth };
}

describe('library, uploads and auth', () => {
  let ctx;
  before(async () => {
    ctx = await startHub({
      token: 'secret',
      tracks: { 'Kitchen Player/01 A.wav': { seconds: 2, title: 'Alpha', artist: 'Tester' }, 'loose.wav': { seconds: 1 } },
    });
  });
  after(() => ctx.hub.close());

  test('API needs the token, health does not', async () => {
    assert.equal((await fetch(`${ctx.base}/api/zones`)).status, 401);
    assert.equal((await fetch(`${ctx.base}/api/zones?token=wrong`)).status, 401);
    assert.equal((await fetch(`${ctx.base}/api/zones?token=secret`)).status, 200);
    const health = await (await fetch(`${ctx.base}/api/health`)).json();
    assert.equal(health.auth, true);
  });

  test('indexes tags and folders into collections', async () => {
    const { data } = await ctx.call('GET', '/api/library/collections');
    assert.deepEqual(data.map((c) => [c.name, c.tracks]), [['Kitchen Player', 1], ['Unsorted', 1]]);
    const { data: tracks } = await ctx.call('GET', '/api/library/tracks?q=alp');
    assert.equal(tracks.total, 1);
    assert.equal(tracks.items[0].title, 'Alpha');
    assert.equal(tracks.items[0].artist, 'Tester');
    assert.equal(tracks.items[0].duration, 2);
  });

  test('uploads keep folder structure, skip non-audio and neutralise ../', async () => {
    const wav = fs.readFileSync(path.join(ctx.dataDir, 'library', 'Kitchen Player', '01 A.wav'));
    const fd = new FormData();
    fd.append('files', new Blob([wav]), 'MP3PLAYER/Music/Song.wav');
    fd.append('files', new Blob(['hello']), 'MP3PLAYER/notes.txt');
    fd.append('files', new Blob([wav]), '../../../escape.wav');
    const res = await fetch(`${ctx.base}/api/library/upload?collection=${encodeURIComponent('Den Player')}`, {
      method: 'POST',
      headers: { Authorization: 'Bearer secret' },
      body: fd,
    });
    const out = await res.json();
    assert.equal(res.status, 200);
    assert.equal(out.saved.length, 2);
    assert.deepEqual(out.skipped.map((s) => s.reason), ['not an audio file']);
    assert.ok(fs.existsSync(path.join(ctx.dataDir, 'library', 'Den Player', 'MP3PLAYER', 'Music', 'Song.wav')));
    assert.ok(fs.existsSync(path.join(ctx.dataDir, 'library', 'Den Player', 'escape.wav')));
    assert.ok(!fs.existsSync(path.join(ctx.dataDir, 'escape.wav')));
    const { data } = await ctx.call('GET', `/api/library/tracks?collection=${encodeURIComponent('Den Player')}`);
    assert.equal(data.total, 2);
  });

  test('media supports HTTP range requests (seeking) and ?token=', async () => {
    const { data } = await ctx.call('GET', '/api/library/tracks?q=alpha');
    const id = data.items[0].id;
    const res = await fetch(`${ctx.base}/media/tracks/${id}?token=secret`, { headers: { Range: 'bytes=0-99' } });
    assert.equal(res.status, 206);
    assert.equal((await res.arrayBuffer()).byteLength, 100);
    assert.equal((await fetch(`${ctx.base}/media/tracks/${id}`)).status, 401);
  });

  test('deleting a collection removes files and index entries', async () => {
    const { status } = await ctx.call('DELETE', `/api/library/collections/${encodeURIComponent('Den Player')}`);
    assert.equal(status, 200);
    assert.ok(!fs.existsSync(path.join(ctx.dataDir, 'library', 'Den Player')));
    const { data } = await ctx.call('GET', '/api/library/collections');
    assert.ok(!data.some((c) => c.name === 'Den Player'));
  });

  test('bridges without the token are refused', async () => {
    const { agent } = simAgent(ctx.base, 'nope', { id: 'intruder', name: 'Intruder' });
    await agent.start();
    await new Promise((r) => setTimeout(r, 400));
    const { data } = await ctx.call('GET', '/api/zones');
    assert.equal(data.length, 0);
    await agent.stop();
  });
});

describe('zones with simulated bridges', () => {
  let ctx;
  const agents = [];
  before(async () => {
    ctx = await startHub({
      tracks: {
        'Mix/01 One.wav': { seconds: 1.2, title: 'One' },
        'Mix/02 Two.wav': { seconds: 1.2, title: 'Two' },
        'Mix/03 Three.wav': { seconds: 30, title: 'Three' },
        'Other/01 Solo.wav': { seconds: 30, title: 'Solo' },
      },
    });
  });
  after(async () => {
    for (const a of agents) await a.agent.stop();
    await ctx.hub.close();
  });
  const zone = async (id) => (await ctx.call('GET', `/api/zones/${id}`)).data;

  test('a bridge registers its speaker and shows online', async () => {
    const a = simAgent(ctx.base, '', { id: 'kitchen', name: 'Kitchen' });
    agents.push(a);
    await a.agent.start();
    const z = await waitFor(async () => (await zone('kitchen'))?.online && zone('kitchen'), { message: 'kitchen online' });
    assert.equal(z.name, 'Kitchen');
    assert.equal(z.speaker.connected, true);
    assert.equal(z.speaker.battery, 50);
  });

  test('plays a collection, advances automatically and stops at the end', async () => {
    const { status, data } = await ctx.call('POST', '/api/zones/kitchen/play', { items: [{ kind: 'collection', name: 'Mix' }] });
    assert.equal(status, 200);
    assert.equal(data.queueLength, 3);
    assert.equal(data.current.title, 'One');
    await waitFor(async () => (await zone('kitchen')).playback === 'playing', { message: 'playing' });
    await waitFor(async () => (await zone('kitchen')).current.title === 'Two', { message: 'advance to Two' });
    await waitFor(async () => (await zone('kitchen')).current.title === 'Three', { message: 'advance to Three' });
    await ctx.call('POST', '/api/zones/kitchen/next');
    const z = await waitFor(async () => {
      const cur = await zone('kitchen');
      return cur.state === 'stopped' && cur;
    }, { message: 'stopped at end' });
    assert.equal(z.index, 0);
  });

  test('volume is sent to the bridge player (software volume)', async () => {
    await ctx.call('PUT', '/api/zones/kitchen/volume', { volume: 63 });
    await waitFor(() => agents[0].player.volume === 63, { message: 'player volume' });
    assert.equal((await ctx.call('PUT', '/api/zones/kitchen/volume', { volume: 'loud' })).status, 400);
    const { data } = await ctx.call('PUT', '/api/zones/kitchen/volume', { volume: 250 });
    assert.equal(data.volume, 100);
  });

  test('pause, resume, seek and "play now" keep the rest of the queue', async () => {
    await ctx.call('POST', '/api/zones/kitchen/play', { items: [{ kind: 'collection', name: 'Other' }] });
    await waitFor(() => agents[0].player.state === 'playing', { message: 'player playing' });
    await ctx.call('POST', '/api/zones/kitchen/pause');
    await waitFor(() => agents[0].player.state === 'paused', { message: 'player paused' });
    await ctx.call('POST', '/api/zones/kitchen/seek', { position: 12 });
    await waitFor(() => Math.round(agents[0].player.position) === 12, { message: 'seek' });
    await ctx.call('POST', '/api/zones/kitchen/resume');
    await waitFor(() => agents[0].player.state === 'playing', { message: 'resumed' });
    const { data: tracks } = await ctx.call('GET', '/api/library/tracks?q=three');
    const { data } = await ctx.call('POST', '/api/zones/kitchen/play', { items: [{ kind: 'track', id: tracks.items[0].id }], mode: 'now' });
    assert.equal(data.current.title, 'Three');
    assert.equal(data.queueLength, 2);
    assert.equal(data.index, 1);
  });

  test('playback pauses while the speaker is disconnected and resumes after', async () => {
    const a = agents[0];
    a.bluetooth.connected = false;
    a.bluetooth.emit('change');
    await waitFor(() => a.player.state === 'paused', { message: 'paused by speaker loss' });
    const z = await waitFor(async () => {
      const cur = await zone('kitchen');
      return cur.speaker?.connected === false && cur;
    }, { message: 'speaker reported disconnected' });
    assert.equal(z.state, 'playing'); // still wanted
    a.bluetooth.connected = true;
    a.bluetooth.emit('change');
    await waitFor(() => a.player.state === 'playing', { message: 'resumed after reconnect' });
  });

  test('a bridge reconnecting mid-song keeps playing without reloading', async () => {
    const a = agents[0];
    let loads = 0;
    const orig = a.player.load.bind(a.player);
    a.player.load = (...args) => {
      loads += 1;
      return orig(...args);
    };
    const uid = a.player.uid;
    a.agent.link.ws.terminate();
    await waitFor(async () => !(await zone('kitchen')).online, { message: 'offline' });
    await waitFor(async () => (await zone('kitchen')).online, { message: 'back online', timeout: 10000 });
    await new Promise((r) => setTimeout(r, 300));
    assert.equal(loads, 0);
    assert.equal(a.player.uid, uid);
    assert.equal(a.player.state, 'playing');
  });

  test('two speakers play different things independently', async () => {
    const b = simAgent(ctx.base, '', { id: 'patio', name: 'Patio' });
    agents.push(b);
    await b.agent.start();
    await waitFor(async () => (await zone('patio'))?.online, { message: 'patio online' });
    await ctx.call('POST', '/api/zones/patio/play', { items: [{ kind: 'collection', name: 'Other' }] });
    await ctx.call('PUT', '/api/zones/patio/volume', { volume: 20 });
    await waitFor(() => b.player.state === 'playing' && b.player.volume === 20, { message: 'patio playing' });
    const [k, p] = [await zone('kitchen'), await zone('patio')];
    assert.notEqual(k.current.title, p.current.title);
    assert.notEqual(agents[0].player.volume, b.player.volume);
    await ctx.call('POST', '/api/zones/pause-all');
    await waitFor(() => agents[0].player.state === 'paused' && b.player.state === 'paused', { message: 'all paused' });
  });

  test('an online speaker cannot be removed; an offline one can', async () => {
    assert.equal((await ctx.call('DELETE', '/api/zones/patio')).status, 409);
    const b = agents.pop();
    await b.agent.stop();
    await waitFor(async () => !(await zone('patio')).online, { message: 'patio offline' });
    assert.equal((await ctx.call('DELETE', '/api/zones/patio')).status, 200);
    assert.equal((await ctx.call('GET', '/api/zones/patio')).status, 404);
  });

  test('bad input is rejected with 400', async () => {
    assert.equal((await ctx.call('POST', '/api/zones/kitchen/play', { items: [] })).status, 400);
    assert.equal((await ctx.call('POST', '/api/zones/kitchen/play', { items: [{ kind: 'url', url: 'file:///etc/passwd' }] })).status, 400);
    assert.equal((await ctx.call('POST', '/api/zones/kitchen/play', { items: [{ kind: 'youtube', id: '../x' }] })).status, 400);
    assert.equal((await ctx.call('PUT', '/api/zones/kitchen/mode', { repeat: 'forever' })).status, 400);
    assert.equal((await ctx.call('POST', '/api/zones/nowhere/pause')).status, 404);
  });
});

describe('state survives a hub restart', () => {
  test('queue and volume persist; the bridge keeps playing through the restart', async () => {
    const dataDir = tmpDir();
    const tracks = { 'Mix/01 Long.wav': { seconds: 40, title: 'Long' }, 'Mix/02 Next.wav': { seconds: 40, title: 'Next' } };
    let ctx = await startHub({ dataDir, tracks });
    const port = ctx.hub.port;
    const a = simAgent(ctx.base, '', { id: 'den', name: 'Den' });
    await a.agent.start();
    await waitFor(async () => (await ctx.call('GET', '/api/zones/den')).data?.online, { message: 'den online' });
    await ctx.call('POST', '/api/zones/den/play', { items: [{ kind: 'collection', name: 'Mix' }] });
    await ctx.call('PUT', '/api/zones/den/volume', { volume: 33 });
    await waitFor(() => a.player.state === 'playing', { message: 'playing' });
    const uid = a.player.uid;
    await ctx.hub.close();

    ctx = await startHub({ dataDir, hub: { port } });
    try {
      const z = await waitFor(async () => {
        const res = await ctx.call('GET', '/api/zones/den');
        return res.data?.online && res.data;
      }, { message: 'reconnect after restart', timeout: 15000 });
      assert.equal(z.volume, 33);
      assert.equal(z.queueLength, 2);
      assert.equal(z.current.title, 'Long');
      assert.equal(a.player.uid, uid);
      assert.equal(a.player.state, 'playing');
    } finally {
      await a.agent.stop();
      await ctx.hub.close();
    }
  });
});

describe('YouTube Music via yt-dlp (faked)', () => {
  let ctx;
  let media;
  const body = Buffer.alloc(300 * 1024, 7);
  for (let i = 0; i < body.length; i++) body[i] = i % 251;
  const seen = [];

  before(async () => {
    media = http.createServer((req, res) => {
      seen.push({ url: req.url, range: req.headers.range, ua: req.headers['user-agent'] });
      if (req.url.startsWith('/expired')) {
        res.writeHead(403).end();
        return;
      }
      const m = /bytes=(\d+)-(\d+)/.exec(req.headers.range ?? '');
      const start = m ? Number(m[1]) : 0;
      const end = m ? Math.min(Number(m[2]), body.length - 1) : body.length - 1;
      res.writeHead(m ? 206 : 200, {
        'Content-Type': 'audio/webm',
        'Content-Length': end - start + 1,
        ...(m ? { 'Content-Range': `bytes ${start}-${end}/${body.length}` } : {}),
      });
      res.end(body.subarray(start, end + 1));
    });
    await new Promise((r) => media.listen(0, '127.0.0.1', r));
    process.env.FAKE_MEDIA = `http://127.0.0.1:${media.address().port}`;
    process.env.FAKE_STATE = path.join(tmpDir(), 'counter');
    ctx = await startHub({ hub: { ytdlpPath: path.join(here, 'fake-ytdlp.js') } });
    ctx.hub.youtube.chunkBytes = 64 * 1024;
  });
  after(async () => {
    await ctx.hub.close();
    media.close();
  });

  test('status and search (YouTube Music songs, junk filtered out)', async () => {
    assert.deepEqual((await ctx.call('GET', '/api/youtube/status')).data, { available: true, version: '2099.01.01' });
    const { data } = await ctx.call('GET', '/api/youtube/search?q=hello');
    assert.deepEqual(data.map((i) => i.id), ['AAAAAAAAAAA', 'BBBBBBBBBBB']);
    assert.equal(data[0].artist, 'Artist A');
    assert.equal(data[0].artwork, 'https://i.example/AAAAAAAAAAA.jpg');
  });

  test('falls back to regular YouTube search when YT Music has no songs', async () => {
    const { data } = await ctx.call('GET', '/api/youtube/search?q=nothing');
    assert.deepEqual(data.map((i) => i.id), ['CCCCCCCCCCC']);
  });

  test('resolves playlists and single links; rejects other sites', async () => {
    const pl = await ctx.call('POST', '/api/youtube/resolve', { url: 'https://music.youtube.com/playlist?list=PL123' });
    assert.equal(pl.data.title, 'Road Trip');
    assert.equal(pl.data.items.length, 2);
    const one = await ctx.call('POST', '/api/youtube/resolve', { url: 'https://music.youtube.com/watch?v=FFFFFFFFFFF' });
    assert.equal(one.data.items[0].title, 'Single (track)');
    assert.equal((await ctx.call('POST', '/api/youtube/resolve', { url: 'https://evil.example/watch?v=x' })).status, 400);
  });

  test('proxies audio in chunks, re-resolves an expired URL, honours Range', async () => {
    const full = Buffer.from(await (await fetch(`${ctx.base}/media/youtube/AAAAAAAAAAA`)).arrayBuffer());
    assert.equal(full.length, body.length);
    assert.ok(full.equals(body));
    assert.ok(seen.some((s) => s.url.startsWith('/expired')), 'first URL was the expired one');
    assert.ok(seen.filter((s) => s.url.startsWith('/audio')).length >= 5, 'fetched in several chunks');
    assert.ok(seen.every((s) => s.ua === 'fake-agent'), 'yt-dlp headers forwarded');
    const part = await fetch(`${ctx.base}/media/youtube/AAAAAAAAAAA`, { headers: { Range: 'bytes=1000-1999' } });
    assert.equal(part.status, 206);
    assert.equal(part.headers.get('content-range'), `bytes 1000-1999/${body.length}`);
    assert.ok(Buffer.from(await part.arrayBuffer()).equals(body.subarray(1000, 2000)));
    const tail = await fetch(`${ctx.base}/media/youtube/AAAAAAAAAAA`, { headers: { Range: 'bytes=200000-' } });
    assert.ok(Buffer.from(await tail.arrayBuffer()).equals(body.subarray(200000)));
  });
});

describe('real mpv bridge', { skip: !hasMpv && 'mpv is not installed' }, () => {
  test('plays through the queue with real decoding (null audio output)', async () => {
    const ctx = await startHub({
      token: 'tok',
      tracks: { 'Mix/01 A.wav': { seconds: 1.5, title: 'A' }, 'Mix/02 B.wav': { seconds: 1.5, title: 'B' }, 'Mix/03 C.wav': { seconds: 20, title: 'C' } },
    });
    const proc = spawn(process.execPath, [path.join(here, '../../agent/src/index.js')], {
      env: { ...process.env, MULTIROOM_HUB: ctx.base, MULTIROOM_TOKEN: 'tok', ZONE_ID: 'mpvroom', ZONE_NAME: 'Mpv Room', MPV_EXTRA_ARGS: '--ao=null' },
      stdio: 'ignore',
    });
    const zone = async () => (await ctx.call('GET', '/api/zones/mpvroom')).data;
    try {
      await waitFor(async () => (await zone())?.online, { message: 'mpv bridge online' });
      await ctx.call('PUT', '/api/zones/mpvroom/volume', { volume: 42 });
      await ctx.call('POST', '/api/zones/mpvroom/play', { items: [{ kind: 'collection', name: 'Mix' }] });
      await waitFor(async () => (await zone()).current.title === 'C', { message: 'reached C', timeout: 15000 });
      const z = await waitFor(async () => {
        const cur = await zone();
        return cur.playback === 'playing' && cur.position > 0.3 && cur;
      }, { message: 'C playing' });
      assert.equal(z.duration > 19, true);
      await ctx.call('POST', '/api/zones/mpvroom/seek', { position: 15 });
      await waitFor(async () => (await zone()).position >= 15, { message: 'seeked' });
      await ctx.call('POST', '/api/zones/mpvroom/pause');
      await waitFor(async () => (await zone()).playback === 'paused', { message: 'mpv paused' });
    } finally {
      proc.kill('SIGTERM');
      await new Promise((r) => proc.once('exit', r));
      await ctx.hub.close();
    }
  });
});
