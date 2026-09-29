import { execFile, spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import { badRequest, HttpError, notFound } from './errors.js';

// Speaker setup from the app (runs on the home Pi): list the USB Bluetooth adapters,
// scan for speakers, pair one to a free adapter and start playing to it — no terminal.
// One adapter per speaker; a speaker is tied to its adapter by the adapter's address.
const AUDIO_SINK_UUID = '0000110b-0000-1000-8000-00805f9b34fb';
const MAC_RE = /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/i;

export class SpeakerSetup extends EventEmitter {
  constructor({ getConfig, saveConfig, log, scanSeconds = 12, pairWaitMs = 10_000, configFile = null }) {
    super();
    this.configFile = configFile;
    this.getConfig = getConfig;
    this.saveConfig = saveConfig;
    this.log = log;
    this.scanSeconds = scanSeconds;
    this.pairWaitMs = pairWaitMs;
    this.busy = null;
  }

  get speakers() {
    return this.getConfig().speakers ?? [];
  }

  async #objects() {
    const out = await run('busctl', ['--system', '--json=short', 'call', 'org.bluez', '/', 'org.freedesktop.DBus.ObjectManager', 'GetManagedObjects']);
    const data = JSON.parse(out).data;
    return Array.isArray(data) ? data[0] : data;
  }

  async adapters() {
    let objs;
    try {
      objs = await this.#objects();
    } catch (err) {
      throw new HttpError(503, `Bluetooth is not available on the Pi: ${err.message}`);
    }
    const out = [];
    for (const [path, ifaces] of Object.entries(objs)) {
      const a = ifaces['org.bluez.Adapter1'];
      if (!a) continue;
      const name = path.split('/').pop();
      const address = val(a.Address);
      const owner = this.speakers.find((s) => [address, name].includes(String(s.bluetooth?.adapter ?? '').toUpperCase()) || s.bluetooth?.adapter === name);
      out.push({ name, address, powered: Boolean(val(a.Powered)), usb: isUsb(name), speaker: owner?.zone.id ?? null });
    }
    // The Pi's built-in radio shares its antenna with Wi-Fi: when USB adapters are present,
    // never use it for a speaker (even if the "disable-bt" setting didn't take effect).
    const anyUsb = out.some((a) => a.usb === true);
    for (const a of out) a.usable = !(anyUsb && a.usb === false);
    return out.sort((x, y) => x.name.localeCompare(y.name, undefined, { numeric: true }));
  }

  async status() {
    const adapters = await this.adapters();
    return {
      adapters,
      free: adapters.filter((a) => a.usable && !a.speaker).length,
      speakers: this.speakers.map((s) => ({ id: s.zone.id, name: s.zone.name, speaker: s.bluetooth?.speaker ?? null, adapter: s.bluetooth?.adapter ?? null })),
    };
  }

  // Look for nearby Bluetooth devices (speakers must be in pairing mode).
  async scan(seconds = this.scanSeconds) {
    return this.#exclusive('scan', async () => {
      const adapters = await this.adapters();
      const use = adapters.filter((a) => a.usable && !a.speaker);
      if (!use.length) throw new HttpError(409, 'Every Bluetooth adapter already has a speaker. Plug in another USB Bluetooth adapter first.');
      for (const a of use) {
        await busctl(['call', 'org.bluez', `/org/bluez/${a.name}`, 'org.bluez.Adapter1', 'SetDiscoveryFilter', 'a{sv}', '1', 'Transport', 's', 'bredr']).catch(() => {});
        await busctl(['call', 'org.bluez', `/org/bluez/${a.name}`, 'org.bluez.Adapter1', 'StartDiscovery']).catch((e) => this.log.warn(`scan ${a.name}: ${e.message}`));
      }
      await new Promise((r) => setTimeout(r, Math.min(Math.max(Number(seconds) || this.scanSeconds, 3), 30) * 1000));
      for (const a of use) await busctl(['call', 'org.bluez', `/org/bluez/${a.name}`, 'org.bluez.Adapter1', 'StopDiscovery']).catch(() => {});
      return this.#devices(use);
    });
  }

  async #devices(adapters) {
    const objs = await this.#objects();
    const configured = new Set(this.speakers.map((s) => s.bluetooth?.speaker?.toUpperCase()));
    const names = new Set(adapters.map((a) => a.name));
    const byAddr = new Map();
    for (const [path, ifaces] of Object.entries(objs)) {
      const d = ifaces['org.bluez.Device1'];
      if (!d) continue;
      const adapter = path.split('/')[3];
      if (!names.has(adapter)) continue;
      const address = String(val(d.Address)).toUpperCase();
      const uuids = val(d.UUIDs) ?? [];
      const icon = val(d.Icon) ?? '';
      const entry = {
        address,
        name: val(d.Alias) ?? val(d.Name) ?? address,
        audio: icon.startsWith('audio') || uuids.includes(AUDIO_SINK_UUID),
        rssi: val(d.RSSI) ?? null,
        paired: Boolean(val(d.Paired)),
        configured: configured.has(address),
        adapter,
      };
      const prev = byAddr.get(address);
      if (!prev || (entry.rssi ?? -999) > (prev.rssi ?? -999)) byAddr.set(address, entry);
    }
    return [...byAddr.values()]
      .filter((d) => !d.configured)
      .sort((a, b) => Number(b.audio) - Number(a.audio) || (b.rssi ?? -999) - (a.rssi ?? -999) || a.name.localeCompare(b.name));
  }

  // Pair `address` to a free adapter, remember it, and start driving it.
  async add({ address, name }) {
    const mac = String(address ?? '').toUpperCase();
    if (!MAC_RE.test(mac)) throw badRequest('Pick a speaker from the scan');
    if (this.speakers.some((s) => s.bluetooth?.speaker?.toUpperCase() === mac)) throw new HttpError(409, 'That speaker is already set up');
    return this.#exclusive('pair', async () => {
      const adapters = (await this.adapters()).filter((a) => a.usable && !a.speaker);
      if (!adapters.length) throw new HttpError(409, 'Every Bluetooth adapter already has a speaker. Plug in another USB Bluetooth adapter first.');
      // Prefer the free adapter that already knows the device (it saw it during the scan).
      const objs = await this.#objects();
      const adapter = adapters.find((a) => objs[`/org/bluez/${a.name}/dev_${mac.replace(/:/g, '_')}`]) ?? adapters[0];
      const devPath = `/org/bluez/${adapter.name}/dev_${mac.replace(/:/g, '_')}`;
      this.log.info(`Pairing ${mac} with adapter ${adapter.name} (${adapter.address})`);
      await btctl([`select ${adapter.address}`, 'power on', 'agent NoInputNoOutput', 'default-agent', 'scan on', `wait:${Math.round(this.pairWaitMs / 2)}`, `pair ${mac}`, `wait:${this.pairWaitMs}`, `trust ${mac}`, 'scan off']);
      const paired = await busctl(['get-property', 'org.bluez', devPath, 'org.bluez.Device1', 'Paired']).catch(() => 'b false');
      if (!/true/.test(paired)) throw new HttpError(502, 'Pairing failed. Make sure the speaker is on and in pairing mode (usually a long press on its Bluetooth button), then try again.');
      await busctl(['set-property', 'org.bluez', devPath, 'org.bluez.Device1', 'Trusted', 'b', 'true']).catch(() => {});
      await busctl(['--timeout=30', 'call', 'org.bluez', devPath, 'org.bluez.Device1', 'Connect'], 35_000).catch(() => {});
      const cfg = this.getConfig();
      const label = String(name ?? '').trim().slice(0, 60) || (await this.#alias(devPath)) || 'Speaker';
      const entry = { zone: { id: uniqueId(label, this.speakers), name: label }, bluetooth: { speaker: mac, adapter: adapter.address }, player: { type: 'mpv' } };
      cfg.speakers = [...this.speakers, entry];
      this.saveConfig(cfg);
      this.emit('speaker-added', entry);
      return { id: entry.zone.id, name: label, adapter: adapter.address };
    });
  }

  // Runs deploy/doctor.sh (the system check) and returns its report.
  check() {
    return new Promise((resolve) => {
      const script = new URL('../../deploy/doctor.sh', import.meta.url).pathname;
      execFile('bash', [script], { timeout: 180_000, env: { ...process.env, HOME_AUDIO_CONFIG: this.configFile ?? '' } }, (err, stdout, stderr) => {
        resolve({ ok: !err, report: `${stdout}${stderr ? `\n${stderr}` : ''}`.trim() });
      });
    });
  }

  async remove(id) {
    const sp = this.speakers.find((s) => s.zone.id === id);
    if (!sp) throw notFound('Speaker');
    const cfg = this.getConfig();
    cfg.speakers = this.speakers.filter((s) => s.zone.id !== id);
    this.saveConfig(cfg);
    this.emit('speaker-removed', id);
    if (sp.bluetooth?.adapter && sp.bluetooth?.speaker) {
      await btctl([`select ${sp.bluetooth.adapter}`, `remove ${sp.bluetooth.speaker}`]).catch(() => {});
    }
    return { ok: true };
  }

  async #alias(devPath) {
    try {
      return JSON.parse((await busctl(['get-property', 'org.bluez', devPath, 'org.bluez.Device1', 'Alias'])).replace(/^s /, '').trim());
    } catch {
      return null;
    }
  }

  async #exclusive(what, fn) {
    if (this.busy) throw new HttpError(409, `Busy (${this.busy}); try again in a moment`);
    this.busy = what;
    try {
      return await fn();
    } finally {
      this.busy = null;
    }
  }
}

