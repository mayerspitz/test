import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { waitForMount } from '../src/home.js';
import { tmpDir } from './helpers.js';

const quiet = { info() {}, warn() {}, error() {} };

test('waits for the music drive only when it is an fstab mount point', async () => {
  const d = tmpDir();
  const fstab = path.join(d, 'fstab');
  const mounts = path.join(d, 'mounts');
  fs.writeFileSync(fstab, '# comment\nUUID=abc /srv/multiroom exfat defaults,nofail 0 0\n');
  fs.writeFileSync(mounts, '/dev/mmcblk0p2 / ext4 rw 0 0\n');
  assert.equal(await waitForMount('/srv/other', quiet, { fstab, mounts }), true, 'not in fstab: no wait');
  assert.equal(await waitForMount('/srv/multiroom', quiet, { fstab, mounts, timeoutMs: 100 }), false, 'never mounted: gives up');
  setTimeout(() => fs.appendFileSync(mounts, '/dev/sda1 /srv/multiroom exfat rw 0 0\n'), 300);
  const t = Date.now();
  assert.equal(await waitForMount('/srv/multiroom', quiet, { fstab, mounts, timeoutMs: 10_000 }), true);
  assert.ok(Date.now() - t >= 250);
});
