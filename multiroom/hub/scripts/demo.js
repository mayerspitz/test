// Try the whole system on any computer, no speakers needed:
//   npm install && npm run demo      (from the multiroom/ folder)
// Starts the hub with a generated sample library and six simulated speaker
// bridges, then prints the address to open on your phone.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Agent } from '../../agent/src/agent.js';
import { createLogger } from '../../agent/src/log.js';
import { SimulatedBluetooth, SimulatedPlayer } from '../../agent/src/simulated.js';
import { createHub } from '../src/server.js';
import { makeItem } from '../src/queue.js';
import { coverArt } from './png.js';
import { writeToneWav } from './tones.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const defaultDataDir = path.join(here, '..', 'demo-data');

const COLLECTIONS = [
  { name: 'Kitchen MP3 player', colors: [[255, 138, 76], [214, 51, 108]], artist: 'Morning Crew', songs: ['Coffee First', 'Sunlight on the Counter', 'Toast & Jam', 'Slow Sunday', 'Radio in the Window'] },
  { name: 'Kids room MP3 player', colors: [[92, 225, 230], [59, 130, 246]], artist: 'The Paper Planes', songs: ['Counting Stars Tonight', 'Dinosaur Parade', 'Bubble Bath Blues', 'Lullaby Moon'] },
  { name: 'Patio MP3 player', colors: [[163, 230, 53], [22, 163, 74]], artist: 'Garden Party', songs: ['Barbecue Groove', 'Lemonade', 'Fireflies', 'Hammock Swing', 'Late Summer'] },
  { name: 'Bedroom MP3 player', colors: [[196, 181, 253], [109, 40, 217]], artist: 'Night Owls', songs: ['Blue Hour', 'Soft Landing', 'Rain on Glass'] },
];

const SPEAKERS = [
  { id: 'kitchen', name: 'Kitchen', speaker: 'JBL Flip 6', battery: 84 },
  { id: 'living-room', name: 'Living Room', speaker: 'Bose SoundLink Flex', battery: null },
  { id: 'patio', name: 'Patio', speaker: 'UE Boom 3', battery: 23 },
  { id: 'kids-room', name: 'Kids Room', speaker: 'Sony SRS-XB13', battery: 67, connected: false },
  { id: 'bedroom', name: 'Master Bedroom', speaker: 'Marshall Emberton', battery: 91 },
  { id: 'office', name: 'Office', speaker: 'Anker Soundcore 2', battery: null, offline: true },
];

function makeLibrary(dataDir) {
  const lib = path.join(dataDir, 'library');
  if (fs.existsSync(lib)) return;
  console.log('Generating the sample library (first run only)…');
  const notes = [220, 247, 262, 294, 330, 349, 392, 440];
  COLLECTIONS.forEach((col, ci) => {
    const dir = path.join(lib, col.name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'cover.png'), coverArt(240, col.colors));
    col.songs.forEach((title, si) => {
      const root = notes[(ci * 3 + si) % notes.length];
      writeToneWav(path.join(dir, `${String(si + 1).padStart(2, '0')} ${title}.wav`), {
        seconds: 95 + ((ci * 37 + si * 23) % 120),
        rate: 8000,
        arpeggio: true,
        tempo: [0.3, 0.22, 0.26, 0.4][ci],
        freqs: si % 2 ? [root, root * 1.2, root * 1.5] : [root, root * 1.25, root * 1.5],
        title,
        artist: col.artist,
        album: col.name.replace(' MP3 player', ' mix'),
      });
    });
  });
}

// The demo has no real YouTube access (and no yt-dlp), so it gets a small pretend
// YouTube Music catalog, clearly labelled, played with generated tones.
const DEMO_YT = [
  ['demoYTsng01', 'Night Drive (demo YouTube)', 'Synth City'],
  ['demoYTsng02', 'Coastline (demo YouTube)', 'The Tides'],
  ['demoYTsng03', 'Paper Moon (demo YouTube)', 'June & the Lanterns'],
  ['demoYTsng04', 'Golden Hour (demo YouTube)', 'Solstice'],
  ['demoYTsng05', 'Slow Motion (demo YouTube)', 'Kite Club'],
  ['demoYTsng06', 'Rooftops (demo YouTube)', 'City Birds'],
];
const ytItem = ([id, title, artist], i) => ({ kind: 'youtube', ref: id, id, title, artist, duration: 95 + i * 17, artwork: null });
const itemOf = (t) => makeItem({ kind: 'track', ref: t.id, title: t.title, artist: t.artist, album: t.album, duration: t.duration, artwork: `/api/library/tracks/${t.id}/cover` });

