import fs from 'node:fs';
import path from 'node:path';

// Writes a small mono 16-bit WAV with a soft chord, plus RIFF INFO tags
// (title/artist/album) so the library shows real metadata. Used by the demo and tests.
export function writeToneWav(file, { seconds = 5, freqs = [440], rate = 8000, title, artist, album, arpeggio = false, tempo = 0.3 } = {}) {
  const samples = Math.round(seconds * rate);
  const data = Buffer.alloc(samples * 2);
  for (let i = 0; i < samples; i++) {
    const t = i / rate;
    const env = Math.min(1, t * 4, (seconds - t) * 4);
    let v = 0;
    if (arpeggio) {
      // A plucked arpeggio over a soft bass note, so demo tracks sound a bit like music.
      const step = Math.floor(t / tempo);
      const into = t - step * tempo;
      const pattern = [0, 1, 2, 1, 0, 2, 1, 2];
      const f = freqs[pattern[step % 8] % freqs.length] * (step % 32 >= 16 ? 2 : 1);
      v = Math.sin(2 * Math.PI * f * t) * Math.exp(-into * 7) * 0.8 + Math.sin(Math.PI * freqs[0] * t) * 0.3;
    } else {
      for (const f of freqs) v += Math.sin(2 * Math.PI * f * t);
      v /= freqs.length;
    }
    data.writeInt16LE(Math.round(v * env * 0.3 * 32767), i * 2);
  }
  const info = [
    ['INAM', title],
    ['IART', artist],
    ['IPRD', album],
  ].filter(([, v]) => v).map(([id, v]) => {
    const body = Buffer.from(`${v}\0`, 'utf8');
    const padded = body.length % 2 ? Buffer.concat([body, Buffer.alloc(1)]) : body;
    const head = Buffer.alloc(8);
    head.write(id, 0, 'ascii');
    head.writeUInt32LE(body.length, 4);
    return Buffer.concat([head, padded]);
  });
  const list = info.length ? Buffer.concat([Buffer.from('LIST'), u32(4 + info.reduce((n, b) => n + b.length, 0)), Buffer.from('INFO'), ...info]) : Buffer.alloc(0);
  const fmt = Buffer.alloc(24);
  fmt.write('fmt ', 0, 'ascii');
  fmt.writeUInt32LE(16, 4);
  fmt.writeUInt16LE(1, 8); // PCM
  fmt.writeUInt16LE(1, 10); // mono
  fmt.writeUInt32LE(rate, 12);
  fmt.writeUInt32LE(rate * 2, 16);
  fmt.writeUInt16LE(2, 20);
  fmt.writeUInt16LE(16, 22);
  const dataHead = Buffer.concat([Buffer.from('data'), u32(data.length)]);
  const body = Buffer.concat([Buffer.from('WAVE'), fmt, list, dataHead, data]);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.concat([Buffer.from('RIFF'), u32(body.length), body]));
}

function u32(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n);
  return b;
}
