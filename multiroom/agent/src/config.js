import fs from 'node:fs';

// Config comes from a JSON file (--config path or MULTIROOM_AGENT_CONFIG) and
// can be overridden with environment variables — handy for quick tests.
export function loadAgentConfig(argv = process.argv.slice(2), env = process.env) {
  const i = argv.indexOf('--config');
  const file = i >= 0 ? argv[i + 1] : env.MULTIROOM_AGENT_CONFIG;
  const cfg = file ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};

  cfg.hub = env.MULTIROOM_HUB || cfg.hub || 'http://localhost:8080';
  cfg.token = env.MULTIROOM_TOKEN ?? cfg.token ?? '';
  cfg.zone = { ...cfg.zone };
  cfg.zone.id = (env.ZONE_ID || cfg.zone.id || '').toLowerCase();
  cfg.zone.name = env.ZONE_NAME || cfg.zone.name || cfg.zone.id;
  cfg.player = { type: 'mpv', mpvPath: 'mpv', audioDevice: 'auto', extraArgs: [], ...cfg.player };
  if (env.PLAYER) cfg.player.type = env.PLAYER;
  if (env.MPV_EXTRA_ARGS) cfg.player.extraArgs = env.MPV_EXTRA_ARGS.split(/\s+/).filter(Boolean);
  if (env.BT_SPEAKER) cfg.bluetooth = { ...cfg.bluetooth, speaker: env.BT_SPEAKER };
  if (env.BT_ADAPTER) cfg.bluetooth = { ...cfg.bluetooth, adapter: env.BT_ADAPTER };
  if (cfg.bluetooth && !cfg.bluetooth.speaker && cfg.bluetooth.type !== 'simulated') cfg.bluetooth = null;
  if (cfg.bluetooth) {
    cfg.bluetooth = {
      adapter: 'hci0',
      autoReconnect: true,
      pauseWhenDisconnected: true,
      lockSinkVolume: true,
      pollSeconds: 5,
      ...cfg.bluetooth,
    };
    if (cfg.bluetooth.speaker) cfg.bluetooth.speaker = cfg.bluetooth.speaker.toUpperCase();
  }

  if (!/^[a-z0-9][a-z0-9_-]{0,39}$/.test(cfg.zone.id)) {
    throw new Error('zone.id is required: 1-40 characters of a-z, 0-9, "-" or "_" (e.g. "kitchen")');
  }
  if (cfg.bluetooth?.speaker && !/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(cfg.bluetooth.speaker)) {
    throw new Error(`bluetooth.speaker must be a MAC address like AA:BB:CC:DD:EE:FF (got "${cfg.bluetooth.speaker}")`);
  }
  return cfg;
}
