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
import { coverArt } from './png.js';
import { writeToneWav } from './tones.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(process.env.MULTIROOM_DATA_DIR || path.join(here, '..', 'demo-data'));
const port = Number(process.env.PORT || 8080);

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

function makeLibrary() {
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

makeLibrary();
const hub = await createHub({ dataDir, port, token: process.env.MULTIROOM_TOKEN ?? '', quiet: true, demo: true });
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
  const collection = (name) => hub.library.tracksOfCollection(name);
  const { makeItem } = await import('../src/queue.js');
  const items = (name) => collection(name).map((t) => makeItem({ kind: 'track', ref: t.id, title: t.title, artist: t.artist, album: t.album, duration: t.duration, artwork: `/api/library/tracks/${t.id}/cover` }));
  hub.zones.setVolume('kitchen', 55);
  hub.zones.play('kitchen', items('Kitchen MP3 player'));
  hub.zones.setVolume('patio', 70);
  hub.zones.play('patio', items('Patio MP3 player'), { startIndex: 2 });
  hub.zones.setVolume('bedroom', 25);
  hub.zones.play('bedroom', items('Bedroom MP3 player'));
  hub.zones.pause('bedroom');
  hub.zones.play('kids-room', items('Kids room MP3 player'));
}

const ips = Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address);
console.log(`\nDemo hub running with ${SPEAKERS.length} simulated speakers.`);
console.log(`  On this computer:  http://localhost:${hub.port}`);
for (const ip of ips) console.log(`  On your phone:     http://${ip}:${hub.port}   (same Wi-Fi)`);
console.log('\nKids Room shows a disconnected speaker, Office an offline bridge. Ctrl+C to stop.');
console.log(`Demo data lives in ${dataDir} — delete it to start fresh.\n`);

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => {
    for (const { agent } of agents) await agent.stop().catch(() => {});
    await hub.close();
    process.exit(0);
  });
}
