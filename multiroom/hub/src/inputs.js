import { execFile, spawn } from 'node:child_process';
import { notFound } from './errors.js';

// Live inputs: audio coming INTO the Pi, played on any speaker like a song.
//  - Bluetooth: an MP3 player / phone connected to the Pi as if it were a speaker
//    ("Home Audio"); it shows up in PipeWire as a bluez_input.* source.
//  - Cable: a USB line-in adapter (e.g. Behringer UCA202); an alsa_input.* source.
// Each listener gets a live WAV stream captured with parec (48 kHz, 16-bit stereo).
export class LiveInputs {
  constructor({ log, pactl = 'pactl', recorder = 'parec' } = {}) {
    this.log = log;
    this.pactl = pactl;
    this.recorder = recorder;
  }

  async list() {
    let sources;
    try {
      sources = JSON.parse(await run(this.pactl, ['--format=json', 'list', 'sources'])).map((s) => ({ name: s.name, description: s.description }));
    } catch {
      try {
        sources = parseSources(await run(this.pactl, ['list', 'sources']));
      } catch {
        return []; // no audio server (e.g. the cloud): no live inputs here
      }
    }
    return sources
      .filter((s) => /^(bluez_input|bluez_source|alsa_input)\./.test(s.name) && !s.name.endsWith('.monitor'))
      .filter((s) => !/^alsa_input\.platform-/.test(s.name)) // the Pi's own HDMI/codec inputs
      .map((s) => ({
        id: s.name,
        name: s.description || s.name,
        kind: s.name.startsWith('alsa_input') ? 'line-in' : 'bluetooth',
      }));
  }

  // Streams a live WAV (never ends) until the listener disconnects.
  async stream(req, res, id) {
    if (!(await this.list()).some((s) => s.id === id)) throw notFound('Live input (is the player connected?)');
    res.writeHead(200, { 'Content-Type': 'audio/wav', 'Cache-Control': 'no-store', 'Transfer-Encoding': 'chunked' });
    res.write(wavHeader(48_000, 2));
    const rec = spawn(this.recorder, [`--device=${id}`, '--format=s16le', '--rate=48000', '--channels=2', '--raw', '--latency-msec=100'], { stdio: ['ignore', 'pipe', 'ignore'] });
    rec.stdout.pipe(res);
    rec.on('error', (err) => {
      this.log?.warn(`Live input ${id}: ${err.message}`);
      res.end();
    });
    rec.on('close', () => res.end());
    res.on('close', () => rec.kill());
  }
}

// A WAV header for an endless stream (sizes set to the maximum).
export function wavHeader(rate, channels) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(0xffffffff, 4);
  h.write('WAVEfmt ', 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(channels, 22);
  h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * channels * 2, 28);
  h.writeUInt16LE(channels * 2, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36);
  h.writeUInt32LE(0xffffffff - 36, 40);
  return h;
}

function parseSources(text) {
  const out = [];
  let cur = null;
  for (const line of text.split('\n')) {
    if (/^Source #/.test(line)) out.push((cur = {}));
    const m = /^\s+(Name|Description):\s*(.*)$/.exec(line);
    if (cur && m) cur[m[1].toLowerCase()] = m[2].trim();
  }
  return out.filter((s) => s.name);
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 10_000 }, (err, stdout) => (err ? reject(err) : resolve(stdout)));
  });
}
