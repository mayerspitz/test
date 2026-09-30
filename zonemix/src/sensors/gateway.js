import dgram from 'node:dgram';
import { dbToPower, powerToDb, isNum } from '../engine/units.js';

// Sensor nodes broadcast one small JSON datagram every 100–250 ms:
//   {"v":1,"id":"s-bar","seq":812,"up":203114,"laeq":71.4,"lceq":78.0,"lzpeak":96.2}
// laeq/lceq: A/C-weighted level over the interval since the last packet,
// dB SPL; lzpeak: unweighted peak; up: ms since the node booted.

export const SENSOR_PORT = 7700;
const MAX_PACKET_BYTES = 2048;

/** @returns {{ok: true, reading: object} | {ok: false, reason: string}} */
export function parseSensorPacket(buf) {
  if (buf.length > MAX_PACKET_BYTES) return { ok: false, reason: 'packet too large' };
  let msg;
  try {
    msg = JSON.parse(buf.toString('utf8'));
  } catch {
    return { ok: false, reason: 'not JSON' };
  }
  if (msg?.v !== 1) return { ok: false, reason: `unsupported protocol version ${msg?.v}` };
  if (typeof msg.id !== 'string' || !/^[\w.-]{1,40}$/.test(msg.id)) return { ok: false, reason: 'bad sensor id' };
  if (!Number.isInteger(msg.seq) || msg.seq < 0) return { ok: false, reason: 'bad sequence number' };
  if (!isNum(msg.laeq) || msg.laeq < 0 || msg.laeq > 150) return { ok: false, reason: 'laeq missing or out of range' };
  return {
    ok: true,
    reading: {
      id: msg.id,
      seq: msg.seq,
      upMs: isNum(msg.up) ? msg.up : null,
      laeq: msg.laeq,
      lceq: isNum(msg.lceq) ? msg.lceq : null,
      lzpeak: isNum(msg.lzpeak) ? msg.lzpeak : null,
    },
  };
}

/**
 * Collects sensor packets. take() returns, per sensor, the energy average of
 * the readings that arrived since the previous take(); a sensor with nothing
 * new is left out, which is how the engine notices it has gone quiet.
 */
export class SensorGateway {
  constructor({ port = SENSOR_PORT, socket } = {}) {
    this.port = port;
    this.socket = socket ?? dgram.createSocket({ type: 'udp4', reuseAddr: true });
    this.pending = new Map(); // id → {power, count}
    this.sensors = new Map(); // id → {seq, upMs, lastSeen, received, lost, rejected}
    this.rejected = 0;
    this.socket.on('message', (buf, rinfo) => this.receive(buf, rinfo));
    this.socket.on('error', () => {});
  }

  start() {
    return new Promise((resolve) => this.socket.bind(this.port, () => resolve(this.socket.address().port)));
  }

  receive(buf, rinfo = {}, now = Date.now()) {
    const parsed = parseSensorPacket(buf);
    if (!parsed.ok) {
      this.rejected += 1;
      return;
    }
    const r = parsed.reading;
    const known = this.sensors.get(r.id);
    const rebooted = known && r.upMs !== null && known.upMs !== null && r.upMs < known.upMs;
    if (known && !rebooted && r.seq <= known.seq) return; // late or duplicate
    const info = known ?? { received: 0, lost: 0 };
    if (known && !rebooted) info.lost += r.seq - known.seq - 1;
    Object.assign(info, { seq: r.seq, upMs: r.upMs, lastSeen: now, address: rinfo.address, received: info.received + 1 });
    this.sensors.set(r.id, info);
    const p = this.pending.get(r.id) ?? { power: 0, count: 0 };
    p.power += dbToPower(r.laeq);
    p.count += 1;
    this.pending.set(r.id, p);
  }

  take() {
    const out = {};
    for (const [id, p] of this.pending) out[id] = powerToDb(p.power / p.count);
    this.pending.clear();
    return out;
  }

  stats() {
    return Object.fromEntries(this.sensors);
  }

  close() {
    this.socket.close();
  }
}
