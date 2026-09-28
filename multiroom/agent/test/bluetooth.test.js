import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { BluetoothLink, hardwareVolumeDisabled, parseBusctlValue, WIREPLUMBER_DROPIN } from '../src/bluetooth.js';
import { loadAgentConfig } from '../src/config.js';

const MAC = 'AA:BB:CC:DD:EE:FF';
const quiet = { info() {}, warn() {}, error() {} };

test('parses busctl property output', () => {
  assert.equal(parseBusctlValue('b true\n'), true);
  assert.equal(parseBusctlValue('b false'), false);
  assert.equal(parseBusctlValue('s "JBL Flip 6"'), 'JBL Flip 6');
  assert.equal(parseBusctlValue('y 80'), 80);
});

test('config validation', () => {
  const env = { ZONE_ID: 'Kitchen', BT_SPEAKER: 'aa:bb:cc:dd:ee:ff' };
  const cfg = loadAgentConfig([], env);
  assert.equal(cfg.zone.id, 'kitchen');
  assert.equal(cfg.bluetooth.speaker, MAC);
  assert.equal(cfg.bluetooth.adapter, 'hci0');
  assert.throws(() => loadAgentConfig([], {}), /zone\.id is required/);
  assert.throws(() => loadAgentConfig([], { ZONE_ID: 'x', BT_SPEAKER: 'nope' }), /MAC address/);
  assert.equal(loadAgentConfig([], { ZONE_ID: 'x' }).bluetooth, undefined);
});

