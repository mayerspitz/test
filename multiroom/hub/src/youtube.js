import { execFile } from 'node:child_process';
import { once } from 'node:events';
import { badRequest, HttpError } from './errors.js';

const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const YT_HOST_RE = /^(?:[a-z0-9-]+\.)*(?:youtube\.com|youtu\.be|youtube-nocookie\.com)$/i;
// YouTube serves big files more reliably in ranged chunks (yt-dlp does the same).
const CHUNK_BYTES = 10 * 1024 * 1024;

// YouTube / YouTube Music support through yt-dlp, which runs on the hub only.
// Bridges never talk to YouTube: they stream /media/youtube/<id> from the hub,
// which resolves the audio URL and proxies it with seeking (HTTP Range) support.
export class YouTube {
  constructor({ bin = 'yt-dlp', extraArgs = [], log, timeoutMs = 60_000, chunkBytes = CHUNK_BYTES }) {
    this.bin = bin;
    this.chunkBytes = chunkBytes;
    this.extraArgs = extraArgs;
    this.log = log;
    this.timeoutMs = timeoutMs;
    this.streams = new Map(); // videoId -> { url, headers, expiresAt, size, type }
    this.version = undefined;
  }

  run(args) {
    return new Promise((resolve, reject) => {
      execFile(
        this.bin,
        ['--no-warnings', '--no-progress', ...this.extraArgs, ...args],
        { timeout: this.timeoutMs, maxBuffer: 64 * 1024 * 1024 },
        (err, stdout, stderr) => {
          if (err) {
            const msg = (stderr || err.message).trim().split('\n').filter(Boolean).pop() || 'yt-dlp failed';
            reject(new HttpError(err.code === 'ENOENT' ? 503 : 502, err.code === 'ENOENT' ? 'yt-dlp is not installed on the hub' : msg));
          } else {
            resolve(stdout);
          }
        },
      );
    });
  }

  async status() {
    if (this.version === undefined) {
      try {
        this.version = (await this.run(['--version'])).trim();
      } catch {
        this.version = null;
      }
    }
    return { available: Boolean(this.version), version: this.version };
  }

  async search(query, limit = 20) {
    const q = String(query ?? '').trim();
    if (!q) throw badRequest('Search text is empty');
    const n = Math.min(Math.max(Number(limit) || 20, 1), 50);
    let entries = [];
    try {
      // YouTube Music "Songs" results: proper tracks with artist + album art.
      const url = `https://music.youtube.com/search?q=${encodeURIComponent(q)}#songs`;
      entries = JSON.parse(await this.run(['--flat-playlist', '-J', '--playlist-end', String(n), '--', url])).entries ?? [];
    } catch (err) {
      if (err.status === 503) throw err;
      this.log.warn(`YouTube Music search failed (${err.message}); falling back to YouTube search`);
    }
    if (!entries.length) {
      entries = JSON.parse(await this.run(['--flat-playlist', '-J', '--', `ytsearch${n}:${q}`])).entries ?? [];
    }
    return entries.filter((e) => VIDEO_ID_RE.test(e.id ?? '')).map(toItem);
  }

  // A link (video, YouTube Music song, playlist or album) or a bare video id -> playable items.
  async resolve(input) {
    const url = normalizeInput(input);
    const info = JSON.parse(await this.run(['--flat-playlist', '-J', '--', url]));
    if (info._type === 'playlist') {
      return { title: info.title ?? 'Playlist', items: (info.entries ?? []).filter((e) => VIDEO_ID_RE.test(e.id ?? '')).map(toItem) };
    }
    return { title: info.title, items: [toItem(info)] };
  }

  async streamInfo(videoId, { fresh = false } = {}) {
    if (!VIDEO_ID_RE.test(videoId)) throw badRequest('Invalid video id');
    const cached = this.streams.get(videoId);
    if (!fresh && cached && cached.expiresAt > Date.now() + 60_000) return cached;
    const info = JSON.parse(
      await this.run(['-J', '--no-playlist', '-f', 'bestaudio/best', '--', `https://www.youtube.com/watch?v=${videoId}`]),
    );
    const fmt = info.requested_downloads?.[0] ?? info.requested_formats?.[0] ?? info;
    const url = fmt.url ?? info.url;
    if (!url) throw new HttpError(502, 'yt-dlp returned no audio URL');
    const expire = Number(new URL(url).searchParams.get('expire'));
    const entry = {
      url,
      headers: fmt.http_headers ?? info.http_headers ?? {},
      size: fmt.filesize ?? info.filesize ?? null,
      type: mimeFor(fmt.ext ?? info.ext),
      expiresAt: Number.isFinite(expire) && expire > 0 ? expire * 1000 : Date.now() + 3 * 3600_000,
    };
    if (this.streams.size > 500) this.streams.delete(this.streams.keys().next().value);
    this.streams.set(videoId, entry);
    return entry;
  }