function demoYouTube(hub) {
  const all = DEMO_YT.map(ytItem).map(({ ref, ...it }) => it);
  const byId = (id) => all.findIndex((x) => x.id === id);
  return {
    status: async () => ({ available: true, version: 'demo catalog' }),
    search: async (q) => {
      const words = String(q ?? '').toLowerCase().split(/\s+/).filter(Boolean);
      const hits = all.filter((x) => words.some((w) => `${x.title} ${x.artist}`.toLowerCase().includes(w)));
      return hits.length ? hits : all;
    },
    resolve: async (url) => (/list=/.test(String(url)) ? { title: 'Demo YouTube playlist', items: all } : { title: all[0].title, items: [all[Math.max(0, byId(new URL(String(url), 'https://x').searchParams.get('v')))]] }),
    // Play demo "YouTube" songs with the generated library tones.
    proxy: async (req, res, id) => {
      const tracks = hub.library.sorted();
      const t = tracks[(Math.max(0, byId(id)) * 3 + 2) % tracks.length];
      res.sendFile(hub.library.absPath(t), { acceptRanges: true, dotfiles: 'allow' });
    },
  };
}

// Starts a demo hub plus its simulated bridges. Also used by site.js to serve
// the demo next to the real app from one web service.
export async function startDemo({ dataDir = defaultDataDir, port = 8080, host, token = '' } = {}) {
  makeLibrary(dataDir);
  const hub = await createHub({ dataDir, port, host, token, quiet: true, demo: true });
  Object.assign(hub.youtube, demoYouTube(hub));
  const hubUrl = `http://127.0.0.1:${hub.port}`;

  const agents = [];
  for (const s of SPEAKERS) {
    const cfg = {
      hub: hubUrl,
      token: hub.config.token,
      zone: { id: s.id, name: s.name },
      bluetooth: { type: 'simulated', pauseWhenDisconnected: true },
      player: { type: 'simulated', audioDevice: 'auto' },
    };
    const agent = new Agent({
      cfg,
      player: new SimulatedPlayer(),
      bluetooth: new SimulatedBluetooth({ name: s.speaker, battery: s.battery, connected: s.connected !== false }),
      log: { info() {}, warn() {}, error: createLogger(s.id).error },
    });
    await agent.start();
    agents.push({ s, agent });
  }

  // Give bridges a moment to register, then start different music in a few rooms.
  await new Promise((r) => setTimeout(r, 800));
  for (const { s, agent } of agents) if (s.offline) await agent.stop();
  const fresh = Object.values(hub.zones.zones).every((z) => !z.queue.length);
  if (fresh) {
    const items = (name) => hub.library.tracksOfCollection(name).map((t) => makeItem({ kind: 'track', ref: t.id, title: t.title, artist: t.artist, album: t.album, duration: t.duration, artwork: `/api/library/tracks/${t.id}/cover` }));
    hub.zones.setVolume('kitchen', 55);
    hub.zones.play('kitchen', items('Kitchen MP3 player'));
    hub.zones.setVolume('patio', 70);
    hub.zones.play('patio', items('Patio MP3 player'), { startIndex: 2 });
    hub.zones.setVolume('bedroom', 25);
    hub.zones.play('bedroom', items('Bedroom MP3 player'));
    hub.zones.pause('bedroom');
    hub.zones.play('kids-room', items('Kids room MP3 player'));
  }
  if (!Object.keys(hub.playlists.all).length) {
    // A ready-made mixed playlist: library songs and (demo) YouTube songs, interleaved.
    const local = hub.library.sorted();
    const yt = DEMO_YT.map(ytItem);
    hub.playlists.create('Demo mix: library + YouTube', [
      itemOf(local[0]), makeItem(yt[0]), itemOf(local[6]), makeItem(yt[1]), makeItem(yt[2]), itemOf(local[11]),
    ]);
  }

  const stop = async () => {
    for (const { agent } of agents) await agent.stop().catch(() => {});
    await hub.close();
  };
  return { hub, stop, dataDir };
}

// Run directly: `npm run demo`
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.env.REDIRECT_TO) {
  // A retired demo address: send every visitor to the new one.
  const target = process.env.REDIRECT_TO;
  const { createServer } = await import('node:http');
  createServer((req, res) => {
    res.writeHead(req.url === '/api/health' ? 200 : 301, { Location: target, 'Content-Type': 'text/plain' });
    res.end(`Moved to ${target}`);
  }).listen(Number(process.env.PORT || 8080));
  console.log(`Redirecting everything to ${target}`);
} else if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dataDir = path.resolve(process.env.MULTIROOM_DATA_DIR || defaultDataDir);
  const { hub, stop } = await startDemo({ dataDir, port: Number(process.env.PORT || 8080), token: process.env.MULTIROOM_TOKEN ?? '' });
  const ips = Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address);
  console.log(`\nDemo hub running with ${SPEAKERS.length} simulated speakers.`);
  console.log(`  On this computer:  http://localhost:${hub.port}`);
  for (const ip of ips) console.log(`  On your phone:     http://${ip}:${hub.port}   (same Wi-Fi)`);
  console.log('\nKids Room shows a disconnected speaker, Office an offline bridge. Ctrl+C to stop.');
  console.log(`Demo data lives in ${dataDir} — delete it to start fresh.\n`);
  for (const sig of ['SIGINT', 'SIGTERM']) {
    process.on(sig, async () => {
      await stop();
      process.exit(0);
    });
  }
}
