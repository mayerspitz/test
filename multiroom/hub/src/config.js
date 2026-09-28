import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const HUB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Settings come from (highest priority first): explicit overrides, environment
// variables, a JSON config file (MULTIROOM_CONFIG), then defaults.
export function loadConfig(overrides = {}) {
  const env = process.env;
  const cfgPath = overrides.configFile ?? env.MULTIROOM_CONFIG;
  const file = cfgPath && fs.existsSync(cfgPath) ? JSON.parse(fs.readFileSync(cfgPath, 'utf8')) : {};

  const pick = (key, envKey, fallback) => {
    if (overrides[key] !== undefined) return overrides[key];
    if (env[envKey] !== undefined && env[envKey] !== '') return env[envKey];
    if (file[key] !== undefined) return file[key];
    return fallback;
  };

  const dataDir = path.resolve(pick('dataDir', 'MULTIROOM_DATA_DIR', path.join(HUB_ROOT, 'data')));
  return {
    port: Number(pick('port', 'PORT', 8080)),
    host: pick('host', 'HOST', '0.0.0.0'),
    dataDir,
    libraryDir: path.resolve(pick('libraryDir', 'MULTIROOM_LIBRARY_DIR', path.join(dataDir, 'library'))),
    // Shared secret for the web app, the API and the bridges. Empty = no auth (trusted LAN only).
    token: String(pick('token', 'MULTIROOM_TOKEN', '')),
    ytdlpPath: pick('ytdlpPath', 'YTDLP_PATH', 'yt-dlp'),
    ytdlpArgs: toArgList(pick('ytdlpArgs', 'YTDLP_ARGS', [])),
    maxUploadMb: Number(pick('maxUploadMb', 'MULTIROOM_MAX_UPLOAD_MB', 1024)),
    quiet: Boolean(pick('quiet', 'MULTIROOM_QUIET', false)),
    demo: Boolean(overrides.demo),
  };
}

function toArgList(value) {
  if (Array.isArray(value)) return value.map(String);
  return String(value).split(/\s+/).filter(Boolean);
}