// Fake busctl/pactl on PATH so the BlueZ logic can be exercised without Bluetooth.
describe('BluetoothLink with fake BlueZ + PipeWire', () => {
  let dir;
  let oldPath;
  let oldHome;
  const state = (s) => fs.writeFileSync(path.join(dir, 'state.json'), JSON.stringify(s));
  const calls = () => fs.readFileSync(path.join(dir, 'calls.log'), 'utf8').trim().split('\n').filter(Boolean);

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bt-test-'));
    fs.writeFileSync(path.join(dir, 'calls.log'), '');
    const js = (body) => `#!/usr/bin/env node
const fs = require('fs'); const p = require('path');
const dir = ${JSON.stringify(dir)};
const args = process.argv.slice(2);
fs.appendFileSync(p.join(dir, 'calls.log'), p.basename(process.argv[1]) + ' ' + args.join(' ') + '\\n');
const st = JSON.parse(fs.readFileSync(p.join(dir, 'state.json'), 'utf8'));
const save = () => fs.writeFileSync(p.join(dir, 'state.json'), JSON.stringify(st));
${body}`;
    fs.writeFileSync(path.join(dir, 'busctl'), js(`
if (args.includes('set-property')) process.exit(0);
const adapters = st.adapters || { hci0: '00:1A:7D:DA:71:01' };
if (args.includes('tree')) { console.log('/org/bluez'); for (const n of Object.keys(adapters)) console.log('/org/bluez/' + n); process.exit(0); }
if (args.includes('org.bluez.Adapter1')) { const n = args.find((a) => a.startsWith('/org/bluez/')).split('/')[3]; if (!adapters[n]) process.exit(1); console.log('s "' + adapters[n] + '"'); process.exit(0); }
if (!st.paired) { process.stderr.write('Failed to get property: Unknown object'); process.exit(1); }
if (args.includes('Connect')) {
  if (st.connectFails > 0) { st.connectFails--; save(); process.stderr.write('Call failed: Host is down'); process.exit(1); }
  st.connected = true; save(); process.exit(0);
}
const prop = args[args.length - 1];
if (prop === 'Connected') console.log('b ' + st.connected);
else if (prop === 'Alias') console.log('s "Test Speaker"');
else if (prop === 'Percentage') { if (st.battery == null) { process.stderr.write('Unknown interface'); process.exit(1); } console.log('y ' + st.battery); }
`), { mode: 0o755 });
    fs.writeFileSync(path.join(dir, 'pactl'), js(`
if (args[0] === 'list') { if (st.connected) console.log('57\\tbluez_output.AA_BB_CC_DD_EE_FF.1\\tPipeWire\\ts16le 2ch 48000Hz\\tSUSPENDED'); }
`), { mode: 0o755 });
    oldPath = process.env.PATH;
    oldHome = process.env.HOME;
    process.env.PATH = `${dir}:${oldPath}`;
    process.env.HOME = dir;
  });
  afterEach(() => {
    process.env.PATH = oldPath;
    process.env.HOME = oldHome;
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const until = async (fn, ms = 6000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (fn()) return;
      await new Promise((r) => setTimeout(r, 25));
    }
    throw new Error('timed out');
  };

  test('reports a speaker that is not paired with this adapter', async () => {
    state({ paired: false });
    const bt = new BluetoothLink({ speaker: MAC, pollSeconds: 60 }, quiet);
    bt.start();
    await until(() => bt.paired === false);
    bt.stop();
    assert.match(bt.status().message, /not paired/);
    assert.ok(!calls().some((c) => /Device1 Connect$/.test(c)));
  });

  test('reconnects with backoff and pins the sink at 100% only when HW volume is disabled', async () => {
    fs.mkdirSync(path.join(dir, '.config/wireplumber/wireplumber.conf.d'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.config/wireplumber/wireplumber.conf.d', WIREPLUMBER_DROPIN), '# test');
    assert.equal(hardwareVolumeDisabled(dir), true);
    state({ paired: true, connected: false, connectFails: 1, battery: 77 });
    const bt = new BluetoothLink({ speaker: MAC, pollSeconds: 60 }, quiet);
    bt.start();
    await until(() => bt.status().message?.includes('off or out of range'));
    bt.nextAttempt = 0; // skip the 5 s backoff
    await bt.reconnectNow();
    await bt.reconnectNow(); // next poll sees the connection
    await until(() => bt.connected);
    bt.stop();
    const s = bt.status();
    assert.equal(s.name, 'Test Speaker');
    assert.equal(s.battery, 77);
    assert.equal(s.sink, 'bluez_output.AA_BB_CC_DD_EE_FF.1');
    assert.ok(calls().some((c) => c === 'pactl set-sink-volume bluez_output.AA_BB_CC_DD_EE_FF.1 100%'));
    assert.ok(calls().some((c) => c.includes('/org/bluez/hci0/dev_AA_BB_CC_DD_EE_FF org.bluez.Device1 Connect')));
  });

  test('finds the adapter by its address even when hciN numbering changes', async () => {
    state({ paired: true, connected: true, adapters: { hci0: '11:11:11:11:11:11', hci1: '22:22:22:22:22:22' } });
    const bt = new BluetoothLink({ speaker: MAC, adapter: '22:22:22:22:22:22', pollSeconds: 60 }, quiet);
    bt.start();
    await until(() => bt.connected);
    assert.equal(bt.adapter, 'hci1');
    // after a reboot the same adapter comes up as hci0
    state({ paired: true, connected: true, adapters: { hci0: '22:22:22:22:22:22', hci1: '11:11:11:11:11:11' } });
    await bt.reconnectNow();
    assert.equal(bt.adapter, 'hci0');
    // unplugged
    state({ paired: true, connected: true, adapters: { hci0: '11:11:11:11:11:11' } });
    await bt.reconnectNow();
    bt.stop();
    assert.equal(bt.connected, false);
    assert.match(bt.status().message, /not found/);
    assert.ok(calls().some((c) => c.includes('/org/bluez/hci1/dev_AA_BB_CC_DD_EE_FF org.bluez.Device1 Connected')));
  });

  test('never touches the sink volume if the WirePlumber drop-in is missing', async () => {
    assert.equal(hardwareVolumeDisabled(dir), fs.existsSync(path.join('/etc/wireplumber/wireplumber.conf.d', WIREPLUMBER_DROPIN)));
    state({ paired: true, connected: true });
    const bt = new BluetoothLink({ speaker: MAC, adapter: 'hci1', pollSeconds: 60 }, quiet);
    bt.start();
    await until(() => bt.connected && bt.sink);
    bt.stop();
    if (!hardwareVolumeDisabled(dir)) assert.ok(!calls().some((c) => c.includes('set-sink-volume')));
    assert.ok(calls().some((c) => c.includes('/org/bluez/hci1/dev_AA_BB_CC_DD_EE_FF')));
  });
});
