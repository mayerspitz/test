import os from 'node:os';
import { HubLink } from './hub-link.js';

export const AGENT_VERSION = '0.1.0';

// Glue between the hub (what to play), the player (mpv) and the speaker link.
// The hub owns the queue; this side only plays the current item and reports back.
export class Agent {
  constructor({ cfg, player, bluetooth, log }) {
    this.cfg = cfg;
    this.player = player;
    this.bt = bluetooth;
    this.log = log;
    this.hubBase = new URL(cfg.hub);
    this.desiredPaused = true;
    this.lastEnded = null;
    this.lastSent = null;
    this.lastSentAt = 0;
    this.statusTimer = null;
    this.link = new HubLink({ hubUrl: cfg.hub, token: cfg.token, log, hello: () => this.#hello() });
  }

  async start() {
    this.player.on('status', () => this.#queueStatus());
    this.player.on('loaded', () => this.#applyPause());
    this.player.on('ended', (e) => {
      this.lastEnded = { ...e, at: Date.now() };
      this.link.send({ type: 'ended', ...e });
    });
    this.player.on('restarted', () => this.link.send({ type: 'restarted' }));
    this.link.on('message', (msg) => this.#onHubMessage(msg).catch((err) => this.log.error(err.message)));
    this.bt?.on('change', () => this.#onSpeakerChange());
    await this.player.start();
    this.bt?.start();
    this.link.connect();
    this.log.info(`Bridge for "${this.cfg.zone.name}" started — hub ${this.cfg.hub}, player ${this.player.type}` +
      (this.bt ? `, speaker ${this.cfg.bluetooth.speaker ?? 'simulated'} via ${this.cfg.bluetooth.adapter}` : ', default audio output'));
  }

  async stop() {
    this.link.close();
    this.bt?.stop();
    await this.player.stopProcess();
  }

  #hello() {
    return {
      type: 'hello',
      zone: this.cfg.zone,
      version: AGENT_VERSION,
      host: os.hostname(),
      playerType: this.player.type,
      bluetooth: this.bt?.status() ?? null,
      player: this.player.status(),
      lastEnded: this.lastEnded,
    };
  }

  async #onHubMessage(msg) {
    switch (msg.type) {
      case 'load': {
        this.desiredPaused = Boolean(msg.paused);
        const { url, headers } = this.#resolve(msg.item.url);
        this.lastEnded = null;
        await this.player.load({ uid: msg.item.uid, url, headers, startAt: msg.position ?? 0, duration: msg.item.duration });
        break;
      }
      case 'sync':
        this.desiredPaused = Boolean(msg.paused);
        await this.#applyPause();
        break;
      case 'pause':
        this.desiredPaused = true;
        await this.#applyPause();
        break;
      case 'resume':
        this.desiredPaused = false;
        await this.#applyPause();
        break;
      case 'stop':
        this.desiredPaused = true;
        await this.player.stop();
        break;
      case 'seek':
        await this.player.seek(msg.position);
        break;
      case 'volume':
        await this.player.setVolume(msg.value);
        break;
      case 'bt-reconnect':
        await this.bt?.reconnectNow();
        break;
      default:
    }
  }

  // Media from the hub gets the access token; external URLs never do.
  #resolve(raw) {
    const u = new URL(raw, this.hubBase);
    const sameOrigin = u.origin === this.hubBase.origin;
    return { url: u.toString(), headers: sameOrigin && this.cfg.token ? [`Authorization: Bearer ${this.cfg.token}`] : [] };
  }

  // Playback only runs while the hub says "play" AND the speaker is connected —
  // otherwise the music would continue on the bridge's built-in output or be lost.
  #speakerBlocks() {
    return Boolean(this.bt) && this.cfg.bluetooth?.pauseWhenDisconnected !== false && !this.bt.connected;
  }

  #applyPause() {
    return this.player.setPaused(this.desiredPaused || this.#speakerBlocks());
  }

  async #onSpeakerChange() {
    if (this.bt?.connected && this.bt.sink && this.cfg.player.audioDevice === 'auto') {
      await this.player.setAudioDevice(`pulse/${this.bt.sink}`);
    }
    await this.#applyPause();
    this.#queueStatus(true);
  }

  // Status goes out immediately when something meaningful changes, otherwise at most once a second.
  #queueStatus(force = false) {
    const p = this.player.status();
    const key = JSON.stringify([p.state, p.uid, p.volume, p.title, this.bt?.connected, this.bt?.message, this.bt?.battery]);
    const due = force || key !== this.lastSent || Date.now() - this.lastSentAt >= 1000;
    if (due) {
      clearTimeout(this.statusTimer);
      this.statusTimer = null;
      this.lastSent = key;
      this.lastSentAt = Date.now();
      this.link.send({ type: 'status', player: p, bluetooth: this.bt?.status() ?? null });
    } else if (!this.statusTimer) {
      this.statusTimer = setTimeout(() => {
        this.statusTimer = null;
        this.#queueStatus(true);
      }, 1000 - (Date.now() - this.lastSentAt));
    }
  }
}
