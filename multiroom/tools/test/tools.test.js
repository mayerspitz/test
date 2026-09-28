import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import { test } from 'node:test';
import { analyze, compareReports, formatReport, mergeDevices } from '../discover-audio-systems.js';
import { assembleMdns, parseHeaders } from '../lib/discovery.js';
import { decode, encodeQuery, encodeResponse, TYPE } from '../lib/dns.js';
import { parseHeos, parseRussound, parseSonosZoneGroups, probeSonos, probeRussound, probeYamaha } from '../lib/probes.js';

test('DNS: query encoding and response decoding round-trip', () => {
  const q = encodeQuery(['_sonos._tcp.local']);
  assert.equal(q.readUInt16BE(4), 1);
  const pkt = encodeResponse([
    { name: '_sonos._tcp.local', type: TYPE.PTR, data: 'Kitchen._sonos._tcp.local' },
    { name: 'Kitchen._sonos._tcp.local', type: TYPE.SRV, data: { port: 1443, target: 'sonos-kitchen.local' } },
    { name: 'Kitchen._sonos._tcp.local', type: TYPE.TXT, data: { info: '/api/v1', mhhid: 'Sonos_abc', flag: true } },
    { name: 'sonos-kitchen.local', type: TYPE.A, data: '192.168.1.40' },
  ]);
  const recs = decode(pkt);
  assert.equal(recs.length, 4);
  const services = assembleMdns(recs);
  assert.equal(services.length, 1);
  assert.deepEqual(
    { name: services[0].name, ip: services[0].ip, port: services[0].port, kind: services[0].kind, flag: services[0].txt.flag },
    { name: 'Kitchen', ip: '192.168.1.40', port: 1443, kind: 'Sonos', flag: true },
  );
});

test('SSDP headers', () => {
  const h = parseHeaders('HTTP/1.1 200 OK\r\nLOCATION: http://1.2.3.4:1400/xml/device_description.xml\r\nST: upnp:rootdevice\r\n\r\n');
  assert.equal(h.location, 'http://1.2.3.4:1400/xml/device_description.xml');
});

const SONOS_STATE = `<ZoneGroupState><ZoneGroups>
<ZoneGroup Coordinator="RINCON_1" ID="RINCON_1:1"><ZoneGroupMember UUID="RINCON_1" Location="http://192.168.1.40:1400/xml/device_description.xml" ZoneName="Kitchen"/><ZoneGroupMember UUID="RINCON_2" Location="http://192.168.1.41:1400/x.xml" ZoneName="Dining Room"/></ZoneGroup>
<ZoneGroup Coordinator="RINCON_3" ID="RINCON_3:5"><ZoneGroupMember UUID="RINCON_3" Location="http://192.168.1.42:1400/x.xml" ZoneName="Upstairs Bedroom"><Satellite UUID="RINCON_9" ZoneName="Upstairs Bedroom" Invisible="1"/></ZoneGroupMember><ZoneGroupMember UUID="RINCON_4" Location="http://192.168.1.43:1400/x.xml" ZoneName="Sub" Invisible="1"/></ZoneGroup>
</ZoneGroups></ZoneGroupState>`;

test('Sonos zone groups: rooms, groups, hidden bonded players', () => {
  const r = parseSonosZoneGroups(SONOS_STATE);
  assert.deepEqual(r.rooms, ['Kitchen', 'Dining Room', 'Upstairs Bedroom']);
  assert.deepEqual(r.groups.map((g) => g.rooms), [['Kitchen', 'Dining Room'], ['Upstairs Bedroom']]);
});

