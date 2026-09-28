import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import busboy from 'busboy';
import { parseFile } from 'music-metadata';
import { badRequest, notFound } from './errors.js';
import { JsonStore } from './store.js';

export const AUDIO_EXTS = new Set([
  '.mp3', '.m4a', '.m4b', '.aac', '.flac', '.ogg', '.oga', '.opus', '.wav', '.wma', '.aif', '.aiff', '.mka', '.webm', '.mp2', '.ape', '.wv',
]);
const COVER_NAMES = ['cover', 'folder', 'front', 'album', 'albumart'];
const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp'];
const UNSORTED = 'Unsorted';
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

// The library is just a folder tree: <libraryDir>/<Collection>/<any sub folders>/<file>.
// Each top-level folder is a "collection" (e.g. one per old MP3 player). Files can be
// added by uploading from the web app or by copying them into the folder and rescanning.
export class Library extends EventEmitter {
  constructor({ dir, indexFile, maxUploadBytes = 1024 * 1024 * 1024, log }) {
    super();
    this.dir = path.resolve(dir);
    this.maxUploadBytes = maxUploadBytes;
    this.log = log;
    this.index = new JsonStore(indexFile, { version: 1, tracks: {} }, { log });
    this.coverCache = new Map();
    this.scanning = null;
  }

  get tracks() {
    return this.index.data.tracks;
  }

  async init() {
    await fsp.mkdir(this.dir, { recursive: true });
    this.rescan().catch((err) => this.log.error('Library scan failed:', err));
  }

  static trackId(rel) {
    return crypto.createHash('sha1').update(rel.normalize('NFC')).digest('hex').slice(0, 16);
  }

  get(id) {
    const t = this.tracks[id];
    if (!t) throw notFound('Track');
    return t;
  }

  absPath(track) {
    return safeJoin(this.dir, track.path);
  }

  sorted() {
    return Object.values(this.tracks).sort(
      (a, b) => collator.compare(a.collection, b.collection) || collator.compare(a.path, b.path),
    );
  }

  collections() {
    const map = new Map();
    for (const t of Object.values(this.tracks)) {
      const c = map.get(t.collection) ?? { name: t.collection, tracks: 0, duration: 0, cover: null };
      c.tracks += 1;
      c.duration += t.duration ?? 0;
      if (!c.cover && (t.hasCover || t.folderArt)) c.cover = t.id;
      map.set(t.collection, c);
    }
    return [...map.values()].sort((a, b) => collator.compare(a.name, b.name));
  }

  list({ collection, q, limit = 500, offset = 0 } = {}) {
    let items = this.sorted();
    if (collection) items = items.filter((t) => t.collection === collection);
    if (q) {
      const terms = fold(q).split(/\s+/).filter(Boolean);
      items = items.filter((t) => {
        const hay = fold([t.title, t.artist, t.album, t.path].filter(Boolean).join(' '));
        return terms.every((term) => hay.includes(term));
      });
    }
    return { total: items.length, items: items.slice(offset, offset + limit) };
  }

  tracksOfCollection(name) {
    return this.sorted().filter((t) => t.collection === name);
  }

  // Walk the folder, index new/changed files, drop missing ones.
  rescan() {
    if (this.scanning) return this.scanning;
    this.scanning = (async () => {
      const started = Date.now();
      const files = await walk(this.dir);
      const seen = new Set();
      const todo = [];
      for (const rel of files) {
        const id = Library.trackId(rel);
        seen.add(id);
        const existing = this.tracks[id];
        let st;
        try {
          st = await fsp.stat(safeJoin(this.dir, rel));
        } catch {
          continue;
        }
        if (!existing || existing.size !== st.size || existing.mtimeMs !== st.mtimeMs) todo.push({ rel, st });
      }
      let removed = 0;
      for (const id of Object.keys(this.tracks)) {
        if (!seen.has(id)) {
          delete this.tracks[id];
          removed += 1;
        }
      }
      await mapLimit(todo, 4, ({ rel, st }) => this.#indexFile(rel, st));
      this.index.save();
      this.coverCache.clear();
      const result = { total: Object.keys(this.tracks).length, indexed: todo.length, removed, ms: Date.now() - started };
      if (todo.length || removed) {
        this.log.info(`Library: ${result.total} tracks (${todo.length} indexed, ${removed} removed) in ${result.ms} ms`);
        this.emit('changed');
      }
      return result;
    })().finally(() => {
      this.scanning = null;
    });
    return this.scanning;
  }

  async #indexFile(rel, st) {
    const id = Library.trackId(rel);
    const parts = rel.split('/');
    const collection = parts.length > 1 ? parts[0] : UNSORTED;
    const base = path.basename(rel, path.extname(rel));
    let common = {};
    let format = {};
    try {
      ({ common, format } = await parseFile(safeJoin(this.dir, rel), { duration: false, skipCovers: false }));
    } catch (err) {
      this.log.warn(`Could not read tags of ${rel}: ${err.message}`);
    }
    this.tracks[id] = {
      id,
      path: rel,
      collection,
      title: clean(common.title) || base,
      artist: clean(common.artist) || clean(common.albumartist) || null,
      album: clean(common.album) || null,
      trackNo: common.track?.no ?? null,
      duration: Number.isFinite(format.duration) ? Math.round(format.duration) : null,
      hasCover: Boolean(common.picture?.length),
      folderArt: await findFolderArt(this.dir, path.posix.dirname(rel)),
      size: st.size,
      mtimeMs: st.mtimeMs,
      addedAt: this.tracks[id]?.addedAt ?? Date.now(),
    };
  }

