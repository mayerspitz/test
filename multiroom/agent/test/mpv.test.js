import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { MpvPlayer } from '../src/mpv.js';

const hasMpv = spawnSync('mpv', ['--version']).status === 0;
const quiet = { info() {}, warn() {}, error() {} };

function wav(file, seconds) {
  const rate = 8000;
  const data = Buffer.alloc(rate * seconds * 2);
  const head = Buffer.alloc(44);
  head.write('RIFF', 0);
  head.writeUInt32LE(36 + data.length, 4);
  head.write('WAVEfmt ', 8);
  head.writeUInt32LE(16, 16);
  head.writeUInt16LE(1, 20);
  head.writeUInt16LE(1, 22);
  head.writeUInt32LE(rate, 24);
  head.writeUInt32LE(rate * 2, 28);
  head.writeUInt16LE(2, 32);
  head.writeUInt16LE(16, 34);
  head.write('data', 36);
  head.writeUInt32LE(data.length, 40);
  fs.writeFileSync(file, Buffer.concat([head, data]));
}

test('MpvPlayer: load paused, seek on load, software volume, eof and errors', { skip: !hasMpv && 'mpv not installed' }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mpv-test-'));
  const short = path.join(dir, 'short.wav');
  const long = path.join(dir, 'long.wav');
  wav(short, 1);
  wav(long, 20);
  const p = new MpvPlayer({ zoneId: 'test', extraArgs: ['--ao=null'], log: quiet });
  await p.start();
  const events = [];
  p.on('ended', (e) => events.push(e));
  const loaded = [];
  p.on('loaded', (uid) => loaded.push(uid));
  const until = async (fn) => {
    const end = Date.now() + 8000;
    while (Date.now() < end) {
      if (fn()) return;
      await new Promise((r) => setTimeout(r, 25));
    }
    throw new Error(`timed out; status=${JSON.stringify(p.status())}`);
  };
  try {
    await p.load({ uid: 'L', url: long, startAt: 12 });
    await until(() => loaded.includes('L'));
    await until(() => p.status().position >= 11.9);
    assert.equal(p.status().state, 'paused'); // loads paused; the agent decides when to play
    await p.setPaused(false);
    await until(() => p.status().state === 'playing');
    await p.setVolume(37);
    await until(() => p.status().volume === 37);

    await p.load({ uid: 'S', url: short });
    await p.setPaused(false);
    await until(() => events.some((e) => e.uid === 'S'));
    assert.deepEqual(events.map((e) => [e.uid, e.reason]), [['S', 'eof']]); // replacing L is not an "ended"
    assert.equal(p.status().state, 'idle');

    await p.load({ uid: 'X', url: path.join(dir, 'missing.mp3') });
    await until(() => events.some((e) => e.uid === 'X'));
    assert.equal(events.at(-1).reason, 'error');
  } finally {
    await p.stopProcess();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