  // Streams the audio of a video to `res`, honouring the client's Range header.
  async proxy(req, res, videoId) {
    const ac = new AbortController();
    res.on('close', () => ac.abort());
    for (let attempt = 0; attempt < 2; attempt++) {
      const info = await this.streamInfo(videoId, { fresh: attempt > 0 });
      const range = parseRange(req.headers.range);
      const first = await this.#fetchRange(info, range.start, Math.min(range.end ?? Infinity, range.start + this.chunkBytes - 1), ac.signal);
      if ((first.status === 403 || first.status === 410) && attempt === 0) {
        await first.body?.cancel();
        continue; // URL expired or rejected: resolve again once
      }
      if (first.status === 416) {
        res.status(416).end();
        return;
      }
      if (!first.ok) {
        await first.body?.cancel();
        throw new HttpError(502, `YouTube answered ${first.status}`);
      }
      const total = totalFromContentRange(first.headers.get('content-range')) ?? info.size;
      const end = Math.min(range.end ?? Infinity, total ? total - 1 : Infinity);
      res.status(req.headers.range ? 206 : 200);
      res.setHeader('Content-Type', first.headers.get('content-type') || info.type);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'no-store');
      if (Number.isFinite(end)) {
        res.setHeader('Content-Length', String(end - range.start + 1));
        if (req.headers.range) res.setHeader('Content-Range', `bytes ${range.start}-${end}/${total ?? '*'}`);
      }
      let pos = range.start + (await pipeBody(first, res));
      while (Number.isFinite(end) && pos <= end && !ac.signal.aborted) {
        const next = await this.#fetchRange(info, pos, Math.min(pos + this.chunkBytes - 1, end), ac.signal);
        if (!next.ok) {
          await next.body?.cancel();
          break;
        }
        const n = await pipeBody(next, res);
        if (!n) break;
        pos += n;
      }
      res.end();
      return;
    }
  }

  #fetchRange(info, start, end, signal) {
    return fetch(info.url, { headers: { ...info.headers, Range: `bytes=${start}-${end}` }, signal });
  }
}

async function pipeBody(response, res) {
  let n = 0;
  if (!response.body) return 0;
  for await (const chunk of response.body) {
    n += chunk.length;
    if (!res.write(chunk)) await once(res, 'drain');
  }
  return n;
}

function parseRange(header) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(String(header ?? '').trim());
  if (!m || (m[1] === '' && m[2] === '')) return { start: 0, end: null };
  if (m[1] === '') return { start: 0, end: null }; // suffix ranges are not used by players; serve all
  return { start: Number(m[1]), end: m[2] === '' ? null : Number(m[2]) };
}

function totalFromContentRange(v) {
  const m = /\/(\d+)$/.exec(v ?? '');
  return m ? Number(m[1]) : null;
}

function normalizeInput(input) {
  const s = String(input ?? '').trim();
  if (VIDEO_ID_RE.test(s)) return `https://www.youtube.com/watch?v=${s}`;
  let u;
  try {
    u = new URL(s);
  } catch {
    throw badRequest('Paste a YouTube / YouTube Music link');
  }
  if (!/^https?:$/.test(u.protocol) || !YT_HOST_RE.test(u.hostname)) throw badRequest('Only YouTube / YouTube Music links are supported');
  return u.toString();
}

export function isYouTubeLink(s) {
  try {
    const u = new URL(String(s).trim());
    return YT_HOST_RE.test(u.hostname);
  } catch {
    return false;
  }
}

function toItem(e) {
  const artist = Array.isArray(e.artists) && e.artists.length ? e.artists.join(', ') : e.artist || e.channel || e.uploader || null;
  const thumbs = Array.isArray(e.thumbnails) ? e.thumbnails.filter((t) => t.url) : [];
  return {
    kind: 'youtube',
    id: e.id,
    title: e.track || e.title || e.id,
    artist: artist?.replace(/ - Topic$/, '') ?? null,
    album: e.album ?? null,
    duration: Number.isFinite(e.duration) ? Math.round(e.duration) : null,
    artwork: thumbs.length ? thumbs[thumbs.length - 1].url : `https://i.ytimg.com/vi/${e.id}/hqdefault.jpg`,
  };
}

function mimeFor(ext) {
  return { m4a: 'audio/mp4', mp4: 'audio/mp4', webm: 'audio/webm', opus: 'audio/ogg', mp3: 'audio/mpeg' }[ext] ?? 'application/octet-stream';
}
