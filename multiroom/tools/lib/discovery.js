import dgram from 'node:dgram';
import { decode, encodeQuery, TYPE } from './dns.js';
import { ipv4Interfaces, request, xmlText } from './net.js';

// mDNS service types that matter for whole-home audio.
export const SERVICES = {
  '_sonos._tcp.local': 'Sonos',
  '_heos-audio._tcp.local': 'HEOS (Denon/Marantz)',
  '_musc._tcp.local': 'BluOS (Bluesound/NAD)',
  '_linkplay._tcp.local': 'LinkPlay (WiiM/Arylic/Audio Pro…)',
  '_googlecast._tcp.local': 'Google Cast',
  '_airplay._tcp.local': 'AirPlay',
  '_raop._tcp.local': 'AirPlay (audio)',
  '_spotify-connect._tcp.local': 'Spotify Connect',
  '_soundtouch._tcp.local': 'Bose SoundTouch',
  '_amzn-wplay._tcp.local': 'Amazon Alexa',
  '_snapcast._tcp.local': 'Snapcast',
  '_multiroom._tcp.local': 'Multiroom',
};

const MDNS_ADDR = '224.0.0.251';
const MDNS_PORT = 5353;

// Browse mDNS on every IPv4 interface. Queries are sent from an ephemeral port,
// so responders answer by unicast (RFC 6762 §6.7); we also listen on 5353 when possible.
export async function browseMdns({ timeout = 3500 } = {}) {
  const records = [];
  const sockets = [];
  const onMessage = (msg, rinfo) => {
    try {
      for (const r of decode(msg)) records.push({ ...r, from: rinfo.address });
    } catch { /* ignore malformed packets */ }
  };
  const types = [...Object.keys(SERVICES), '_services._dns-sd._udp.local'];
  const ifaces = ipv4Interfaces();

  try {
    const listener = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    listener.on('error', () => {});
    listener.on('message', onMessage);
    await new Promise((resolve, reject) => {
      listener.once('error', reject);
      listener.bind(MDNS_PORT, () => resolve());
    });
    for (const i of ifaces) {
      try {
        listener.addMembership(MDNS_ADDR, i.address);
      } catch { /* already joined or not permitted */ }
    }
    sockets.push(listener);
  } catch { /* port 5353 busy: unicast answers still arrive on the query sockets */ }

  for (const i of ifaces) {
    const s = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    s.on('error', () => {});
    s.on('message', onMessage);
    await new Promise((resolve) => s.bind(0, i.address, resolve));
    try {
      s.setMulticastInterface(i.address);
    } catch { /* ignore */ }
    sockets.push(s);
  }
  const querySockets = sockets.filter((s) => s.address().port !== MDNS_PORT);
  const send = (names, type) => {
    const pkt = encodeQuery(names, { type });
    for (const s of querySockets) s.send(pkt, MDNS_PORT, MDNS_ADDR, () => {});
  };

  send(types, TYPE.PTR);
  await sleep(timeout * 0.35);
  send(types, TYPE.PTR);
  await sleep(timeout * 0.3);
  // Ask again for details the first answers didn't include.
  const partial = assembleMdns(records);
  const missingSrv = partial.filter((s) => !s.port).map((s) => s.instance);
  const missingIp = partial.filter((s) => s.host && !s.ip).map((s) => s.host);
  if (missingSrv.length) send(missingSrv.slice(0, 30), TYPE.SRV);
  if (missingSrv.length) send(missingSrv.slice(0, 30), TYPE.TXT);
  if (missingIp.length) send([...new Set(missingIp)].slice(0, 30), TYPE.A);
  await sleep(timeout * 0.35);
  for (const s of sockets) s.close();
  return assembleMdns(records);
}

// Turn loose DNS records into service instances: { type, instance, name, host, port, ip, txt }.
export function assembleMdns(records) {
  const byName = (type, name) => records.filter((r) => r.type === type && r.name.toLowerCase() === name.toLowerCase());
  const out = [];
  const seen = new Set();
  for (const ptr of records.filter((r) => r.type === TYPE.PTR && SERVICES[r.name.toLowerCase()])) {
    const instance = ptr.data;
    const key = `${ptr.name}|${instance}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const srv = byName(TYPE.SRV, instance)[0]?.data;
    const txt = Object.assign({}, ...byName(TYPE.TXT, instance).map((r) => r.data));
    const host = srv?.target ?? null;
    const ip = (host && byName(TYPE.A, host)[0]?.data) || ptr.from || null;
    out.push({
      type: ptr.name.toLowerCase(),
      kind: SERVICES[ptr.name.toLowerCase()],
      instance,
      name: instance.slice(0, instance.length - ptr.name.length - 1).replace(/\\032/g, ' '),
      host,
      port: srv?.port ?? null,
      ip,
      txt,
    });
  }
  const otherTypes = [...new Set(records.filter((r) => r.type === TYPE.PTR && r.name === '_services._dns-sd._udp.local').map((r) => r.data))];
  out.otherServiceTypes = otherTypes;
  return out;
}

// UPnP/SSDP discovery; returns one entry per device description (LOCATION).
export async function browseSsdp({ timeout = 3500 } = {}) {
  const found = new Map();
  const sockets = [];
  const msg = Buffer.from('M-SEARCH * HTTP/1.1\r\nHOST: 239.255.255.250:1900\r\nMAN: "ssdp:discover"\r\nMX: 2\r\nST: ssdp:all\r\n\r\n');
  for (const i of ipv4Interfaces()) {
    const s = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    s.on('error', () => {});
    s.on('message', (buf, rinfo) => {
      const headers = parseHeaders(buf.toString('utf8'));
      if (!headers.location) return;
      const prev = found.get(headers.location) ?? { location: headers.location, ip: rinfo.address, server: headers.server, st: new Set() };
      if (headers.st) prev.st.add(headers.st);
      found.set(headers.location, prev);
    });
    await new Promise((resolve) => s.bind(0, i.address, resolve));
    try {
      s.setMulticastInterface(i.address);
    } catch { /* ignore */ }
    sockets.push(s);
  }
  for (let k = 0; k < 2; k++) {
    for (const s of sockets) s.send(msg, 1900, '239.255.255.250', () => {});
    await sleep(timeout / 3);
  }
  await sleep(timeout / 3);
  for (const s of sockets) s.close();

  const devices = [];
  await Promise.all([...found.values()].map(async (d) => {
    const res = await request(d.location, { timeout: 2500 });
    devices.push({
      ip: d.ip,
      location: d.location,
      server: d.server ?? null,
      st: [...d.st],
      friendlyName: xmlText(res.body, 'friendlyName'),
      manufacturer: xmlText(res.body, 'manufacturer'),
      modelName: xmlText(res.body, 'modelName'),
      modelNumber: xmlText(res.body, 'modelNumber'),
      deviceType: xmlText(res.body, 'deviceType'),
    });
  }));
  return devices;
}

export function parseHeaders(text) {
  const out = {};
  for (const line of text.split(/\r?\n/).slice(1)) {
    const i = line.indexOf(':');
    if (i > 0) out[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim();
  }
  return out;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
