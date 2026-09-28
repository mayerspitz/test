#!/usr/bin/env node
// Finds whole-home audio systems on your network and reports whether each room can
// play its own music. Read-only: it never plays, pauses, groups or changes anything.
//
//   node tools/discover-audio-systems.js                 scan and print a report
//   node tools/discover-audio-systems.js --label upstairs --json > upstairs.json
//   node tools/discover-audio-systems.js --compare downstairs.json upstairs.json
//   node tools/discover-audio-systems.js --probe 192.168.1.50   also query a controller/amp by IP
//
// Works on macOS, Windows and Linux with Node.js 18+; no install step needed.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { browseMdns, browseSsdp } from './lib/discovery.js';
import { ipv4Interfaces } from './lib/net.js';
import {
  CONTROLLER_BRANDS,
  probeBluos,
  probeHeos,
  probeLinkplay,
  probeRussound,
  probeSonos,
  probeSoundTouch,
  probeYamaha,
} from './lib/probes.js';

const VERDICT = {
  independent: 'YES — rooms can play different music at the same time',
  shared: 'NO — rooms share the same audio',
  limited: 'PARTLY — see the notes',
  check: 'UNKNOWN — needs a manual check',
};

export function parseArgs(argv) {
  const o = { timeout: 4000, probe: [], json: false, label: null, compare: null, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--timeout') o.timeout = Number(argv[++i]) || 4000;
    else if (a === '--probe') o.probe.push(argv[++i]);
    else if (a === '--json') o.json = true;
    else if (a === '--label') o.label = argv[++i];
    else if (a === '--compare') o.compare = [argv[++i], argv[++i]];
    else if (a === '-h' || a === '--help') o.help = true;
  }
  return o;
}

// Merge mDNS + SSDP sightings into one entry per IP address.
export function mergeDevices(mdns, ssdp) {
  const map = new Map();
  const get = (ip) => {
    if (!map.has(ip)) map.set(ip, { ip, names: new Set(), kinds: new Set(), models: new Set(), manufacturer: null, castGroup: false });
    return map.get(ip);
  };
  for (const s of mdns) {
    if (!s.ip) continue;
    const d = get(s.ip);
    d.kinds.add(s.kind);
    const name = s.txt.fn || s.txt.name || s.name.replace(/^[0-9A-F]{12}@/i, '');
    if (name) d.names.add(name);
    const model = s.txt.md || s.txt.model || s.txt.am || null;
    if (model) d.models.add(model);
    if (s.txt.md === 'Google Cast Group') d.castGroup = true;
  }
  for (const s of ssdp) {
    const d = get(s.ip);
    if (s.friendlyName) d.names.add(s.friendlyName);
    if (s.modelName) d.models.add(s.modelNumber && !s.modelName.includes(s.modelNumber) ? `${s.modelName} ${s.modelNumber}` : s.modelName);
    d.manufacturer ??= s.manufacturer;
    d.server ??= s.server;
  }
  return [...map.values()];
}

const has = (d, re) => [...d.kinds].some((k) => re.test(k)) || re.test(d.manufacturer ?? '') || [...d.models].some((m) => re.test(m));
const label = (d) => `${[...d.names][0] ?? d.ip}${d.models.size ? ` (${[...d.models][0]})` : ''} — ${d.ip}`;

