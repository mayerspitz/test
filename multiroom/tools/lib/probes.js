import { attrs, request, tcpExchange, xmlText } from './net.js';

// Each probe asks one kind of device how its rooms/zones are set up.
// They only read state — nothing is played, changed or grouped.

export async function probeSonos(ip, { port = 1400 } = {}) {
  const body =
    '<?xml version="1.0"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">' +
    '<s:Body><u:GetZoneGroupState xmlns:u="urn:schemas-upnp-org:service:ZoneGroupTopology:1"/></s:Body></s:Envelope>';
  const res = await request(`http://${ip}:${port}/ZoneGroupTopology/Control`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml; charset="utf-8"', SOAPACTION: '"urn:schemas-upnp-org:service:ZoneGroupTopology:1#GetZoneGroupState"' },
    body,
  });
  if (res.status === 403) {
    return { ok: false, error: 'Sonos refused the topology query: UPnP control is off in the Sonos app (Settings → Account → Privacy & Security → UPnP).' };
  }
  if (res.status !== 200) return { ok: false, error: res.error || `HTTP ${res.status}` };
  return { ok: true, ...parseSonosZoneGroups(xmlText(res.body, 'ZoneGroupState') ?? '') };
}

export function parseSonosZoneGroups(xml) {
  const groups = [];
  for (const g of xml.matchAll(/<ZoneGroup\b([^>]*)>([\s\S]*?)<\/ZoneGroup>/g)) {
    const members = [];
    for (const m of g[2].matchAll(/<ZoneGroupMember\b([^>]*?)\/?>/g)) {
      const a = attrs(m[1]);
      if (a.Invisible === '1') continue; // bonded subs/surrounds belong to a visible room
      members.push({ room: a.ZoneName, uuid: a.UUID, ip: /\/\/([\d.]+):/.exec(a.Location ?? '')?.[1] ?? null });
    }
    if (members.length) groups.push({ id: attrs(g[1]).ID, rooms: [...new Set(members.map((m) => m.room))], members });
  }
  return { groups, rooms: [...new Set(groups.flatMap((g) => g.rooms))] };
}

export async function probeHeos(ip, { port = 1255 } = {}) {
  const r = await tcpExchange(ip, port, ['heos://player/get_players', 'heos://group/get_groups'], { timeout: 3000, idle: 900 });
  if (!r.data) return { ok: false, error: r.error ?? 'no answer on port 1255' };
  return { ok: true, ...parseHeos(r.data) };
}

export function parseHeos(text) {
  const msgs = text.split(/\r?\n/).map((l) => {
    try {
      return JSON.parse(l);
    } catch {
      return null;
    }
  }).filter(Boolean);
  const players = msgs.find((m) => m.heos?.command === 'player/get_players')?.payload ?? [];
  const groups = msgs.find((m) => m.heos?.command === 'group/get_groups')?.payload ?? [];
  return {
    players: players.map((p) => ({ name: p.name, model: p.model, ip: p.ip ?? null, network: p.network ?? null, pid: p.pid })),
    groups: groups.map((g) => ({ name: g.name, players: (g.players ?? []).map((p) => p.name) })),
  };
}

export async function probeYamaha(ip, { port = 80 } = {}) {
  const base = `http://${ip}${port === 80 ? '' : `:${port}`}/YamahaExtendedControl/v1`;
  const [info, feat] = await Promise.all([request(`${base}/system/getDeviceInfo`), request(`${base}/system/getFeatures`)]);
  let features;
  let device = {};
  try {
    features = JSON.parse(feat.body);
    device = JSON.parse(info.body);
  } catch {
    return { ok: false, error: feat.error || `HTTP ${feat.status}` };
  }
  if (features.response_code !== 0) return { ok: false, error: `response_code ${features.response_code}` };
  return { ok: true, model: device.model_name ?? null, ...interpretYamahaFeatures(features) };
}

export function interpretYamahaFeatures(features) {
  const zones = (features.zone ?? []).map((z) => ({ id: z.id, inputs: z.input_list ?? [] }));
  const inputs = features.system?.input_list ?? [];
  // All "netusb" inputs (Server, Net Radio, Spotify, USB, Bluetooth, AirPlay, MusicCast Link…)
  // come from ONE shared network player per unit.
  const networkInputs = inputs.filter((i) => i.play_info_type === 'netusb').map((i) => i.id);
  return { zones, networkInputs };
}

