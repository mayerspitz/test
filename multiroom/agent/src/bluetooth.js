import { execFile } from 'node:child_process';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Keeps one Bluetooth speaker connected to one adapter of this machine, using
// BlueZ over D-Bus (busctl ships with systemd, no extra packages needed).
//
// Volume guarantee: we never send a volume to the speaker. The WirePlumber
// drop-in installed by deploy/install-agent.sh disables Bluetooth "absolute
// volume", and only then do we pin the PipeWire sink at 100 % so mpv's software
// volume is the one and only volume control.
const MAC_RE = /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/i;
export const WIREPLUMBER_DROPIN = '51-multiroom-bluetooth.conf';

export class BluetoothLink extends EventEmitter {
  constructor({ speaker, adapter = 'hci0', autoReconnect = true, pollSeconds = 5, lockSinkVolume = true }, log) {
    super();
    this.address = speaker.toUpperCase();
    // `adapter` may be a name (hci0) or the adapter's own Bluetooth address. The address is
    // better with several identical USB adapters: hciN numbers can change between boots.
    this.adapterSpec = adapter;
    this.adapter = MAC_RE.test(adapter) ? null : adapter;
    this.autoReconnect = autoReconnect;
    this.pollMs = pollSeconds * 1000;
    this.lockSinkVolume = lockSinkVolume;
    this.log = log;
    this.connected = false;
    this.paired = true;
    this.name = null;
    this.battery = null;
    this.sink = null;
    this.message = null;
    this.nextAttempt = 0;
    this.backoff = 5000;
    this.warnedNoDropin = false;
  }

  get type() {
    return 'bluez';
  }

  status() {
    return {
      configured: true,
      address: this.address,
      adapter: this.adapter ?? this.adapterSpec,
      paired: this.paired,
      connected: this.connected,
      name: this.name,
      battery: this.battery,
      sink: this.sink,
      message: this.connected ? null : this.message,
    };
  }

  get devPath() {
    return `/org/bluez/${this.adapter}/dev_${this.address.replace(/:/g, '_')}`;
  }

