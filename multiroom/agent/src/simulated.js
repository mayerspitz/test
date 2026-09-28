import { EventEmitter } from 'node:events';

// Stand-ins for mpv and Bluetooth so the whole system can be tried on any
// computer (npm run demo in hub/) without speakers or audio hardware.
export class SimulatedPlayer extends EventEmitter {
  constructor({ volume = 40 } = {}) {
    super();
    this.volume = volume;
    this.state = 'idle';
    this.uid = null;
    this.position = 0;
    this.duration = null;
    this.paused = true;
    this.timer = setInterval(() => this.#tick(), 250);
    this.timer.unref();
    this.last = Date.now();
  }

  get type() {
    return 'simulated';
  }

  async start() {}

  #tick() {
    const now = Date.now();
    const dt = (now - this.last) / 1000;
    this.last = now;
    if (this.state !== 'playing') return;
    this.position += dt;
    if (this.duration && this.position >= this.duration) {
      const uid = this.uid;
      this.state = 'idle';
      this.uid = null;
      this.emit('ended', { uid, reason: 'eof', error: null });
    }
    this.emit('status');
  }

  async load({ uid, startAt = 0, duration }) {
    this.state = 'loading';
    this.uid = uid;
    this.duration = duration || 200;
    this.emit('status');
    setTimeout(() => {
      if (this.uid !== uid) return;
      this.position = startAt;
      this.state = this.paused ? 'paused' : 'playing';
      this.emit('loaded', uid);
      this.emit('status');
    }, 300);
  }

  async setPaused(paused) {
    this.paused = Boolean(paused);
    if (this.state === 'playing' || this.state === 'paused') this.state = this.paused ? 'paused' : 'playing';
    this.emit('status');
  }

  async seek(position) {
    this.position = position;
    this.emit('status');
  }

  async stop() {
    this.state = 'idle';
    this.uid = null;
    this.emit('status');
  }

  async setVolume(v) {
    this.volume = v;
    this.emit('status');
  }

  async setAudioDevice() {}

  status() {
    return {
      state: this.state,
      uid: this.uid,
      position: this.state === 'idle' ? null : this.position,
      duration: this.duration,
      volume: this.volume,
      title: null,
    };
  }

  async stopProcess() {
    clearInterval(this.timer);
  }
}

export class SimulatedBluetooth extends EventEmitter {
  constructor({ name = 'Demo speaker', connected = true, battery = null } = {}) {
    super();
    this.name = name;
    this.connected = connected;
    this.battery = battery;
    this.sink = null;
  }

  get type() {
    return 'simulated';
  }

  start() {}
  stop() {}

  async reconnectNow() {
    this.message = 'Connecting…';
    this.emit('change');
    setTimeout(() => {
      this.connected = true;
      this.message = null;
      this.emit('change');
    }, 1500);
  }

  status() {
    return {
      configured: true,
      simulated: true,
      address: '00:00:00:00:00:00',
      adapter: 'sim',
      paired: true,
      connected: this.connected,
      name: this.name,
      battery: this.battery,
      sink: null,
      message: this.connected ? null : this.message ?? 'Speaker is off or out of range — retrying',
    };
  }
}
