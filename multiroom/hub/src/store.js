import fs from 'node:fs';
import path from 'node:path';

// Tiny JSON persistence: load once, save debounced with an atomic rename so a
// power cut never leaves a half-written file behind.
export class JsonStore {
  constructor(file, defaults, { delayMs = 500, log } = {}) {
    this.file = file;
    this.delayMs = delayMs;
    this.log = log;
    this.timer = null;
    this.data = this.#load(defaults);
  }

  #load(defaults) {
    try {
      return { ...structuredClone(defaults), ...JSON.parse(fs.readFileSync(this.file, 'utf8')) };
    } catch (err) {
      if (err.code !== 'ENOENT') {
        const backup = `${this.file}.corrupt-${Date.now()}`;
        this.log?.warn(`Could not read ${this.file} (${err.message}); keeping a copy at ${backup}`);
        try { fs.renameSync(this.file, backup); } catch { /* ignore */ }
      }
      return structuredClone(defaults);
    }
  }

  save() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), this.delayMs);
  }

  flush() {
    clearTimeout(this.timer);
    this.timer = null;
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.data));
    fs.renameSync(tmp, this.file);
  }
}
