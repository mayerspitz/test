import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import os from 'node:os';

export function ipv4Interfaces() {
  return Object.entries(os.networkInterfaces()).flatMap(([name, addrs]) =>
    (addrs ?? []).filter((a) => a.family === 'IPv4' && !a.internal).map((a) => ({ name, address: a.address, cidr: a.cidr, netmask: a.netmask })),
  );
}

// Small HTTP(S) client with a hard timeout. Self-signed certificates are accepted
// because local audio devices (e.g. WiiM/LinkPlay) use them.
export function request(url, { method = 'GET', headers = {}, body, timeout = 3000 } = {}) {
  return new Promise((resolve) => {
    const u = new URL(url);
    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.request(u, { method, headers, timeout, rejectUnauthorized: false }, (res) => {
      const chunks = [];
      let size = 0;
      res.on('data', (c) => {
        size += c.length;
        if (size < 2_000_000) chunks.push(c);
      });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
      res.on('error', () => resolve({ status: 0, body: '', error: 'response error' }));
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', (err) => resolve({ status: 0, body: '', error: err.message }));
    if (body) req.write(body);
    req.end();
  });
}

// Send lines over TCP and collect what comes back until the line goes quiet.
export function tcpExchange(host, port, lines, { timeout = 3000, idle = 600 } = {}) {
  return new Promise((resolve) => {
    let out = '';
    let idleTimer;
    const sock = net.connect({ host, port, timeout });
    const finish = (error) => {
      clearTimeout(idleTimer);
      sock.destroy();
      resolve({ ok: !error, data: out, error });
    };
    const bump = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => finish(), idle);
    };
    sock.on('connect', () => {
      for (const l of lines) sock.write(`${l}\r\n`);
      bump();
    });
    sock.on('data', (d) => {
      out += d.toString('utf8');
      bump();
    });
    sock.on('timeout', () => finish('timeout'));
    sock.on('error', (e) => finish(e.message));
  });
}

export function xmlText(xml, tag) {
  const m = new RegExp(`<(?:\\w+:)?${tag}>([\\s\\S]*?)</(?:\\w+:)?${tag}>`).exec(xml ?? '');
  return m ? decodeEntities(m[1].trim()) : null;
}

export function decodeEntities(s) {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&');
}

export function attrs(tagText) {
  const out = {};
  for (const m of tagText.matchAll(/(\w+)="([^"]*)"/g)) out[m[1]] = decodeEntities(m[2]);
  return out;
}