export async function analyze({ mdns, ssdp, probeIps = [], probes = defaultProbes }) {
  const devices = mergeDevices(mdns, ssdp);
  const systems = [];
  const firstOk = async (list, fn) => {
    let last = null;
    for (const d of list.slice(0, 3)) {
      last = await fn(d.ip);
      if (last.ok) return { ...last, via: d.ip };
    }
    return last;
  };

  const sonos = devices.filter((d) => has(d, /sonos/i));
  if (sonos.length) {
    const p = await firstOk(sonos, probes.sonos);
    const details = [];
    if (p?.ok) {
      details.push(`Rooms (${p.rooms.length}): ${p.rooms.join(', ')}`);
      const grouped = p.groups.filter((g) => g.rooms.length > 1);
      for (const g of grouped) details.push(`Grouped right now (same audio): ${g.rooms.join(' + ')}`);
      if (!grouped.length) details.push('No rooms are grouped right now.');
    } else if (p) details.push(p.error);
    details.push('A room served by one Sonos Amp/Port/Connect always plays as ONE room — several ceiling speakers wired to the same amp cannot differ.');
    systems.push({ id: 'sonos', title: 'Sonos', verdict: 'independent', devices: sonos.map(label), details, probe: p });
  }

  const heos = devices.filter((d) => has(d, /heos|denon|marantz/i));
  if (heos.length) {
    const p = await firstOk(heos, probes.heos);
    const players = p?.ok ? p.players : [];
    const avrs = players.filter((pl) => /avr|avc|sr\d|nr\d|cinema|receiver/i.test(`${pl.model} ${pl.name}`));
    const details = players.map((pl) => `Player: ${pl.name} (${pl.model})${pl.network ? ` · ${pl.network}` : ''}`);
    for (const g of p?.groups ?? []) details.push(`Grouped right now (same audio): ${g.players.join(' + ')}`);
    if (avrs.length) {
      details.push(`${avrs.map((a) => a.name).join(', ')}: an AV receiver is ONE HEOS player — its Zone 2 can only play the same HEOS/streaming source as the main zone. A different physical input (e.g. a separate streamer plugged into Zone 2) can differ.`);
    }
    if (p && !p.ok) details.push(`Could not query HEOS: ${p.error}`);
    systems.push({ id: 'heos', title: 'Denon / Marantz HEOS', verdict: avrs.length ? 'limited' : players.length ? 'independent' : 'check', devices: heos.map(label), details, probe: p });
  }

  const yamaha = devices.filter((d) => has(d, /yamaha/i));
  if (yamaha.length) {
    const details = [];
    let limited = false;
    const results = [];
    for (const d of yamaha) {
      const p = await probes.yamaha(d.ip);
      results.push({ ip: d.ip, ...p });
      if (!p.ok) continue;
      const zones = p.zones.map((z) => z.id);
      details.push(`${p.model ?? d.ip}: zones ${zones.join(', ')}`);
      if (zones.length > 1) {
        limited = true;
        details.push(`  Network sources (${p.networkInputs.join(', ')}) are shared by all zones of this unit: Main and ${zones.slice(1).join('/')} cannot play two different network songs at once. Separate physical inputs can.`);
      }
    }
    if (!details.length) details.push('Could not query the MusicCast API.');
    details.push('Separate MusicCast speakers/amps are independent of each other.');
    systems.push({ id: 'yamaha', title: 'Yamaha MusicCast', verdict: limited ? 'limited' : 'independent', devices: yamaha.map(label), details, probe: results });
  }

  const bluos = devices.filter((d) => has(d, /bluos|bluesound/i));
  if (bluos.length) {
    const results = await Promise.all(bluos.map((d) => probes.bluos(d.ip)));
    const details = results.filter((r) => r.ok).map((r) => `Player: ${r.name} (${r.model})${r.slaves.length ? ` — leads a group of ${r.slaves.length + 1}` : r.master ? ` — grouped under ${r.master}` : ''}`);
    systems.push({ id: 'bluos', title: 'BluOS (Bluesound / NAD)', verdict: 'independent', devices: bluos.map(label), details: [...details, 'Each BluOS player is independent; grouped players share audio.'], probe: results });
  }

  const linkplay = devices.filter((d) => has(d, /linkplay|wiim|arylic|audio pro/i));
  if (linkplay.length) {
    const results = await Promise.all(linkplay.map((d) => probes.linkplay(d.ip)));
    const details = results.filter((r) => r.ok).map((r) => `Device: ${r.name}${r.grouped ? ' (currently in a multiroom group)' : ''}`);
    details.push('Each device is independent; grouped devices share audio. Note: when a WiiM/LinkPlay device transmits to a Bluetooth speaker, its volume control changes the SPEAKER volume (AVRCP).');
    systems.push({ id: 'linkplay', title: 'WiiM / LinkPlay', verdict: 'independent', devices: linkplay.map(label), details, probe: results });
  }

  const bose = devices.filter((d) => has(d, /soundtouch|bose/i));
  if (bose.length) {
    const results = await Promise.all(bose.map((d) => probes.soundtouch(d.ip)));
    const details = results.filter((r) => r.ok).map((r) => `Speaker: ${r.name} (${r.model})${r.zoneMembers.length ? ` — zone of ${r.zoneMembers.length}` : ''}`);
    details.push('Each SoundTouch speaker is independent; a "zone" plays the same audio everywhere. Bose ended SoundTouch cloud services in May 2026 — local control still works.');
    systems.push({ id: 'soundtouch', title: 'Bose SoundTouch', verdict: 'independent', devices: bose.map(label), details, probe: results });
  }

  const cast = devices.filter((d) => has(d, /google cast/i));
  if (cast.length) {
    const groups = cast.filter((d) => d.castGroup);
    const speakers = cast.filter((d) => !d.castGroup);
    const details = [
      `${speakers.length} Cast device(s)${groups.length ? `, ${groups.length} speaker group(s): ${groups.map((g) => [...g.names][0]).join(', ')}` : ''}.`,
      'A speaker GROUP always plays the same audio. Individual devices can each play different music, but each needs its own cast session (e.g. from different phones, or by voice: "play X on Kitchen speaker").',
    ];
    systems.push({ id: 'cast', title: 'Google Cast / Nest', verdict: 'limited', devices: cast.map(label), details });
  }

  const airplay = devices.filter((d) => has(d, /airplay/i) && !has(d, /sonos|google cast/i));
  if (airplay.length) {
    systems.push({
      id: 'airplay',
      title: 'AirPlay receivers',
      verdict: 'shared',
      devices: airplay.map(label),
      details: ['From ONE iPhone, AirPlay sends the SAME audio to every speaker you select. Different songs per room needs a second source (another phone, or HomePod/Apple TV streaming on its own).'],
    });
  }

  const alexa = devices.filter((d) => has(d, /alexa/i));
  if (alexa.length) {
    systems.push({
      id: 'alexa',
      title: 'Amazon Alexa / Echo',
      verdict: 'limited',
      devices: alexa.map(label),
      details: ['Alexa multi-room groups play the same audio. Individual Echos can play different things by voice, but most music plans allow only one stream at a time per account.'],
    });
  }

  const controllers = devices.filter((d) => CONTROLLER_BRANDS.test(`${d.manufacturer ?? ''} ${[...d.names].join(' ')} ${[...d.models].join(' ')} ${d.server ?? ''}`));
  if (controllers.length) {
    systems.push({
      id: 'controller',
      title: 'Whole-home controllers / matrix amplifiers',
      verdict: 'check',
      devices: controllers.map(label),
      details: [
        'A matrix system can play at most as many different songs as it has SOURCES (streamers/inputs) connected — e.g. 6 zones with 2 sources = 2 different songs at once.',
        'If it is a Russound MCA controller, run again with --probe <its IP> to list its zones and sources.',
      ],
    });
  }

  for (const ip of probeIps) {
    const found = [];
    const [rio, h, s, y, b, l, st] = await Promise.all([
      probes.russound(ip), probes.heos(ip), probes.sonos(ip), probes.yamaha(ip), probes.bluos(ip), probes.linkplay(ip), probes.soundtouch(ip),
    ]);
    if (rio.ok) {
      found.push(`Russound ${rio.controller ?? 'controller'}: ${rio.zones.length} zones (${rio.zones.map((z) => z.name).join(', ')}), ${rio.sources.length} sources (${rio.sources.map((x) => x.name).join(', ')})`);
      found.push(`→ At most ${rio.sources.length} different songs can play at the same time across all zones.`);
    }
    if (h.ok) found.push(`HEOS answers: ${h.players.map((p) => p.name).join(', ')}`);
    if (s.ok) found.push(`Sonos answers: rooms ${s.rooms.join(', ')}`);
    if (y.ok) found.push(`Yamaha ${y.model}: zones ${y.zones.map((z) => z.id).join(', ')}`);
    if (b.ok) found.push(`BluOS player ${b.name}`);
    if (l.ok) found.push(`LinkPlay device ${l.name}`);
    if (st.ok) found.push(`Bose SoundTouch ${st.name}`);
    systems.push({
      id: `probe-${ip}`,
      title: `Direct probe of ${ip}`,
      verdict: rio.ok ? (rio.sources.length > 1 ? 'limited' : 'shared') : 'check',
      devices: [ip],
      details: found.length ? found : ['No known home-audio API answered at this address (Russound RIO, HEOS, Sonos, MusicCast, BluOS, LinkPlay, SoundTouch).'],
      probe: { russound: rio },
    });
  }

  return {
    devices: devices.map((d) => ({ ...d, names: [...d.names], kinds: [...d.kinds], models: [...d.models] })),
    systems,
    otherServiceTypes: mdns.otherServiceTypes ?? [],
  };
}