export async function probeBluos(ip, { port = 11000 } = {}) {
  const r = await request(`http://${ip}:${port}/SyncStatus`);
  if (r.status !== 200) return { ok: false, error: r.error || `HTTP ${r.status}` };
  const head = /<SyncStatus\b([^>]*)>/.exec(r.body);
  const a = head ? attrs(head[1]) : {};
  const slaves = [...r.body.matchAll(/<slave\b([^>]*)\/?>/g)].map((m) => attrs(m[1]).id);
  return { ok: true, name: a.name ?? null, model: a.modelName ?? a.model ?? null, brand: a.brand ?? null, master: xmlText(r.body, 'master'), slaves };
}

export async function probeLinkplay(ip) {
  for (const url of [`https://${ip}/httpapi.asp?command=getStatusEx`, `https://${ip}:4443/httpapi.asp?command=getStatusEx`, `http://${ip}/httpapi.asp?command=getStatusEx`]) {
    const r = await request(url, { timeout: 2500 });
    if (r.status !== 200) continue;
    try {
      const j = JSON.parse(r.body);
      return { ok: true, name: j.DeviceName ?? j.ssid ?? null, project: j.project ?? null, firmware: j.firmware ?? null, grouped: j.group !== undefined && String(j.group) !== '0' };
    } catch { /* not JSON, try next */ }
  }
  return { ok: false, error: 'no LinkPlay HTTP API answer' };
}

export async function probeSoundTouch(ip, { port = 8090 } = {}) {
  const [info, zone] = await Promise.all([request(`http://${ip}:${port}/info`), request(`http://${ip}:${port}/getZone`)]);
  if (info.status !== 200) return { ok: false, error: info.error || `HTTP ${info.status}` };
  const master = /<zone\b([^>]*)>/.exec(zone.body ?? '');
  return {
    ok: true,
    name: xmlText(info.body, 'name'),
    model: xmlText(info.body, 'type'),
    zoneMaster: master ? attrs(master[1]).master ?? null : null,
    zoneMembers: [...(zone.body ?? '').matchAll(/<member\b[^>]*>([^<]*)<\/member>/g)].map((m) => m[1]),
  };
}

// Russound RIO (MCA-C3/C5/66/88/88X…): the number of SOURCES is the number of
// different songs the whole system can play at the same time.
export async function probeRussound(ip, { port = 9621 } = {}) {
  const lines = ['GET C[1].type'];
  for (let z = 1; z <= 8; z++) lines.push(`GET C[1].Z[${z}].name`, `GET C[1].Z[${z}].currentSource`);
  for (let s = 1; s <= 8; s++) lines.push(`GET S[${s}].name`, `GET S[${s}].type`);
  const r = await tcpExchange(ip, port, lines, { timeout: 3000, idle: 900 });
  if (!r.data) return { ok: false, error: r.error ?? 'no answer on port 9621' };
  return { ok: true, ...parseRussound(r.data) };
}

export function parseRussound(text) {
  const vals = {};
  for (const m of text.matchAll(/^S (\S+?)="([^"]*)"/gm)) vals[m[1]] = m[2];
  const zones = [];
  for (let z = 1; z <= 8; z++) {
    const name = vals[`C[1].Z[${z}].name`];
    if (name) zones.push({ zone: z, name, source: Number(vals[`C[1].Z[${z}].currentSource`]) || null });
  }
  const sources = [];
  for (let s = 1; s <= 8; s++) {
    const name = vals[`S[${s}].name`];
    if (name) sources.push({ source: s, name, type: vals[`S[${s}].type`] ?? null });
  }
  return { controller: vals['C[1].type'] ?? null, zones, sources };
}

// Brands of whole-home controllers/matrix amps we can recognise but not query in detail.
export const CONTROLLER_BRANDS = /control4|crestron|savant|russound|nuvo|legrand|htd|niles|sonance|speakercraft|josh\.?ai|elan|urc|rti|autonomic|triad|amx|dayton audio|monoprice|axium|origin acoustics|bose professional/i;
