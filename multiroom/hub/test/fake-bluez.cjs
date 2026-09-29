// Fake busctl / bluetoothctl / pactl for tests (installed on PATH under those names).
// State lives in $FAKE_BLUEZ_STATE: { adapters: { hci0: { address } }, nearby: [{ address, name, icon }], devices: { 'hci0/dev_X': {...} } }
const fs = require('node:fs');
const path = require('node:path');
const file = process.env.FAKE_BLUEZ_STATE;
const st = JSON.parse(fs.readFileSync(file, 'utf8'));
st.devices ??= {};
const save = () => fs.writeFileSync(file, JSON.stringify(st));
const tool = path.basename(process.argv[1]);
const args = process.argv.slice(2).filter((a) => !a.startsWith('--') || a === '--list');
const v = (type, data) => ({ type, data });

if (tool === 'busctl') {
  const p = args.find((a) => a.startsWith('/org/bluez'));
  const hci = p?.split('/')[3];
  const devKey = p?.split('/').length > 4 ? `${hci}/${p.split('/')[4]}` : null;
  if (args.includes('GetManagedObjects')) {
    const objs = {};
    for (const [n, a] of Object.entries(st.adapters)) objs[`/org/bluez/${n}`] = { 'org.bluez.Adapter1': { Address: v('s', a.address), Powered: v('b', true) } };
    for (const [k, d] of Object.entries(st.devices)) {
      objs[`/org/bluez/${k}`] = { 'org.bluez.Device1': { Address: v('s', d.address), Alias: v('s', d.name), Icon: v('s', d.icon ?? ''), RSSI: v('n', d.rssi ?? -60), Paired: v('b', !!d.paired), Connected: v('b', !!d.connected), UUIDs: v('as', []) } };
    }
    console.log(JSON.stringify({ type: 'a{oa{sa{sv}}}', data: [objs] }));
  } else if (args.includes('StartDiscovery')) {
    for (const d of st.nearby ?? []) st.devices[`${hci}/dev_${d.address.replace(/:/g, '_')}`] ??= { ...d };
    save();
  } else if (args.includes('tree')) {
    console.log('/org/bluez');
    for (const n of Object.keys(st.adapters)) console.log(`/org/bluez/${n}`);
  } else if (args[0] === 'get-property') {
    const prop = args[args.length - 1];
    if (args.includes('org.bluez.Adapter1')) {
      if (!st.adapters[hci]) process.exit(1);
      console.log(`s "${st.adapters[hci].address}"`);
    } else {
      const d = st.devices[devKey];
      if (!d) {
        process.stderr.write('Unknown object');
        process.exit(1);
      }
      if (prop === 'Alias') console.log(`s "${d.name}"`);
      else if (prop === 'Percentage') process.exit(1);
      else console.log(`b ${!!d[prop.toLowerCase()]}`);
    }
  } else if (args.includes('Connect')) {
    if (!st.devices[devKey]?.paired) process.exit(1);
    st.devices[devKey].connected = true;
    save();
  }
} else if (tool === 'bluetoothctl') {
  let sel = 'hci0';
  let buf = '';
  process.stdin.on('data', (c) => (buf += c));
  process.stdin.on('end', () => {
    for (const line of buf.split('\n')) {
      const [cmd, arg] = line.trim().split(/\s+/);
      if (cmd === 'select') sel = Object.entries(st.adapters).find(([, a]) => a.address === arg)?.[0] ?? sel;
      if (cmd === 'pair') {
        const d = st.devices[`${sel}/dev_${arg.replace(/:/g, '_')}`];
        if (d && !d.refusePairing) d.paired = true;
      }
      if (cmd === 'remove') delete st.devices[`${sel}/dev_${arg.replace(/:/g, '_')}`];
    }
    save();
  });
} else if (tool === 'pactl') {
  if (args[0] === 'list') {
    for (const d of Object.values(st.devices)) if (d.connected) console.log(`1\tbluez_output.${d.address.replace(/:/g, '_')}.1\tPipeWire\ts16le\tIDLE`);
  }
}
