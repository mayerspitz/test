import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHub } from '../src/server.js';
import { writeToneWav } from '../scripts/tones.js';

export function tmpDir(prefix = 'multiroom-test-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

export async function startHub(opts = {}) {
  const dataDir = opts.dataDir ?? tmpDir();
  if (opts.tracks) {
    for (const [rel, o] of Object.entries(opts.tracks)) writeToneWav(path.join(dataDir, 'library', rel), o);
  }
  const hub = await createHub({ dataDir, port: 0, host: '127.0.0.1', quiet: true, token: opts.token ?? '', ...opts.hub });
  await hub.library.rescan();
  const base = `http://127.0.0.1:${hub.port}`;
  const headers = opts.token ? { Authorization: `Bearer ${opts.token}` } : {};
  const call = async (method, p, body) => {
    const res = await fetch(base + p, {
      method,
      headers: { ...headers, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => null);
    return { status: res.status, data };
  };
  return { hub, base, dataDir, call };
}

export async function waitFor(fn, { timeout = 8000, interval = 50, message = 'condition' } = {}) {
  const end = Date.now() + timeout;
  let last;
  while (Date.now() < end) {
    last = await fn();
    if (last) return last;
    await new Promise((r) => setTimeout(r, interval));
  }
  throw new Error(`Timed out waiting for ${message} (last: ${JSON.stringify(last)})`);
}