const val = (v) => (v && typeof v === 'object' && 'data' in v ? v.data : v);

function isUsb(name) {
  try {
    return fs.realpathSync(`/sys/class/bluetooth/${name}/device`).includes('/usb');
  } catch {
    return null;
  }
}

export function uniqueId(name, speakers) {
  const base = String(name).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'speaker';
  const taken = new Set(speakers.map((s) => s.zone.id));
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
  return id;
}

function busctl(args, timeout = 15_000) {
  return run('busctl', ['--system', ...args], timeout);
}

function run(cmd, args, timeout = 15_000) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout, maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(new Error((stderr || err.message).trim()));
      else resolve(stdout);
    });
  });
}

// Drive bluetoothctl (it provides the pairing agent). "wait:ms" pauses between commands.
function btctl(commands) {
  return new Promise((resolve, reject) => {
    const p = spawn('bluetoothctl', [], { stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    p.stdout.on('data', (d) => (out += d));
    p.on('error', reject);
    p.on('close', () => resolve(out));
    const timer = setTimeout(() => p.kill(), 90_000);
    p.on('close', () => clearTimeout(timer));
    (async () => {
      for (const c of commands) {
        if (c.startsWith('wait:')) await new Promise((r) => setTimeout(r, Number(c.slice(5))));
        else {
          p.stdin.write(`${c}\n`);
          await new Promise((r) => setTimeout(r, 300));
        }
      }
      p.stdin.end('quit\n');
    })();
  });
}