  // Finds which hciN currently has the configured adapter address.
  async #resolveAdapter() {
    if (!MAC_RE.test(this.adapterSpec)) return this.adapter;
    const want = this.adapterSpec.toUpperCase();
    if (this.adapter) {
      const addr = await busctl(['get-property', 'org.bluez', `/org/bluez/${this.adapter}`, 'org.bluez.Adapter1', 'Address']).then(parseBusctlValue).catch(() => null);
      if (addr?.toUpperCase() === want) return this.adapter;
    }
    this.adapter = null;
    const tree = await busctl(['--list', 'tree', 'org.bluez']).catch(() => '');
    for (const name of tree.split('\n').map((l) => /^\/org\/bluez\/(hci\d+)$/.exec(l.trim())?.[1]).filter(Boolean)) {
      const addr = await busctl(['get-property', 'org.bluez', `/org/bluez/${name}`, 'org.bluez.Adapter1', 'Address']).then(parseBusctlValue).catch(() => null);
      if (addr?.toUpperCase() === want) {
        this.adapter = name;
        this.log.info(`Bluetooth adapter ${want} is ${name}`);
        await this.#powerOn();
        break;
      }
    }
    return this.adapter;
  }

  #powerOn() {
    return busctl(['set-property', 'org.bluez', `/org/bluez/${this.adapter}`, 'org.bluez.Adapter1', 'Powered', 'b', 'true']).catch((e) =>
      this.log.warn(`Could not power on ${this.adapter}: ${e.message}`),
    );
  }

  start() {
    if (this.adapter) this.#powerOn();
    this.#poll();
    this.timer = setInterval(() => this.#poll(), this.pollMs);
  }

  stop() {
    clearInterval(this.timer);
  }

  async reconnectNow() {
    this.nextAttempt = 0;
    this.backoff = 5000;
    await this.inflight; // let a poll that is already running finish, then poll fresh
    await this.#poll();
  }

  async #getProp(iface, prop) {
    return parseBusctlValue(await busctl(['get-property', 'org.bluez', this.devPath, iface, prop]));
  }

  #poll() {
    if (!this.inflight) this.inflight = this.#pollOnce().finally(() => (this.inflight = null));
    return this.inflight;
  }

  async #pollOnce() {
    this.polling = true;
    const before = JSON.stringify(this.status());
    try {
      if (!(await this.#resolveAdapter())) {
        this.connected = false;
        this.sink = null;
        this.message = `Bluetooth adapter ${this.adapterSpec} not found — is it plugged in?`;
        if (JSON.stringify(this.status()) !== before) this.emit('change');
        return;
      }
      let connected = false;
      try {
        connected = (await this.#getProp('org.bluez.Device1', 'Connected')) === true;
        this.paired = true;
      } catch (err) {
        if (/unknown object|not found|doesn't exist|no such/i.test(err.message)) {
          this.paired = false;
          this.message = `Speaker ${this.address} is not paired with ${this.adapter} — run deploy/pair-speaker.sh`;
        } else {
          this.message = `Bluetooth unavailable: ${err.message}`;
        }
      }
      if (this.paired && !this.name) this.name = await this.#getProp('org.bluez.Device1', 'Alias').catch(() => null);
      this.battery = connected ? await this.#getProp('org.bluez.Battery1', 'Percentage').catch(() => null) : null;

      if (connected && !this.connected) {
        this.log.info(`Speaker connected: ${this.name ?? this.address}`);
        this.connected = true;
        this.message = null;
        this.backoff = 5000;
        this.sink = await this.#waitForSink();
        if (this.sink) await this.#pinSinkVolume(this.sink);
      } else if (connected && !this.sink) {
        // The audio output can appear late (or after an audio-service restart): keep looking.
        this.sink = await this.#findSink();
        if (this.sink) await this.#pinSinkVolume(this.sink);
      } else if (!connected && this.connected) {
        this.log.warn(`Speaker disconnected: ${this.name ?? this.address}`);
        this.connected = false;
        this.sink = null;
      }
      if (!connected && this.paired && this.autoReconnect && Date.now() >= this.nextAttempt) await this.#tryConnect();
    } finally {
      this.polling = false;
    }
    if (JSON.stringify(this.status()) !== before) this.emit('change');
  }

  async #tryConnect() {
    this.message = 'Connecting…';
    this.emit('change');
    try {
      await busctl(['--timeout=30', 'call', 'org.bluez', this.devPath, 'org.bluez.Device1', 'Connect'], 35_000);
      this.message = null;
    } catch (err) {
      this.message = /host is down|page timeout|not available|in progress/i.test(err.message)
        ? 'Speaker is off or out of range — retrying'
        : `Connect failed: ${err.message}`;
      this.nextAttempt = Date.now() + this.backoff;
      this.backoff = Math.min(this.backoff * 2, 60_000);
    }
  }

  // PipeWire needs a moment after the Bluetooth link comes up to create the sink.
  async #waitForSink() {
    for (let i = 0; i < 20; i++) {
      const sink = await this.#findSink();
      if (sink || this.noPactl) return sink;
      await new Promise((r) => setTimeout(r, 500));
    }
    this.log.warn('Speaker connected but no audio sink appeared yet (is PipeWire running for this user?) — will keep checking');
    return null;
  }

  async #findSink() {
    const mac = this.address.replace(/:/g, '_');
    try {
      const out = await run('pactl', ['list', 'short', 'sinks']);
      const line = out.split('\n').find((l) => l.includes(`bluez_output.${mac}`) || l.includes(`bluez_sink.${mac}`));
      return line ? line.split('\t')[1] : null;
    } catch (err) {
      if (err.code === 'ENOENT') this.noPactl = true; // no pactl: not a PipeWire/Pulse setup, use the default device
      return null;
    }
  }

  async #pinSinkVolume(sink) {
    if (!this.lockSinkVolume) return;
    if (!hardwareVolumeDisabled()) {
      if (!this.warnedNoDropin) {
        this.log.warn(
          `WirePlumber drop-in ${WIREPLUMBER_DROPIN} not found, so Bluetooth absolute volume may be active. ` +
            'Not touching the sink volume to avoid changing the speaker\'s own volume. Run deploy/install-agent.sh.',
        );
        this.warnedNoDropin = true;
      }
      return;
    }
    // Pure software gain inside PipeWire (hardware volume is off): 100 % = untouched signal.
    await run('pactl', ['set-sink-volume', sink, '100%']).catch(() => {});
    await run('pactl', ['set-sink-mute', sink, '0']).catch(() => {});
  }
}

// True when our WirePlumber drop-in (0.5 .conf or 0.4 .lua) is installed for this user or system-wide.
export function hardwareVolumeDisabled(home = os.homedir()) {
  const lua = WIREPLUMBER_DROPIN.replace(/\.conf$/, '.lua');
  return [
    path.join(home, '.config/wireplumber/wireplumber.conf.d', WIREPLUMBER_DROPIN),
    path.join('/etc/wireplumber/wireplumber.conf.d', WIREPLUMBER_DROPIN),
    path.join(home, '.config/wireplumber/bluetooth.lua.d', lua),
    path.join('/etc/wireplumber/bluetooth.lua.d', lua),
  ].some((f) => fs.existsSync(f));
}

// `busctl get-property` prints e.g. `b true`, `s "JBL Flip 6"`, `y 80`.
export function parseBusctlValue(out) {
  const text = out.trim();
  const sp = text.indexOf(' ');
  const type = sp < 0 ? text : text.slice(0, sp);
  const value = sp < 0 ? '' : text.slice(sp + 1);
  if (type === 'b') return value === 'true';
  if (type === 's' || type === 'o') {
    try {
      return JSON.parse(value);
    } catch {
      return value.replace(/^"|"$/g, '');
    }
  }
  if (/^[ynqiuxt]$/.test(type)) return Number(value);
  if (type === 'd') return Number(value);
  return value;
}

function busctl(args, timeout = 10_000) {
  return run('busctl', ['--system', ...args], timeout);
}

function run(cmd, args, timeout = 10_000) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout }, (err, stdout, stderr) => {
      if (err) {
        const e = new Error((stderr || err.message).trim());
        e.code = err.code;
        reject(e);
      } else resolve(stdout);
    });
  });
}
