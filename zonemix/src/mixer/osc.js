// Minimal OSC 1.0 message encoding and decoding: just what digital mixers
// use (int32, float32, string, blob; no bundles, no timetags).

const pad4 = (n) => (n + 3) & ~3;

function encodeString(s) {
  const bytes = Buffer.from(s, 'utf8');
  const out = Buffer.alloc(pad4(bytes.length + 1));
  bytes.copy(out);
  return out;
}

function encodeBlob(data) {
  const out = Buffer.alloc(4 + pad4(data.length));
  out.writeInt32BE(data.length, 0);
  Buffer.from(data).copy(out, 4);
  return out;
}

/**
 * @param {string} address e.g. "/bus/01/mix/fader"
 * @param {Array<number|string|Buffer|{type: 'i'|'f'|'s'|'b', value: any}>} args
 *   Plain numbers are sent as float32; use {type: 'i', value} for int32.
 */
export function encodeMessage(address, args = []) {
  let tags = ',';
  const parts = [];
  for (const arg of args) {
    const { type, value } = normalise(arg);
    tags += type;
    if (type === 'f' || type === 'i') {
      const b = Buffer.alloc(4);
      if (type === 'f') b.writeFloatBE(value, 0);
      else b.writeInt32BE(value, 0);
      parts.push(b);
    } else if (type === 's') {
      parts.push(encodeString(value));
    } else if (type === 'b') {
      parts.push(encodeBlob(value));
    } else {
      throw new Error(`Unsupported OSC argument type "${type}".`);
    }
  }
  return Buffer.concat([encodeString(address), encodeString(tags), ...parts]);
}

function normalise(arg) {
  if (typeof arg === 'number') return { type: 'f', value: arg };
  if (typeof arg === 'string') return { type: 's', value: arg };
  if (Buffer.isBuffer(arg)) return { type: 'b', value: arg };
  return arg;
}

function readString(buf, offset) {
  const end = buf.indexOf(0, offset);
  if (end < 0) throw new Error('OSC string is not terminated.');
  return { value: buf.toString('utf8', offset, end), next: pad4(end + 1) };
}

/** @returns {{address: string, args: Array<{type: string, value: any}>}} */
export function decodeMessage(buf) {
  const address = readString(buf, 0);
  if (!address.value.startsWith('/')) throw new Error('Not an OSC message (address must start with "/").');
  if (address.next >= buf.length) return { address: address.value, args: [] };
  const tags = readString(buf, address.next);
  if (!tags.value.startsWith(',')) throw new Error('OSC type tags must start with ",".');
  let offset = tags.next;
  const args = [];
  for (const type of tags.value.slice(1)) {
    if (type === 'f') {
      args.push({ type, value: buf.readFloatBE(offset) });
      offset += 4;
    } else if (type === 'i') {
      args.push({ type, value: buf.readInt32BE(offset) });
      offset += 4;
    } else if (type === 's') {
      const s = readString(buf, offset);
      args.push({ type, value: s.value });
      offset = s.next;
    } else if (type === 'b') {
      const size = buf.readInt32BE(offset);
      args.push({ type, value: buf.subarray(offset + 4, offset + 4 + size) });
      offset += 4 + pad4(size);
    } else {
      throw new Error(`Unsupported OSC argument type "${type}".`);
    }
  }
  return { address: address.value, args };
}
