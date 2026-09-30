import dgram from 'node:dgram';
import { encodeMessage, decodeMessage } from './osc.js';
import { OFF } from '../engine/units.js';

// Behringer X32 / Midas M32 and X Air (XR12/16/18, MR18) over OSC/UDP.
// Addresses, ports and the fader law come from Patrick-Gilles Maillot's
// "Unofficial X32/M32 OSC Remote Protocol" and his X32-Behringer code; see
// docs/history/RESEARCH_NOTES.md.

const pad2 = (n) => String(n).padStart(2, '0');

export const MODELS = {
  x32: {
    label: 'Behringer X32 / Midas M32',
    port: 10023,
    channels: 32,
    buses: 16,
    busFader: (bus) => `/bus/${pad2(bus)}/mix/fader`,
    send: (ch, bus) => `/ch/${pad2(ch)}/mix/${pad2(bus)}/level`,
  },
  xair: {
    label: 'Behringer X Air (XR12/XR16/XR18) / Midas MR18',
    port: 10024,
    channels: 16,
    buses: 6,
    busFader: (bus) => `/bus/${bus}/mix/fader`,
    send: (ch, bus) => `/ch/${pad2(ch)}/mix/${pad2(bus)}/level`,
  },
};

export const FADER_STEPS = 1024; // bus and channel faders
export const SEND_STEPS = 161; // channel-to-bus send levels

/** Mixer level value (0..1) to dB: the consoles' four-segment fader law. */
export function levelToDb(f) {
  if (!(f > 0)) return OFF;
  if (f >= 0.5) return f * 40 - 30;
  if (f >= 0.25) return f * 80 - 50;
  if (f >= 0.0625) return f * 160 - 70;
  return f * 480 - 90;
}

/** dB to the nearest mixer level value (0..1) for a control with `steps` positions. */
export function dbToLevel(db, steps = FADER_STEPS) {
  if (db === OFF || db <= -90) return 0;
  const d = Math.min(db, 10);
  let f;
  if (d < -60) f = (d + 90) / 480;
  else if (d < -30) f = (d + 70) / 160;
  else if (d < -10) f = (d + 50) / 80;
  else f = (d + 30) / 40;
  const n = steps - 1;
  return Math.round(f * n) / n;
}

/** Checks that a venue's buses and channels exist on the chosen mixer. */
export function checkVenueForMixer(venue, modelName) {
  const model = MODELS[modelName];
  if (!model) return [`Unknown mixer type "${modelName}". Supported: ${Object.keys(MODELS).join(', ')}.`];
  const problems = [];
  for (const z of venue.zones) {
    if (z.bus > model.buses) problems.push(`Zone ${z.name} uses bus ${z.bus}, but the ${model.label} has ${model.buses} mix buses.`);
  }
  for (const ch of venue.channels) {
    if (ch.mixerChannel > model.channels) {
      problems.push(`Channel ${ch.name} is input ${ch.mixerChannel}, but the ${model.label} has ${model.channels} input channels.`);
    }
  }
  return problems;
}

/**
 * X32 meter replies carry one blob: a little-endian int32 count followed by
 * that many little-endian float32 values, linear, where 1.0 is 0 dBFS.
 */
export function parseX32MeterBlob(blob) {
  const count = blob.readInt32LE(0);
  if (4 + count * 4 > blob.length) throw new Error(`Meter blob says ${count} values but holds ${(blob.length - 4) / 4}.`);
  const values = new Float32Array(count);
  for (let i = 0; i < count; i++) values[i] = blob.readFloatLE(4 + i * 4);
  return values;
}

export const meterToDbfs = (v) => (v > 0 ? 20 * Math.log10(v) : OFF);

/**
 * Sends ZoneMix's changes to the mixer and keeps its update subscription
 * alive (the console forgets a client after 10 s without /xremote).
 */
export class BehringerMixer {
  constructor({ model = 'x32', host, port, keepAliveMs = 9000, socket } = {}) {
    this.model = MODELS[model];
    if (!this.model) throw new Error(`Unknown mixer type "${model}". Supported: ${Object.keys(MODELS).join(', ')}.`);
    if (!host) throw new Error('Set the mixer\'s IP address (ZONEMIX_MIXER_HOST).');
    this.host = host;
    this.port = port ?? this.model.port;
    this.keepAliveMs = keepAliveMs;
    this.socket = socket ?? dgram.createSocket('udp4');
    this.timer = null;
    this.onMessage = null;
    this.socket.on('message', (buf) => {
      try {
        this.onMessage?.(decodeMessage(buf));
      } catch {
        // Ignore packets that are not OSC.
      }
    });
    this.socket.on('error', () => {}); // a missing mixer must never crash the controller
  }

  start() {
    this.#send('/xremote');
    this.timer = setInterval(() => this.#send('/xremote'), this.keepAliveMs);
    this.timer.unref?.();
  }

  /** Applies the `changes` list returned by ZoneMixEngine.tick(). */
  apply(changes) {
    for (const change of changes) {
      if (change.type === 'bus') {
        this.#send(this.model.busFader(change.bus), [dbToLevel(change.db, FADER_STEPS)]);
      } else if (change.type === 'send') {
        this.#send(this.model.send(change.mixerChannel, change.bus), [dbToLevel(change.db, SEND_STEPS)]);
      }
    }
  }

  close() {
    clearInterval(this.timer);
    this.socket.close();
  }

  #send(address, args = []) {
    this.socket.send(encodeMessage(address, args), this.port, this.host);
  }
}