  async cover(id) {
    const t = this.get(id);
    if (this.coverCache.has(id)) return this.coverCache.get(id);
    let result = null;
    if (t.hasCover) {
      try {
        const { common } = await parseFile(this.absPath(t), { duration: false });
        const pic = common.picture?.[0];
        if (pic) result = { data: Buffer.from(pic.data), type: pic.format || 'image/jpeg' };
      } catch { /* fall through to folder art */ }
    }
    if (!result && t.folderArt) {
      const file = safeJoin(this.dir, t.folderArt);
      result = { data: await fsp.readFile(file), type: `image/${path.extname(file).slice(1).replace('jpg', 'jpeg')}` };
    }
    if (this.coverCache.size > 200) this.coverCache.delete(this.coverCache.keys().next().value);
    this.coverCache.set(id, result);
    return result;
  }

  // Streams a multipart upload straight to disk. Relative folder paths from a
  // folder upload are kept under the chosen collection.
  handleUpload(req, collectionName) {
    const collection = cleanSegment(collectionName) || 'Uploads';
    return new Promise((resolve, reject) => {
      let bb;
      try {
        bb = busboy({ headers: req.headers, preservePath: true, limits: { fileSize: this.maxUploadBytes } });
      } catch (err) {
        reject(badRequest(`Expected a multipart upload (${err.message})`));
        return;
      }
      const saved = [];
      const skipped = [];
      const pending = [];
      bb.on('file', (_field, stream, info) => {
        const rel = cleanRelPath(info.filename);
        if (!rel || !AUDIO_EXTS.has(path.extname(rel).toLowerCase())) {
          skipped.push({ name: info.filename, reason: 'not an audio file' });
          stream.resume();
          return;
        }
        const relFull = `${collection}/${rel}`;
        const abs = safeJoin(this.dir, relFull);
        const tmp = `${abs}.uploading`;
        pending.push(
          (async () => {
            await fsp.mkdir(path.dirname(abs), { recursive: true });
            await pipeline(stream, fs.createWriteStream(tmp));
            if (stream.truncated) {
              await fsp.rm(tmp, { force: true });
              skipped.push({ name: info.filename, reason: `larger than ${Math.round(this.maxUploadBytes / 1048576)} MB` });
              return;
            }
            await fsp.rename(tmp, abs);
            saved.push(relFull);
          })().catch(async (err) => {
            skipped.push({ name: info.filename, reason: err.message });
            await fsp.rm(tmp, { force: true }).catch(() => {});
          }),
        );
      });
      bb.on('error', reject);
      bb.on('close', async () => {
        await Promise.all(pending);
        await mapLimit(saved, 4, async (rel) => this.#indexFile(rel, await fsp.stat(safeJoin(this.dir, rel))));
        this.index.save();
        if (saved.length) this.emit('changed');
        resolve({ collection, saved: saved.map((rel) => Library.trackId(rel)), skipped });
      });
      req.pipe(bb);
    });
  }

  async removeTrack(id) {
    const t = this.get(id);
    await fsp.rm(this.absPath(t), { force: true });
    delete this.tracks[id];
    this.index.save();
    this.emit('changed');
  }

  async removeCollection(name) {
    const clean = cleanSegment(name);
    if (!clean || !this.collections().some((c) => c.name === name)) throw notFound('Collection');
    if (name === UNSORTED) {
      for (const t of this.tracksOfCollection(UNSORTED)) await fsp.rm(this.absPath(t), { force: true });
    } else {
      await fsp.rm(safeJoin(this.dir, clean), { recursive: true, force: true });
    }
    for (const t of Object.values(this.tracks)) if (t.collection === name) delete this.tracks[t.id];
    this.index.save();
    this.emit('changed');
  }

  flush() {
    this.index.flush();
  }
}

// ---- helpers ---------------------------------------------------------------

export function safeJoin(root, rel) {
  const abs = path.resolve(root, rel);
  if (abs !== root && !abs.startsWith(root + path.sep)) throw badRequest('Invalid path');
  return abs;
}

export function cleanSegment(s) {
  return String(s ?? '')
    .normalize('NFC')
    .replace(/[\u0000-\u001f<>:"|?*\\/]/g, '')
    .trim()
    .replace(/^\.+/, '')
    .replace(/[. ]+$/, '')
    .slice(0, 150);
}

export function cleanRelPath(p) {
  return String(p ?? '')
    .split(/[\\/]+/)
    .map(cleanSegment)
    .filter((seg) => seg && seg !== '.' && seg !== '..')
    .join('/');
}

async function walk(root) {
  const out = [];
  async function visit(relDir) {
    let entries;
    try {
      entries = await fsp.readdir(path.join(root, relDir), { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name.startsWith('.')) continue; // hidden files, macOS "._" files, in-progress uploads
      const rel = relDir ? `${relDir}/${e.name}` : e.name;
      if (e.isDirectory()) await visit(rel);
      else if (e.isFile() && AUDIO_EXTS.has(path.extname(e.name).toLowerCase())) out.push(rel.normalize('NFC'));
    }
  }
  await visit('');
  return out;
}

async function findFolderArt(root, relDir) {
  let names;
  try {
    names = await fsp.readdir(path.join(root, relDir));
  } catch {
    return null;
  }
  for (const n of names) {
    const ext = path.extname(n).toLowerCase();
    if (IMAGE_EXTS.includes(ext) && COVER_NAMES.includes(path.basename(n, path.extname(n)).toLowerCase())) {
      return relDir === '.' ? n : `${relDir}/${n}`;
    }
  }
  return null;
}

async function mapLimit(items, limit, fn) {
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) await fn(items[i++]);
  });
  await Promise.all(workers);
}

function clean(s) {
  return typeof s === 'string' ? s.replace(/\u0000/g, '').trim() : '';
}

function fold(s) {
  return String(s).normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
}