test('Sonos probe over SOAP, and the UPnP-disabled case', async () => {
  let deny = false;
  const srv = http.createServer((req, res) => {
    let body = '';
    req.on('data', (d) => (body += d));
    req.on('end', () => {
      assert.match(req.headers.soapaction, /GetZoneGroupState/);
      if (deny) return res.writeHead(403).end();
      const escaped = SONOS_STATE.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      res.end(`<s:Envelope><s:Body><u:GetZoneGroupStateResponse><ZoneGroupState>${escaped}</ZoneGroupState></u:GetZoneGroupStateResponse></s:Body></s:Envelope>`);
    });
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const port = srv.address().port;
  const ok = await probeSonos('127.0.0.1', { port });
  assert.equal(ok.ok, true);
  assert.equal(ok.rooms.length, 3);
  deny = true;
  const no = await probeSonos('127.0.0.1', { port });
  assert.match(no.error, /UPnP/);
  srv.close();
});

test('Yamaha: zones and shared network inputs', async () => {
  const srv = http.createServer((req, res) => {
    if (req.url.endsWith('getDeviceInfo')) return res.end(JSON.stringify({ response_code: 0, model_name: 'RX-A4A' }));
    res.end(JSON.stringify({
      response_code: 0,
      system: { input_list: [{ id: 'hdmi1', play_info_type: 'none' }, { id: 'spotify', play_info_type: 'netusb' }, { id: 'server', play_info_type: 'netusb' }] },
      zone: [{ id: 'main', input_list: ['hdmi1', 'spotify', 'server'] }, { id: 'zone2', input_list: ['spotify', 'server'] }],
    }));
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const y = await probeYamaha('127.0.0.1', { port: srv.address().port });
  srv.close();
  assert.equal(y.model, 'RX-A4A');
  assert.deepEqual(y.zones.map((z) => z.id), ['main', 'zone2']);
  assert.deepEqual(y.networkInputs, ['spotify', 'server']);
});

test('HEOS and Russound RIO parsing (incl. a live RIO socket)', async () => {
  const heos = parseHeos('{"heos":{"command":"player/get_players","result":"success"},"payload":[{"name":"Living Room","model":"Denon AVR-X3800H","pid":1,"network":"wired"}]}\r\n{"heos":{"command":"group/get_groups"},"payload":[]}\r\n');
  assert.equal(heos.players[0].model, 'Denon AVR-X3800H');
  const text = 'S C[1].type="MCA-C5"\r\nS C[1].Z[1].name="Kitchen"\r\nS C[1].Z[1].currentSource="2"\r\nS C[1].Z[2].name="Upstairs Hall"\r\nE Zone not found\r\nS S[1].name="Tuner"\r\nS S[2].name="Streamer"\r\n';
  assert.deepEqual(parseRussound(text).sources.map((s) => s.name), ['Tuner', 'Streamer']);
  const srv = net.createServer((sock) => sock.on('data', () => sock.write(text)));
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const rio = await probeRussound('127.0.0.1', { port: srv.address().port });
  srv.close();
  assert.equal(rio.controller, 'MCA-C5');
  assert.deepEqual(rio.zones.map((z) => z.name), ['Kitchen', 'Upstairs Hall']);
});

test('analysis: verdicts per system and the upstairs comparison', async () => {
  const mdns = [
    { type: '_sonos._tcp.local', kind: 'Sonos', name: 'Kitchen', ip: '192.168.1.40', txt: {} },
    { type: '_heos-audio._tcp.local', kind: 'HEOS (Denon/Marantz)', name: 'Denon AVR', ip: '192.168.1.60', txt: {} },
    { type: '_googlecast._tcp.local', kind: 'Google Cast', name: 'x', ip: '192.168.1.70', txt: { fn: 'Kitchen display', md: 'Google Nest Hub' } },
    { type: '_googlecast._tcp.local', kind: 'Google Cast', name: 'g', ip: '192.168.1.71', txt: { fn: 'Downstairs', md: 'Google Cast Group' } },
    { type: '_raop._tcp.local', kind: 'AirPlay (audio)', name: 'AA@Bedroom', ip: '192.168.1.80', txt: { am: 'AudioAccessory5,1' } },
  ];
  const ssdp = [{ ip: '192.168.1.90', manufacturer: 'Control4', friendlyName: 'Control4 Director', modelName: 'CORE5' }];
  const probes = {
    sonos: async () => ({ ok: true, ...parseSonosZoneGroups(SONOS_STATE) }),
    heos: async () => ({ ok: true, players: [{ name: 'Living Room', model: 'Denon AVR-X3800H' }], groups: [] }),
    yamaha: async () => ({ ok: false }),
    bluos: async () => ({ ok: false }),
    linkplay: async () => ({ ok: false }),
    soundtouch: async () => ({ ok: false }),
    russound: async () => ({ ok: false }),
  };
  assert.equal(mergeDevices(mdns, ssdp).length, 6);
  const r = await analyze({ mdns, ssdp, probes });
  const v = Object.fromEntries(r.systems.map((s) => [s.id, s.verdict]));
  assert.deepEqual(v, { sonos: 'independent', heos: 'limited', cast: 'limited', airplay: 'shared', controller: 'check' });
  assert.ok(r.systems[0].details.some((d) => d.includes('Kitchen + Dining Room')));
  assert.ok(r.systems[1].details.some((d) => d.includes('Zone 2')));

  const report = formatReport({ ...r, label: 'downstairs', scannedAt: 'now', interfaces: [{ name: 'wlan0', address: '192.168.1.23', cidr: '192.168.1.23/24' }] });
  assert.match(report, /Different music per room\?/);
  const up = { ...r, label: 'upstairs', devices: r.devices.slice(0, 2), interfaces: [{ name: 'wlan0', address: '192.168.0.5', cidr: '192.168.0.5/24' }] };
  const down = { ...r, label: 'downstairs', interfaces: [{ name: 'wlan0', address: '192.168.1.23', cidr: '192.168.1.23/24' }] };
  const cmp = compareReports(down, up);
  assert.match(cmp, /DIFFERENT subnets/);
  assert.match(cmp, /Only seen from downstairs/);
});
