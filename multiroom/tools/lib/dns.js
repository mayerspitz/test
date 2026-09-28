// Minimal DNS message encoder/decoder — just enough for mDNS service discovery
// (PTR, SRV, TXT, A, AAAA). No dependencies so the scanner runs with plain `node`.

export const TYPE = { A: 1, PTR: 12, TXT: 16, AAAA: 28, SRV: 33, ANY: 255 };

export function encodeQuery(names, { type = TYPE.PTR, unicastResponse = true, id = 0 } = {}) {
  const parts = [];
  const header = Buffer.alloc(12);
  header.writeUInt16BE(id, 0);
  header.writeUInt16BE(0, 2); // standard query
  header.writeUInt16BE(names.length, 4);
  parts.push(header);
  for (const name of names) {
    parts.push(encodeName(name));
    const q = Buffer.alloc(4);
    q.writeUInt16BE(type, 0);
    q.writeUInt16BE(unicastResponse ? 0x8001 : 0x0001, 2); // QU bit + class IN
    parts.push(q);
  }
  return Buffer.concat(parts);
}

export function encodeName(name) {
  const labels = name.replace(/\.$/, '').split('.');
  const bufs = labels.map((l) => {
    const b = Buffer.from(l, 'utf8');
    return Buffer.concat([Buffer.from([b.length]), b]);
  });
  return Buffer.concat([...bufs, Buffer.from([0])]);
}

function readName(buf, offset, depth = 0) {
  const labels = [];
  let pos = offset;
  let jumped = false;
  let end = offset;
  while (pos < buf.length) {
    const len = buf[pos];
    if (len === 0) {
      pos += 1;
      break;
    }
    if ((len & 0xc0) === 0xc0) {
      if (depth > 10 || pos + 1 >= buf.length) throw new Error('bad name pointer');
      const ptr = ((len & 0x3f) << 8) | buf[pos + 1];
      if (!jumped) end = pos + 2;
      const { name } = readName(buf, ptr, depth + 1);
      if (name) labels.push(name);
      jumped = true;
      pos += 2;
      break;
    }
    labels.push(buf.toString('utf8', pos + 1, pos + 1 + len));
    pos += 1 + len;
  }
  return { name: labels.join('.'), next: jumped ? end : pos };
}

export function decode(buf) {
  const qd = buf.readUInt16BE(4);
  const counts = [buf.readUInt16BE(6), buf.readUInt16BE(8), buf.readUInt16BE(10)];
  let pos = 12;
  for (let i = 0; i < qd; i++) pos = readName(buf, pos).next + 4;
  const records = [];
  const total = counts[0] + counts[1] + counts[2];
  for (let i = 0; i < total && pos < buf.length; i++) {
    const { name, next } = readName(buf, pos);
    pos = next;
    const type = buf.readUInt16BE(pos);
    const ttl = buf.readUInt32BE(pos + 4);
    const rdlen = buf.readUInt16BE(pos + 8);
    const rdStart = pos + 10;
    const rd = buf.subarray(rdStart, rdStart + rdlen);
    const rec = { name, type, ttl };
    if (type === TYPE.PTR) rec.data = readName(buf, rdStart).name;
    else if (type === TYPE.A) rec.data = [...rd].join('.');
    else if (type === TYPE.AAAA) rec.data = rd.toString('hex').match(/.{4}/g).join(':');
    else if (type === TYPE.SRV) rec.data = { priority: rd.readUInt16BE(0), weight: rd.readUInt16BE(2), port: rd.readUInt16BE(4), target: readName(buf, rdStart + 6).name };
    else if (type === TYPE.TXT) rec.data = decodeTxt(rd);
    records.push(rec);
    pos = rdStart + rdlen;
  }
  return records;
}

function decodeTxt(rd) {
  const out = {};
  let p = 0;
  while (p < rd.length) {
    const len = rd[p];
    const s = rd.toString('utf8', p + 1, p + 1 + len);
    p += 1 + len;
    if (!s) continue;
    const eq = s.indexOf('=');
    if (eq < 0) out[s] = true;
    else out[s.slice(0, eq)] = s.slice(eq + 1);
  }
  return out;
}

// Build an answer packet (used by tests to simulate devices).
export function encodeResponse(records) {
  const header = Buffer.alloc(12);
  header.writeUInt16BE(0x8400, 2);
  header.writeUInt16BE(records.length, 6);
  const parts = [header];
  for (const r of records) {
    let rd;
    if (r.type === TYPE.PTR) rd = encodeName(r.data);
    else if (r.type === TYPE.A) rd = Buffer.from(r.data.split('.').map(Number));
    else if (r.type === TYPE.SRV) {
      const h = Buffer.alloc(6);
      h.writeUInt16BE(r.data.priority ?? 0, 0);
      h.writeUInt16BE(r.data.weight ?? 0, 2);
      h.writeUInt16BE(r.data.port, 4);
      rd = Buffer.concat([h, encodeName(r.data.target)]);
    } else if (r.type === TYPE.TXT) {
      rd = Buffer.concat(Object.entries(r.data).map(([k, v]) => {
        const b = Buffer.from(v === true ? k : `${k}=${v}`);
        return Buffer.concat([Buffer.from([b.length]), b]);
      }));
    }
    const meta = Buffer.alloc(10);
    meta.writeUInt16BE(r.type, 0);
    meta.writeUInt16BE(1, 2);
    meta.writeUInt32BE(r.ttl ?? 120, 4);
    meta.writeUInt16BE(rd.length, 8);
    parts.push(encodeName(r.name), meta, rd);
  }
  return Buffer.concat(parts);
}
