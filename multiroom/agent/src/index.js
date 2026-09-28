#!/usr/bin/env node
import { Agent } from './agent.js';
import { BluetoothLink } from './bluetooth.js';
import { loadAgentConfig } from './config.js';
import { createLogger } from './log.js';
import { MpvPlayer } from './mpv.js';
import { SimulatedBluetooth, SimulatedPlayer } from './simulated.js';

let cfg;
try {
  cfg = loadAgentConfig();
} catch (err) {
  console.error(`Config error: ${err.message}`);
  console.error('Usage: multiroom-agent --config /etc/multiroom/agents/kitchen.json');
  process.exit(2);
}
const log = createLogger(cfg.zone.id);

const player =
  cfg.player.type === 'simulated'
    ? new SimulatedPlayer()
    : new MpvPlayer({
        bin: cfg.player.mpvPath,
        zoneId: cfg.zone.id,
        audioDevice: cfg.player.audioDevice && cfg.player.audioDevice !== 'auto' ? cfg.player.audioDevice : null,
        extraArgs: cfg.player.extraArgs,
        log,
      });

let bluetooth = null;
if (cfg.bluetooth?.type === 'simulated') bluetooth = new SimulatedBluetooth(cfg.bluetooth);
else if (cfg.bluetooth?.speaker) bluetooth = new BluetoothLink(cfg.bluetooth, log);

const agent = new Agent({ cfg, player, bluetooth, log });
await agent.start();

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => {
    log.info(`${sig} received, stopping`);
    await agent.stop();
    process.exit(0);
  });
}