const defaultProbes = {
  sonos: probeSonos,
  heos: probeHeos,
  yamaha: probeYamaha,
  bluos: probeBluos,
  linkplay: probeLinkplay,
  soundtouch: probeSoundTouch,
  russound: probeRussound,
};

// ---- report ----------------------------------------------------------------

const tty = process.stdout.isTTY;
const c = (code, s) => (tty ? `\x1b[${code}m${s}\x1b[0m` : s);
const bold = (s) => c(1, s);
const dim = (s) => c(2, s);
const verdictColor = { independent: 32, shared: 31, limited: 33, check: 36 };

export function formatReport(result) {
  const out = [];
  const p = (s = '') => out.push(s);
  p(bold(`Home audio scan${result.label ? ` — ${result.label}` : ''}`) + dim(`  ${result.scannedAt}`));
  p(dim(`Scanned from ${result.interfaces.map((i) => `${i.address} (${i.cidr ?? i.netmask}) on ${i.name}`).join(', ') || 'no network interface'}`));
  p();
  if (!result.systems.length) {
    p(bold('No whole-home audio system answered on this network.'));
    p('Possible reasons: the system is on another subnet/VLAN (common when a second router serves upstairs),');
    p('the devices are asleep/off, the network blocks multicast (guest Wi-Fi, "client isolation"),');
    p('or it is a wired matrix amplifier controlled by keypads/RS-232 — try --probe <controller IP>.');
    p();
  }
  for (const s of result.systems) {
    p(bold(s.title));
    p(`  Different music per room?  ${c(verdictColor[s.verdict], VERDICT[s.verdict])}`);
    for (const d of s.devices.slice(0, 20)) p(dim(`  • ${d}`));
    if (s.devices.length > 20) p(dim(`  • …and ${s.devices.length - 20} more`));
    for (const line of s.details) p(`  ${line}`);
    p();
  }
  p(bold('Checking upstairs vs downstairs'));
  p('  1. Run this scan while your laptop/phone is on the DOWNSTAIRS network, with --label downstairs --json > downstairs.json');
  p('  2. Walk upstairs, join the Wi-Fi there (if it is a different network name, join that), run it again with --label upstairs.');
  p('  3. node tools/discover-audio-systems.js --compare downstairs.json upstairs.json');
  p('  Different subnets, or upstairs devices missing from the downstairs scan, mean upstairs runs on separate network');
  p('  infrastructure — the audio app usually cannot group or control across it. Full guide: docs/VERIFY_EXISTING_SYSTEM.md');
  return out.join('\n');
}

export function compareReports(a, b) {
  const out = [];
  const key = (d) => `${d.ip}|${d.names[0] ?? ''}`;
  const na = a.label ?? 'first scan';
  const nb = b.label ?? 'second scan';
  const subnet = (r) => [...new Set(r.interfaces.map((i) => i.cidr ?? `${i.address}/${i.netmask}`))];
  const [sa, sb] = [subnet(a), subnet(b)];
  out.push(bold(`Comparing "${na}" with "${nb}"`));
  out.push(`  ${na}: ${sa.join(', ')}`);
  out.push(`  ${nb}: ${sb.join(', ')}`);
  const net = (cidr) => cidr.replace(/\.\d+\/(\d+)$/, '.x/$1');
  if (sa.map(net).join() !== sb.map(net).join()) {
    out.push(c(33, '  → The two scans ran on DIFFERENT subnets: upstairs and downstairs are separate networks (e.g. a second router).'));
    out.push('    Multi-room apps normally cannot see or group devices across that boundary. Fix: set the upstairs router/extender to');
    out.push('    "access point" / "bridge" mode, or use a mesh system, so both floors share one network.');
  } else {
    out.push('  → Same subnet on both floors.');
  }
  const ka = new Map(a.devices.map((d) => [key(d), d]));
  const kb = new Map(b.devices.map((d) => [key(d), d]));
  const onlyA = [...ka.keys()].filter((k) => !kb.has(k)).map((k) => ka.get(k));
  const onlyB = [...kb.keys()].filter((k) => !ka.has(k)).map((k) => kb.get(k));
  out.push(`  Seen from both: ${[...ka.keys()].filter((k) => kb.has(k)).length} device(s)`);
  if (onlyA.length) out.push(`  Only seen from ${na}: ${onlyA.map((d) => `${d.names[0] ?? '?'} (${d.ip})`).join(', ')}`);
  if (onlyB.length) out.push(`  Only seen from ${nb}: ${onlyB.map((d) => `${d.names[0] ?? '?'} (${d.ip})`).join(', ')}`);
  const verdicts = (r) => Object.fromEntries(r.systems.map((s) => [s.title, s.verdict]));
  const [va, vb] = [verdicts(a), verdicts(b)];
  for (const title of new Set([...Object.keys(va), ...Object.keys(vb)])) {
    if (va[title] !== vb[title]) out.push(`  ${title}: ${na} → ${va[title] ?? 'not found'}, ${nb} → ${vb[title] ?? 'not found'}`);
  }
  return out.join('\n');
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    const text = fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 10).map((l) => l.replace(/^\/\/ ?/, ''));
    console.log(text.join('\n'));
    return;
  }
  if (opts.compare) {
    const [a, b] = opts.compare.map((f) => JSON.parse(fs.readFileSync(f, 'utf8')));
    console.log(compareReports(a, b));
    return;
  }
  process.stderr.write(`Scanning for home-audio systems (${Math.round(opts.timeout / 1000)} s)…\n`);
  const [mdns, ssdp] = await Promise.all([browseMdns({ timeout: opts.timeout }), browseSsdp({ timeout: opts.timeout })]);
  const result = {
    label: opts.label,
    scannedAt: new Date().toISOString(),
    interfaces: ipv4Interfaces(),
    ...(await analyze({ mdns, ssdp, probeIps: opts.probe })),
  };
  console.log(opts.json ? JSON.stringify(result, null, 2) : formatReport(result));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
