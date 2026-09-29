// Home Audio — phone web app for the multiroom hub. No build step: plain ES modules.
// Talks to the hub through the REST API (/api/...) and receives live state over /ws/ui.

// ---------------------------------------------------------------- helpers --
const $ = (sel, root = document) => root.querySelector(sel);

function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props ?? {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) {
    if (kid === null || kid === undefined || kid === false) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

const ICONS = {
  play: ['fill', '<path d="M8 5.6v12.8a1 1 0 0 0 1.53.85l10.2-6.4a1 1 0 0 0 0-1.7L9.53 4.75A1 1 0 0 0 8 5.6z"/>'],
  pause: ['fill', '<rect x="6" y="5" width="4.2" height="14" rx="1.2"/><rect x="13.8" y="5" width="4.2" height="14" rx="1.2"/>'],
  next: ['fill', '<path d="M5.5 5.8v12.4a.8.8 0 0 0 1.25.66l8.9-6.2a.8.8 0 0 0 0-1.32l-8.9-6.2a.8.8 0 0 0-1.25.66z"/><rect x="16.5" y="5" width="2.6" height="14" rx="1.1"/>'],
  prev: ['fill', '<path d="M18.5 5.8v12.4a.8.8 0 0 1-1.25.66l-8.9-6.2a.8.8 0 0 1 0-1.32l8.9-6.2a.8.8 0 0 1 1.25.66z"/><rect x="4.9" y="5" width="2.6" height="14" rx="1.1"/>'],
  more: ['fill', '<circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>'],
  shuffle: ['', '<path d="M16 3h5v5"/><path d="M4 20 21 3"/><path d="M21 16v5h-5"/><path d="m15 15 6 6"/><path d="m4 4 5 5"/>'],
  repeat: ['', '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>'],
  'repeat-one': ['', '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/><path d="M11 10.5h1.2V14"/>'],
  volume: ['', '<path d="M11 5 6 9H2.5v6H6l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.8 5.2a9.6 9.6 0 0 1 0 13.6"/>'],
  'volume-off': ['', '<path d="M11 5 6 9H2.5v6H6l5 4z"/><path d="m22 9-6 6"/><path d="m16 9 6 6"/>'],
  music: ['', '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>'],
  queue: ['', '<path d="M3 6h14"/><path d="M3 12h10"/><path d="M3 18h7"/><path d="M16 14.5v7l5.5-3.5z"/>'],
  bluetooth: ['', '<path d="m7 7 10 10-5 5V2l5 5L7 17"/>'],
  battery: ['', '<rect x="2" y="7" width="17" height="10" rx="2.5"/><path d="M22 11v2"/>'],
  bridge: ['', '<path d="M4.9 9.6a10 10 0 0 1 14.2 0"/><path d="M8.2 13a5.5 5.5 0 0 1 7.6 0"/><circle cx="12" cy="17" r="1.3"/>'],
  search: ['', '<circle cx="11" cy="11" r="7"/><path d="m20.5 20.5-4.2-4.2"/>'],
  plus: ['', '<path d="M12 5v14M5 12h14"/>'],
  x: ['', '<path d="M18 6 6 18M6 6l12 12"/>'],
  trash: ['', '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>'],
  upload: ['', '<path d="M12 16V4"/><path d="m6 10 6-6 6 6"/><path d="M4 20h16"/>'],
  folder: ['', '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'],
  youtube: ['', '<rect x="2" y="5" width="20" height="14" rx="4"/><path d="m10 9 5 3-5 3z"/>'],
  link: ['', '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>'],
  refresh: ['', '<path d="M21 12a9 9 0 1 1-2.64-6.36L21 8"/><path d="M21 3v5h-5"/>'],
  back: ['', '<path d="m15 18-6-6 6-6"/>'],
  chevron: ['', '<path d="m9 18 6-6-6-6"/>'],
  speaker: ['', '<rect x="6" y="3" width="12" height="18" rx="2.5"/><circle cx="12" cy="14" r="3.2"/><circle cx="12" cy="7.2" r="1.1"/>'],
  radio: ['', '<circle cx="12" cy="12" r="2"/><path d="M16.2 7.8a6 6 0 0 1 0 8.4"/><path d="M7.8 16.2a6 6 0 0 1 0-8.4"/><path d="M19.1 4.9a10 10 0 0 1 0 14.2"/><path d="M4.9 19.1a10 10 0 0 1 0-14.2"/>'],
  headphones: ['', '<path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1v-6h3z"/><path d="M3 19a2 2 0 0 0 2 2h1v-6H3z"/>'],
  list: ['', '<path d="M3 6h11"/><path d="M3 12h11"/><path d="M3 18h7"/><path d="M17 18V7l4-1"/><circle cx="15" cy="18" r="2"/>'],
  'list-plus': ['', '<path d="M3 6h12"/><path d="M3 12h12"/><path d="M3 18h7"/><path d="M18 14v8"/><path d="M14 18h8"/>'],
  up: ['', '<path d="m6 15 6-6 6 6"/>'],
  down: ['', '<path d="m6 9 6 6 6-6"/>'],
  edit: ['', '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'],
  'play-next': ['', '<path d="M3 6h12"/><path d="M3 12h8"/><path d="M3 18h8"/><path d="M15 12h6"/><path d="m18 9 3 3-3 3"/>'],
};

function icon(name, cls = '') {
  const [kind, body] = ICONS[name];
  const t = document.createElement('template');
  t.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true" class="${kind} ${cls}">${body}</svg>`;
  return t.content.firstChild;
}

function iconBtn(name, label, onclick, cls = '') {
  return h('button', { class: `icon-btn ${cls}`, 'aria-label': label, title: label, onclick }, icon(name));
}

function setIcon(btn, name) {
  if (btn.dataset.icon === name) return;
  btn.dataset.icon = name;
  btn.replaceChildren(icon(name));
}

const storage = {
  get(k, d = null) {
    try { return localStorage.getItem(k) ?? d; } catch { return d; }
  },
  set(k, v) {
    try { localStorage.setItem(k, v); } catch { /* private mode */ }
  },
};

function fmtTime(sec) {
  if (!Number.isFinite(sec) || sec < 0) return '–:––';
  const s = Math.floor(sec % 60);
  const m = Math.floor(sec / 60) % 60;
  const hr = Math.floor(sec / 3600);
  return hr ? `${hr}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

function fmtLong(sec) {
  if (!sec) return '';
  const hr = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return hr ? `${hr} h ${m} min` : `${m} min`;
}

function ago(ts) {
  if (!ts) return 'never';
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function setPct(range) {
  const min = Number(range.min) || 0;
  const max = Number(range.max) || 100;
  const pct = max > min ? ((Number(range.value) - min) / (max - min)) * 100 : 0;
  range.style.setProperty('--pct', `${pct}%`);
}

let toastTimer;
function toast(msg, isError = false) {
  const el = $('#toast');
  el.textContent = msg;
  el.className = `show${isError ? ' error' : ''}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.className = ''), isError ? 4500 : 2200);
}

// The same app runs at / (your real system) and under /demo (the demo).
const BASE = /^\/demo(\/|$)/.test(location.pathname) ? '/demo' : '';

// ------------------------------------------------------------------ state --
const state = {
  token: storage.get(`multiroom.token${BASE}`, ''),
  tab: storage.get('multiroom.tab', 'speakers'),
  zones: new Map(),
  collections: null,
  youtube: null,
  hubVersion: null,
  demo: false,
  home: null, // cloud mode: { online, lastSeen } of the home Pi
  monitor: null, // id of the speaker this phone is listening to
};
const zoneListeners = new Set();
const libraryListeners = new Set();
const playlistListeners = new Set();

// -------------------------------------------------------------------- API --
async function api(path, { method = 'GET', body } = {}) {
  const headers = {};
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}/api${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await res.json().catch(() => null);
  if (res.status === 401) {
    showLogin('Please enter the password.');
    throw new Error('Password required');
  }
  if (!res.ok) throw new Error(data?.error || `Hub error ${res.status}`);
  return data;
}

function withToken(url) {
  if (!url || !url.startsWith('/')) return url;
  const full = BASE + url;
  if (!state.token) return full;
  return `${full}${full.includes('?') ? '&' : '?'}token=${encodeURIComponent(state.token)}`;
}

function stamp(z) {
  z._recv = performance.now();
  return z;
}

function upsertZone(z) {
  const prev = state.zones.get(z.id);
  state.zones.set(z.id, stamp(z));
  if (state.tab === 'speakers') renderSpeakers();
  for (const fn of zoneListeners) fn(z, prev);
  if (z.id === state.monitor) syncMonitor();
}

// ---- "Listen on this phone": plays what a speaker plays, in the browser --------
// Handy for trying the system out (and for checking a room without walking there).
// Follows the speaker's track, pause state, position and stream volume.
const monitorAudio = new Audio();
monitorAudio.preload = 'auto';
let monitorUid = null;

function mediaUrlOf(item) {
  if (item.kind === 'track') return withToken(`/media/tracks/${item.ref}`);
  if (item.kind === 'youtube') return withToken(`/media/youtube/${item.ref}`);
  return item.ref;
}

function toggleMonitor(id) {
  state.monitor = state.monitor === id ? null : id;
  monitorUid = null;
  if (!state.monitor) {
    monitorAudio.pause();
    monitorAudio.removeAttribute('src');
    monitorAudio.load();
  } else {
    toast(`Listening to ${state.zones.get(id)?.name ?? id} on this phone`);
  }
  syncMonitor();
  if (state.tab === 'speakers') renderSpeakers();
}

// ---- Preview: hear a song on this phone before sending it to a speaker ----------
const previewAudio = new Audio();
let previewKey = null;
const previewButtons = new Set();

function previewBtn(item) {
  const key = `${item.kind}:${item.ref}`;
  const btn = iconBtn('headphones', `Preview "${item.title}" on this phone`, stop(() => togglePreview(item)));
  btn.dataset.previewKey = key;
  btn.classList.toggle('on', previewKey === key);
  previewButtons.add(btn);
  return btn;
}

function togglePreview(item) {
  const key = `${item.kind}:${item.ref}`;
  if (previewKey === key) return stopPreview();
  previewKey = key;
  monitorAudio.pause(); // one thing at a time on the phone
  previewAudio.src = mediaUrlOf(item);
  previewAudio.volume = 1;
  previewAudio.play().catch((err) => toast(`Can't preview: ${err.message}`, true));
  showPreviewBar(item.title);
  refreshPreviewButtons();
}

function stopPreview() {
  previewKey = null;
  previewAudio.pause();
  previewAudio.removeAttribute('src');
  previewAudio.load();
  $('#preview-bar')?.remove();
  refreshPreviewButtons();
  syncMonitor();
}

function refreshPreviewButtons() {
  for (const b of previewButtons) {
    if (!b.isConnected) previewButtons.delete(b);
    else b.classList.toggle('on', b.dataset.previewKey === previewKey);
  }
}

function showPreviewBar(title) {
  $('#preview-bar')?.remove();
  const time = h('span', { class: 'muted' }, '0:00');
  const bar = h('div', { id: 'preview-bar', role: 'status' },
    icon('headphones'),
    h('div', { class: 'meta' }, h('div', { class: 't', dir: 'auto' }, title), h('div', { class: 'a' }, 'Preview on this phone only · ', time)),
    iconBtn('x', 'Stop preview', stopPreview),
  );
  document.body.append(bar);
  previewAudio.ontimeupdate = () => (time.textContent = fmtTime(previewAudio.currentTime));
}
previewAudio.addEventListener('ended', stopPreview);
previewAudio.addEventListener('error', () => {
  if (previewKey) toast('This song could not be previewed', true);
  stopPreview();
});

function syncMonitor() {
  const z = state.monitor && state.zones.get(state.monitor);
  if (!z || previewKey) return;
  const cur = z.current;
  monitorAudio.volume = Math.pow(z.volume / 100, 3); // same cubic curve as the bridges (mpv)
  if (!cur || z.state === 'stopped') {
    monitorAudio.pause();
    return;
  }
  if (cur.uid !== monitorUid) {
    monitorUid = cur.uid;
    monitorAudio.src = mediaUrlOf(cur);
    monitorAudio.currentTime = z.position || 0;
  } else if (z.duration && Math.abs(monitorAudio.currentTime - z.position) > 2.5) {
    monitorAudio.currentTime = z.position;
  }
  if (z.state === 'playing' && z.playback === 'playing') monitorAudio.play().catch(() => {});
  else monitorAudio.pause();
}

async function zoneCmd(id, action, body, method = 'POST') {
  try {
    upsertZone(await api(`/zones/${encodeURIComponent(id)}/${action}`, { method, body }));
  } catch (err) {
    toast(err.message, true);
  }
}

async function playItems(zoneId, items, { mode = 'replace', startIndex, shuffle } = {}) {
  const name = state.zones.get(zoneId)?.name ?? zoneId;
  try {
    upsertZone(await api(`/zones/${encodeURIComponent(zoneId)}/play`, { method: 'POST', body: { items, mode, startIndex, shuffle } }));
    toast(mode === 'append' ? `Added to ${name}'s queue` : mode === 'next' ? `Plays next on ${name}` : `Playing on ${name}`);
    return true;
  } catch (err) {
    toast(err.message, true);
    return false;
  }
}

async function loadCollections(force = false) {
  if (!state.collections || force) state.collections = await api('/library/collections');
  return state.collections;
}

// -------------------------------------------------------------- websocket --
let ws;
let wsDelay = 1000;
function connectWs() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const q = state.token ? `?token=${encodeURIComponent(state.token)}` : '';
  ws = new WebSocket(`${proto}//${location.host}${BASE}/ws/ui${q}`);
  ws.onopen = () => {
    wsDelay = 1000;
    setConn('ok', 'Live');
  };
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.type === 'snapshot') {
      state.zones = new Map(m.zones.map((z) => [z.id, stamp(z)]));
      state.hubVersion = m.version;
      state.home = m.home ?? null;
      render();
      syncMonitor();
    } else if (m.type === 'zone') {
      upsertZone(m.zone);
    } else if (m.type === 'home') {
      state.home = m.home;
      if (state.tab === 'speakers') render();
    } else if (m.type === 'zone-removed') {
      state.zones.delete(m.id);
      render();
    } else if (m.type === 'playlists') {
      for (const fn of playlistListeners) fn(m.id);
    } else if (m.type === 'library') {
      state.collections = null;
      for (const fn of libraryListeners) fn();
    }
  };
  ws.onclose = () => {
    setConn('bad', 'Reconnecting');
    setTimeout(connectWs, wsDelay);
    wsDelay = Math.min(wsDelay * 2, 15000);
  };
}

function setConn(kind, label) {
  const el = $('#conn');
  el.className = `conn ${kind}`;
  el.querySelector('span').textContent = label;
}

document.addEventListener('visibilitychange', () => {
  // Phones freeze background tabs; reconnect right away when the app comes back.
  if (document.visibilityState === 'visible' && ws && ws.readyState > 1) {
    wsDelay = 1000;
    connectWs();
  }
});

// ------------------------------------------------------------ navigation --
const TITLES = { speakers: 'Speakers', library: 'Library', playlists: 'Playlists', settings: 'Settings' };

for (const btn of document.querySelectorAll('.tabbar button')) {
  btn.addEventListener('click', () => {
    state.tab = btn.dataset.tab;
    storage.set('multiroom.tab', state.tab);
    render();
    window.scrollTo(0, 0);
  });
}

function render() {
  for (const b of document.querySelectorAll('.tabbar button')) b.classList.toggle('active', b.dataset.tab === state.tab);
  $('#title').textContent = TITLES[state.tab];
  $('#view').replaceChildren();
  cards.clear();
  if (state.tab === 'speakers') renderSpeakers();
  else if (state.tab === 'library') renderLibrary();
  else if (state.tab === 'playlists') renderPlaylists();
  else renderSettings();
}

// -------------------------------------------------------------- speakers --
const cards = new Map();

function renderSpeakers() {
  const view = $('#view');
  const zones = [...state.zones.values()];
  if (!zones.length) {
    cards.clear();
    view.replaceChildren(
      h('div', { class: 'empty' },
        icon('speaker'),
        h('h2', null, 'No speakers yet'),
        ...(state.home
          ? [
              h('p', null, state.home.online ? 'Your home Pi is connected — add your first speaker.' : 'Waiting for your home Pi to connect.'),
              state.home.online ? h('p', null, h('button', { class: 'btn primary', onclick: () => openAddSpeaker() }, icon('plus'), 'Add a speaker')) : null,
              h('p', { class: 'muted' }, 'Set it up with ', h('code', null, 'deploy/install-home.sh'), '. Meanwhile, try the ', h('a', { href: '/demo/' }, 'demo'), '.'),
            ]
          : [
              h('p', null, 'Each speaker appears here as soon as its bridge connects to this hub.'),
              h('p', { class: 'muted' }, 'Set one up with ', h('code', null, 'deploy/install-agent.sh'), ' — or try everything first with ', h('code', null, 'npm run demo'), '.'),
            ]),
      ),
    );
    return;
  }
  let grid = $('.zones', view);
  if (!grid) {
    view.replaceChildren();
    cards.clear();
    const bar = h('div', { class: 'toolbar' },
      h('button', { class: 'btn small', onclick: () => api('/zones/pause-all', { method: 'POST' }).catch((e) => toast(e.message, true)) }, icon('pause'), 'Pause all'),
    );
    grid = h('div', { class: 'zones' });
    if (state.home && !state.home.online) {
      view.append(h('div', { class: 'demo-banner warn-banner' },
        h('strong', null, 'Home Pi offline. '),
        `Last seen ${ago(state.home.lastSeen)}. Speakers, the library and uploads come back as soon as it reconnects.`));
    }
    if (state.demo) {
      view.append(h('div', { class: 'demo-banner' },
        h('strong', null, 'Demo hub. '),
        'The speakers here are simulated, and the sample songs are generated tones. Tap ', icon('headphones'),
        ' on a speaker to hear it on this phone. Anyone with this link shares the same demo.'));
    }
    view.append(bar, grid);
  }
  for (const z of zones) {
    let c = cards.get(z.id);
    if (!c) {
      c = createCard(z.id);
      cards.set(z.id, c);
    }
    if (c.root.parentNode !== grid) grid.append(c.root);
    updateCard(c, z);
  }
  for (const [id, c] of cards) {
    if (!state.zones.has(id)) {
      c.root.remove();
      cards.delete(id);
    }
  }
}

function createCard(id) {
  const c = { id };
  const zone = () => state.zones.get(id);
  c.name = h('div', { class: 'zone-name', dir: 'auto' });
  c.chips = h('div', { class: 'chips' });
  c.art = h('div', { class: 'art' });
  c.title = h('div', { class: 't', dir: 'auto' });
  c.artist = h('div', { class: 'a', dir: 'auto' });
  c.nextUp = h('div', { class: 'n', dir: 'auto' });
  c.elapsed = h('span');
  c.total = h('span');
  c.seek = h('input', { type: 'range', min: 0, max: 100, step: 1, value: 0, 'aria-label': 'Position in song' });
  const startSeek = () => (c.seeking = true);
  c.seek.addEventListener('pointerdown', startSeek);
  c.seek.addEventListener('touchstart', startSeek, { passive: true });
  c.seek.addEventListener('input', () => {
    c.seeking = true;
    c.elapsed.textContent = fmtTime(Number(c.seek.value));
    setPct(c.seek);
  });
  c.seek.addEventListener('change', async () => {
    await zoneCmd(id, 'seek', { position: Number(c.seek.value) });
    c.seeking = false;
  });

  c.prev = iconBtn('prev', 'Previous', () => zoneCmd(id, 'previous'));
  c.play = iconBtn('play', 'Play', () => zoneCmd(id, 'toggle'), 'play-btn');
  c.next = iconBtn('next', 'Next', () => zoneCmd(id, 'next'));
  c.shuffle = iconBtn('shuffle', 'Shuffle', () => zoneCmd(id, 'mode', { shuffle: !zone().shuffle }, 'PUT'));
  c.repeat = iconBtn('repeat', 'Repeat', () => {
    const order = ['off', 'all', 'one'];
    zoneCmd(id, 'mode', { repeat: order[(order.indexOf(zone().repeat) + 1) % 3] }, 'PUT');
  });

  // Volume = the stream's software volume on the bridge. The speaker's own volume is never changed.
  c.vol = h('input', { type: 'range', min: 0, max: 100, step: 1, 'aria-label': 'Volume' });
  c.volOut = h('output');
  c.volIcon = h('span');
  let volTimer = null;
  let volSent = 0;
  const sendVol = () => {
    volSent = Date.now();
    api(`/zones/${encodeURIComponent(id)}/volume`, { method: 'PUT', body: { volume: Number(c.vol.value) } }).catch((e) => toast(e.message, true));
  };
  c.vol.addEventListener('input', () => {
    c.volDragging = true;
    c.volOut.textContent = c.vol.value;
    setPct(c.vol);
    clearTimeout(volTimer);
    if (Date.now() - volSent > 150) sendVol();
    else volTimer = setTimeout(sendVol, 150);
  });
  c.vol.addEventListener('change', () => {
    clearTimeout(volTimer);
    sendVol();
    setTimeout(() => (c.volDragging = false), 800);
  });

  c.queueCount = h('span');
  c.error = h('div', { class: 'error hidden' });
  c.root = h('section', { class: 'zone', 'aria-label': id },
    h('div', { class: 'zone-head' }, c.name, c.listen = iconBtn('headphones', 'Listen on this phone', () => toggleMonitor(id)), iconBtn('more', 'Speaker options', () => openZoneMenu(id))),
    c.chips,
    h('div', { class: 'now' }, c.art, h('div', { class: 'meta' }, c.title, c.artist, c.nextUp)),
    h('div', { class: 'progress playing-only' }, c.elapsed, c.seek, c.total),
    h('div', { class: 'controls playing-only' }, c.shuffle, h('div', { class: 'mid' }, c.prev, c.play, c.next), c.repeat),
    h('div', { class: 'volume' }, c.volIcon, c.vol, c.volOut),
    c.error,
    h('div', { class: 'zone-actions' },
      h('button', { class: 'btn primary', onclick: () => openPicker(id) }, icon('music'), 'Choose music'),
      h('button', { class: 'btn', onclick: () => openQueue(id), 'aria-label': 'Queue' }, icon('queue'), c.queueCount),
    ),
  );
  return c;
}

function chip(kind, iconName, text) {
  return h('span', { class: `chip ${kind}` }, iconName ? icon(iconName) : h('i', { class: 'dot' }), text);
}

function updateCard(c, z) {
  c.name.textContent = z.name;
  c.listen.classList.toggle('on', state.monitor === z.id);
  c.listen.setAttribute('aria-pressed', String(state.monitor === z.id));
  c.root.classList.toggle('offline', !z.online);
  c.root.classList.toggle('idle', !z.queueLength);

  const chips = [];
  if (!z.online) chips.push(chip('bad', 'bridge', `Bridge offline · ${ago(z.lastSeen)}`));
  else if (!z.speaker) chips.push(chip('ok', 'bridge', 'Online'));
  else if (z.speaker.connected) {
    chips.push(chip('ok', 'bluetooth', z.speaker.name || 'Speaker connected'));
    if (Number.isFinite(z.speaker.battery)) chips.push(chip(z.speaker.battery <= 20 ? 'warn' : '', 'battery', `${z.speaker.battery}%`));
  } else {
    chips.push(chip('warn', 'bluetooth', z.speaker.message || 'Speaker not connected'));
  }
  const speakerReady = !z.speaker || z.speaker.connected;
  if (z.online && speakerReady && z.state === 'playing' && z.playback && z.playback !== 'playing') {
    chips.push(chip('warn', null, z.playback === 'loading' ? 'Loading…' : 'Starting…'));
  }
  c.chips.replaceChildren(...chips);

  const cur = z.current;
  const art = cur?.artwork ? withToken(cur.artwork) : null;
  if (c.art.dataset.src !== (art ?? '')) {
    c.art.dataset.src = art ?? '';
    c.art.style.backgroundImage = art ? `url("${art.replace(/"/g, '%22')}")` : '';
    c.art.replaceChildren(art ? '' : icon(cur?.kind === 'url' ? 'radio' : cur?.kind === 'youtube' ? 'youtube' : 'music'));
  }
  c.title.textContent = cur ? cur.title : 'Nothing playing';
  c.artist.textContent = cur ? z.streamTitle || cur.artist || (cur.kind === 'url' ? 'Stream' : cur.kind === 'youtube' ? 'YouTube Music' : '') : 'Choose music to start';
  c.nextUp.textContent = z.next ? `Next: ${z.next.title}` : '';

  const live = cur && !z.duration;
  c.seek.disabled = !cur || live;
  c.total.textContent = live ? 'Live' : fmtTime(z.duration ?? NaN);
  c.seek.max = String(Math.max(1, Math.round(z.duration ?? 1)));
  if (!c.seeking) {
    c.seek.value = String(Math.round(z.position));
    c.elapsed.textContent = cur ? fmtTime(z.position) : '0:00';
    setPct(c.seek);
  }

  const playing = z.state === 'playing';
  setIcon(c.play, playing ? 'pause' : 'play');
  c.play.setAttribute('aria-label', playing ? 'Pause' : 'Play');
  c.prev.disabled = c.play.disabled = !z.queueLength;
  c.next.disabled = !z.queueLength;
  c.shuffle.classList.toggle('on', z.shuffle);
  setIcon(c.repeat, z.repeat === 'one' ? 'repeat-one' : 'repeat');
  c.repeat.classList.toggle('on', z.repeat !== 'off');
  c.repeat.setAttribute('aria-label', `Repeat: ${z.repeat}`);

  if (!c.volDragging) {
    c.vol.value = String(z.volume);
    c.volOut.textContent = String(z.volume);
    setPct(c.vol);
  }
  const volIcon = Number(c.vol.value) === 0 ? 'volume-off' : 'volume';
  if (c.volIcon.dataset.icon !== volIcon) {
    c.volIcon.dataset.icon = volIcon;
    c.volIcon.replaceChildren(icon(volIcon));
  }
  c.queueCount.textContent = z.queueLength ? `${z.queueLength}` : 'Queue';
  c.error.textContent = z.error ?? '';
  c.error.classList.toggle('hidden', !z.error);
}

// Smoothly advance progress bars between hub updates.
setInterval(() => {
  for (const c of cards.values()) {
    const z = state.zones.get(c.id);
    if (!z || c.seeking || z.state !== 'playing' || z.playback !== 'playing') continue;
    let pos = z.position + (performance.now() - z._recv) / 1000;
    if (z.duration) pos = Math.min(pos, z.duration);
    c.seek.value = String(Math.round(pos));
    c.elapsed.textContent = fmtTime(pos);
    setPct(c.seek);
  }
}, 500);

// ----------------------------------------------------------------- sheets --
function openSheet({ title, tall = false, onClose } = {}) {
  const root = $('#sheet-root');
  const backdrop = h('div', { class: 'sheet-backdrop' });
  const titleEl = h('h2', { dir: 'auto' }, title);
  const body = h('div', { class: 'sheet-body' });
  const sheet = h('div', { class: `sheet${tall ? ' tall' : ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('div', { class: 'sheet-grab' }),
    h('div', { class: 'sheet-head' }, titleEl, iconBtn('x', 'Close', () => close())),
    body,
  );
  const onKey = (e) => e.key === 'Escape' && close();
  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    sheet.classList.remove('open');
    backdrop.classList.remove('open');
    window.removeEventListener('keydown', onKey);
    setTimeout(() => {
      sheet.remove();
      backdrop.remove();
    }, 260);
    onClose?.();
  }
  backdrop.addEventListener('click', close);
  window.addEventListener('keydown', onKey);
  root.append(backdrop, sheet);
  requestAnimationFrame(() => {
    sheet.classList.add('open');
    backdrop.classList.add('open');
  });
  return { body, close, setTitle: (t) => (titleEl.textContent = t) };
}

function spinner() {
  return h('div', { class: 'spinner', role: 'progressbar', 'aria-label': 'Loading' });
}

function searchField(placeholder, oninput) {
  const input = h('input', { class: 'field', type: 'search', placeholder, autocomplete: 'off', enterkeyhint: 'search' });
  if (oninput) input.addEventListener('input', oninput);
  return { input, wrap: h('div', { class: 'search' }, icon('search'), input) };
}

function artEl(url, fallback = 'music') {
  const el = h('div', { class: 'art sm' });
  if (url) el.style.backgroundImage = `url("${withToken(url).replace(/"/g, '%22')}")`;
  else el.append(icon(fallback));
  return el;
}

function itemRow({ art, fallback, num, title, subtitle, duration, current, onclick, actions = [] }) {
  const lead = num !== undefined ? h('span', { class: 'num' }, num) : artEl(art, fallback);
  return h('div', { class: `row${current ? ' current' : ''}`, role: 'button', tabindex: 0, onclick, onkeydown: (e) => e.key === 'Enter' && onclick?.() },
    lead,
    h('div', { class: 'meta' }, h('div', { class: 't', dir: 'auto' }, title), subtitle ? h('div', { class: 'a', dir: 'auto' }, subtitle) : null),
    h('div', { class: 'actions' }, duration ? h('span', { class: 'dur' }, fmtTime(duration)) : null, ...actions),
  );
}

function stop(fn) {
  return (e) => {
    e.stopPropagation();
    fn();
  };
}

// -------------------------------------------------------- music picker --
// The picker sends what you choose to a "target": a speaker (play / queue) or a
// playlist you're building. Playlists mix library songs, YouTube songs and links.
function zoneTarget(zoneId) {
  const name = state.zones.get(zoneId)?.name ?? zoneId;
  return {
    forZone: true,
    title: `Play on ${name}`,
    go: (items, opts) => playItems(zoneId, items, opts),
    add: (items) => playItems(zoneId, items, { mode: 'append' }),
    next: (items) => playItems(zoneId, items, { mode: 'next' }),
  };
}

function playlistTarget(pl, onChange) {
  const add = (items) => addToPlaylist(pl, items, onChange);
  return { forZone: false, title: `Add to “${pl.name}”`, go: add, add };
}

async function addToPlaylist(pl, items, onChange) {
  try {
    const r = await api(`/playlists/${pl.id}/items`, { method: 'POST', body: { items } });
    toast(`Added to “${r.name}”`);
    onChange?.(r);
    return true;
  } catch (err) {
    toast(err.message, true);
    return false;
  }
}

// Row buttons: preview, add (to queue or playlist), and ⋯ (play next / add to playlist).
function rowActions(target, spec, preview) {
  const acts = [];
  if (preview) acts.push(previewBtn(preview));
  acts.push(iconBtn('plus', target.forZone ? 'Add to queue' : 'Add to playlist', stop(() => target.add([spec]))));
  if (target.forZone) acts.push(iconBtn('more', 'More', stop(() => openItemMenu(target, [spec], preview?.title ?? 'Song'))));
  return acts;
}

function openItemMenu(target, items, title) {
  const s = openSheet({ title });
  s.body.append(h('div', { class: 'pane' },
    h('button', { class: 'btn', onclick: async () => (await target.next(items)) && s.close() }, icon('play-next'), 'Play next'),
    h('button', { class: 'btn', onclick: () => (s.close(), addToPlaylistFlow(items)) }, icon('list-plus'), 'Add to playlist…'),
  ));
}

// Pick an existing playlist, or create a new one, for `items`.
async function addToPlaylistFlow(items, suggestedName = '') {
  let lists;
  try {
    lists = await api('/playlists');
  } catch (err) {
    toast(err.message, true);
    return;
  }
  const s = openSheet({ title: 'Add to playlist' });
  const name = h('input', { class: 'field', placeholder: 'New playlist name', value: suggestedName, dir: 'auto' });
  s.body.append(h('div', { class: 'pane' },
    h('form', { class: 'split', onsubmit: async (e) => {
      e.preventDefault();
      try {
        const pl = await api('/playlists', { method: 'POST', body: { name: name.value, items } });
        toast(`Created “${pl.name}” with ${plural(pl.items.length, 'song')}`);
        s.close();
      } catch (err) {
        toast(err.message, true);
      }
    } }, name, h('button', { class: 'btn primary', type: 'submit' }, icon('plus'), 'New playlist')),
    h('div', { class: 'list' }, ...lists.map((pl) => itemRow({
      art: pl.artwork,
      fallback: 'list',
      title: pl.name,
      subtitle: plural(pl.count, 'song'),
      onclick: async () => (await addToPlaylist(pl, items)) && s.close(),
    }))),
  ));
}

function openPicker(zoneId) {
  openPickerFor(zoneTarget(zoneId));
}

function openPickerFor(target) {
  const s = openSheet({ title: target.title, tall: true });
  const tabs = [
    ['library', 'Library', 'music'],
    ['youtube', 'YouTube', 'youtube'],
    ...(target.forZone ? [['playlists', 'Playlists', 'list']] : []),
    ['link', 'Link', 'link'],
  ];
  const seg = h('div', { class: 'segmented', role: 'tablist' });
  const pane = h('div', { class: 'pane' });
  const show = (tab) => {
    if (!tabs.some(([k]) => k === tab)) tab = 'library';
    storage.set('multiroom.pickerTab', tab);
    for (const b of seg.children) b.classList.toggle('active', b.dataset.tab === tab);
    pane.replaceChildren();
    if (tab === 'library') libraryPane(pane, target, s);
    else if (tab === 'youtube') youtubePane(pane, target, s);
    else if (tab === 'playlists') playlistsPane(pane, target, s);
    else linkPane(pane, target, s);
  };
  for (const [key, label, ic] of tabs) seg.append(h('button', { 'data-tab': key, role: 'tab', onclick: () => show(key) }, icon(ic), label));
  s.body.append(seg, pane);
  show(storage.get('multiroom.pickerTab', 'library'));
}

async function libraryPane(pane, target, sheet) {
  const done = (ok) => ok && target.forZone && sheet.close();
  const results = h('div', { class: 'list' });
  let timer;
  const { input, wrap } = searchField('Search your music', () => {
    clearTimeout(timer);
    timer = setTimeout(() => (input.value.trim() ? searchTracks(input.value.trim()) : showCollections()), 250);
  });
  pane.append(wrap, results);

  async function showCollections() {
    results.replaceChildren(spinner());
    let cols;
    try {
      cols = await loadCollections();
    } catch (err) {
      results.replaceChildren(h('p', { class: 'hint' }, err.message));
      return;
    }
    if (!cols.length) {
      results.replaceChildren(h('p', { class: 'hint' }, 'Your library is empty. Add music from the Library tab.'));
      return;
    }
    results.replaceChildren(
      ...cols.map((col) => {
        const spec = [{ kind: 'collection', name: col.name }];
        return itemRow({
          art: col.cover ? `/api/library/tracks/${col.cover}/cover` : null,
          fallback: 'folder',
          title: col.name,
          subtitle: `${plural(col.tracks, 'song')}${col.duration ? ` · ${fmtLong(col.duration)}` : ''}`,
          onclick: () => showCollection(col),
          actions: target.forZone
            ? [
                iconBtn('shuffle', `Shuffle ${col.name}`, stop(() => target.go(spec, { shuffle: true }).then(done))),
                iconBtn('play', `Play ${col.name}`, stop(() => target.go(spec, { shuffle: false }).then(done))),
              ]
            : [iconBtn('plus', `Add all of ${col.name}`, stop(() => target.add(spec)))],
        });
      }),
    );
  }

  async function showCollection(col) {
    results.replaceChildren(spinner());
    const { items } = await api(`/library/tracks?collection=${encodeURIComponent(col.name)}&limit=5000`);
    const collection = [{ kind: 'collection', name: col.name }];
    results.replaceChildren(
      h('button', { class: 'back', onclick: showCollections }, icon('back'), 'Collections'),
      h('div', { class: 'toolbar' },
        ...(target.forZone
          ? [
              h('button', { class: 'btn small primary', onclick: () => target.go(collection, { shuffle: false }).then(done) }, icon('play'), 'Play all'),
              h('button', { class: 'btn small', onclick: () => target.go(collection, { shuffle: true }).then(done) }, icon('shuffle'), 'Shuffle'),
              h('button', { class: 'btn small', onclick: () => target.add(collection) }, icon('plus'), 'Add all to queue'),
            ]
          : [h('button', { class: 'btn small primary', onclick: () => target.add(collection) }, icon('plus'), `Add all ${items.length}`)]),
      ),
      ...items.map((t, i) => itemRow({
        num: i + 1,
        title: t.title,
        subtitle: t.artist,
        duration: t.duration,
        onclick: () => (target.forZone ? target.go(collection, { startIndex: i }) : target.add([{ kind: 'track', id: t.id }])),
        actions: rowActions(target, { kind: 'track', id: t.id }, { kind: 'track', ref: t.id, title: t.title }),
      })),
    );
  }

  async function searchTracks(q) {
    results.replaceChildren(spinner());
    const { items, total } = await api(`/library/tracks?q=${encodeURIComponent(q)}&limit=200`);
    if (input.value.trim() !== q) return;
    results.replaceChildren(
      ...(items.length ? [] : [h('p', { class: 'hint' }, 'No songs match.')]),
      ...items.map((t) => itemRow({
        art: t.hasCover || t.folderArt ? `/api/library/tracks/${t.id}/cover` : null,
        title: t.title,
        subtitle: [t.artist, t.collection].filter(Boolean).join(' · '),
        duration: t.duration,
        onclick: () => target.go([{ kind: 'track', id: t.id }], { mode: 'now' }),
        actions: rowActions(target, { kind: 'track', id: t.id }, { kind: 'track', ref: t.id, title: t.title }),
      })),
      ...(total > items.length ? [h('p', { class: 'hint' }, `Showing ${items.length} of ${total} — refine your search.`)] : []),
    );
  }

  libraryListeners.add(showCollections);
  pane.addEventListener('remove', () => libraryListeners.delete(showCollections));
  showCollections();
}

const ytCache = { q: '', results: null, title: null };

async function youtubePane(pane, target) {
  const { input, wrap } = searchField('Search songs, or paste a YouTube Music link');
  input.value = ytCache.q;
  const results = h('div', { class: 'list' });
  const form = h('form', { onsubmit: (e) => { e.preventDefault(); run(); } }, wrap);
  pane.append(form, results);

  if (!state.youtube) state.youtube = await api('/youtube/status').catch(() => ({ available: false }));
  if (!state.youtube.available) {
    results.replaceChildren(h('div', { class: 'card' },
      h('strong', null, 'YouTube Music is not available right now'),
      h('p', { class: 'muted' }, state.demo
        ? 'The demo has no YouTube. On your real system the home Pi fetches YouTube Music.'
        : 'It needs yt-dlp on the computer that holds the music (the installers set it up), and that computer must be online.'),
    ));
    input.disabled = true;
    return;
  }

  const toItem = (it) => ({ kind: 'youtube', id: it.id, title: it.title, artist: it.artist, duration: it.duration, artwork: it.artwork });
  const show = (items, playlistTitle) => {
    const all = items.map(toItem);
    const head = playlistTitle && items.length > 1
      ? [h('div', { class: 'toolbar' },
          ...(target.forZone
            ? [
                h('button', { class: 'btn small primary', onclick: () => target.go(all, { shuffle: false }) }, icon('play'), `Play all ${items.length}`),
                h('button', { class: 'btn small', onclick: () => target.go(all, { shuffle: true }) }, icon('shuffle'), 'Shuffle'),
                h('button', { class: 'btn small', onclick: () => target.add(all) }, icon('plus'), 'Add all to queue'),
                h('button', { class: 'btn small', onclick: () => addToPlaylistFlow(all, playlistTitle) }, icon('list-plus'), 'Save as playlist'),
              ]
            : [h('button', { class: 'btn small primary', onclick: () => target.add(all) }, icon('plus'), `Add all ${items.length}`)]),
        )]
      : [];
    results.replaceChildren(
      ...(playlistTitle && items.length > 1 ? [h('p', { class: 'hint', dir: 'auto' }, `Playlist: ${playlistTitle}`)] : []),
      ...head,
      ...(items.length ? [] : [h('p', { class: 'hint' }, 'Nothing found.')]),
      ...items.map((it) => itemRow({
        art: it.artwork,
        fallback: 'youtube',
        title: it.title,
        subtitle: it.artist,
        duration: it.duration,
        onclick: () => target.go([toItem(it)], { mode: 'now' }),
        actions: rowActions(target, toItem(it), { kind: 'youtube', ref: it.id, title: it.title }),
      })),
    );
  };

  async function run() {
    const q = input.value.trim();
    if (!q) return;
    input.blur();
    results.replaceChildren(spinner());
    try {
      const isLink = /^https?:\/\//i.test(q) || /^[A-Za-z0-9_-]{11}$/.test(q);
      const res = isLink ? await api('/youtube/resolve', { method: 'POST', body: { url: q } }) : { items: await api(`/youtube/search?q=${encodeURIComponent(q)}`) };
      Object.assign(ytCache, { q, results: res.items, title: res.title ?? null });
      show(res.items, res.title);
    } catch (err) {
      results.replaceChildren(h('p', { class: 'hint' }, err.message));
    }
  }

  if (ytCache.results) show(ytCache.results, ytCache.title);
  else results.replaceChildren(h('p', { class: 'hint' }, 'Tip: in the YouTube Music app, Share → Copy link, then paste it here to play a song, album or playlist — or add a whole playlist to the queue.'));
}

async function playlistsPane(pane, target, sheet) {
  const list = h('div', { class: 'list' }, spinner());
  pane.append(list);
  let lists;
  try {
    lists = await api('/playlists');
  } catch (err) {
    list.replaceChildren(h('p', { class: 'hint' }, err.message));
    return;
  }
  const showAll = () => list.replaceChildren(
    ...(lists.length ? [] : [h('p', { class: 'hint' }, 'No playlists yet. Build one in the Playlists tab, or use ⋯ → Add to playlist on any song.')]),
    ...lists.map((pl) => {
      const spec = [{ kind: 'playlist', id: pl.id }];
      return itemRow({
        art: pl.artwork,
        fallback: 'list',
        title: pl.name,
        subtitle: `${plural(pl.count, 'song')}${pl.duration ? ` · ${fmtLong(pl.duration)}` : ''}`,
        onclick: () => showOne(pl),
        actions: [
          iconBtn('shuffle', `Shuffle ${pl.name}`, stop(() => target.go(spec, { shuffle: true }).then((ok) => ok && sheet.close()))),
          iconBtn('play', `Play ${pl.name}`, stop(() => target.go(spec, { shuffle: false }).then((ok) => ok && sheet.close()))),
        ],
      });
    }),
  );
  async function showOne(summary) {
    list.replaceChildren(spinner());
    const pl = await api(`/playlists/${summary.id}`);
    const spec = [{ kind: 'playlist', id: pl.id }];
    list.replaceChildren(
      h('button', { class: 'back', onclick: showAll }, icon('back'), 'Playlists'),
      h('div', { class: 'toolbar' },
        h('button', { class: 'btn small primary', onclick: () => target.go(spec, { shuffle: false }).then((ok) => ok && sheet.close()) }, icon('play'), 'Play all'),
        h('button', { class: 'btn small', onclick: () => target.go(spec, { shuffle: true }).then((ok) => ok && sheet.close()) }, icon('shuffle'), 'Shuffle'),
        h('button', { class: 'btn small', onclick: () => target.add(spec) }, icon('plus'), 'Add all to queue'),
      ),
      ...pl.items.map((it, i) => itemRow({
        art: it.artwork,
        fallback: it.kind === 'youtube' ? 'youtube' : it.kind === 'url' ? 'radio' : 'music',
        title: it.title,
        subtitle: [it.artist, KIND_LABEL[it.kind]].filter(Boolean).join(' · '),
        duration: it.duration,
        onclick: () => target.go(spec, { startIndex: i }),
        actions: [previewBtn({ kind: it.kind, ref: it.ref, title: it.title })],
      })),
    );
  }
  showAll();
}

const KIND_LABEL = { track: 'Library', youtube: 'YouTube', url: 'Link' };

function linkPane(pane, target, sheet) {
  const url = h('input', { class: 'field', type: 'url', placeholder: 'https://…', inputmode: 'url', autocomplete: 'off' });
  const title = h('input', { class: 'field', type: 'text', placeholder: 'Name (optional)' });
  const go = async (mode) => {
    const u = url.value.trim();
    if (!u) return;
    let items;
    try {
      if (/(^|\.)youtube\.com|youtu\.be/i.test(new URL(u).hostname)) {
        const res = await api('/youtube/resolve', { method: 'POST', body: { url: u } });
        items = res.items.map((it) => ({ kind: 'youtube', id: it.id, title: it.title, artist: it.artist, duration: it.duration, artwork: it.artwork }));
      } else {
        items = [{ kind: 'url', url: u, title: title.value.trim() || undefined }];
      }
    } catch (err) {
      toast(err.message, true);
      return;
    }
    const ok = mode === 'append' ? await target.add(items) : await target.go(items, { mode });
    if (ok && target.forZone) sheet.close();
    if (ok && !target.forZone) url.value = title.value = '';
  };
  pane.append(
    h('label', { class: 'stack' }, 'Stream or file URL', url),
    h('label', { class: 'stack' }, 'Name', title),
    h('div', { class: 'toolbar' },
      ...(target.forZone
        ? [
            h('button', { class: 'btn primary', onclick: () => go('now') }, icon('play'), 'Play now'),
            h('button', { class: 'btn', onclick: () => go('append') }, icon('plus'), 'Add to queue'),
          ]
        : [h('button', { class: 'btn primary', onclick: () => go('append') }, icon('plus'), 'Add to playlist')]),
    ),
    h('p', { class: 'hint' }, 'Internet radio, an MP3 link, media served by your own app — or any YouTube / YouTube Music link (a playlist link adds every song).'),
  );
}

// ------------------------------------------------------------------ queue --
function openQueue(zoneId) {
  const z = state.zones.get(zoneId);
  const s = openSheet({ title: `Queue · ${z?.name ?? zoneId}`, tall: true, onClose: () => zoneListeners.delete(onZone) });
  const list = h('div', { class: 'list' });
  const bar = h('div', { class: 'toolbar' },
    h('button', { class: 'btn small', onclick: async () => {
      const name = prompt('Name for the new playlist', `${z?.name ?? 'Queue'} mix`);
      if (!name) return;
      try {
        const pl = await api(`/zones/${encodeURIComponent(zoneId)}/queue/save`, { method: 'POST', body: { name } });
        toast(`Saved “${pl.name}” (${plural(pl.items.length, 'song')})`);
      } catch (err) {
        toast(err.message, true);
      }
    } }, icon('list-plus'), 'Save as playlist'),
    h('button', { class: 'btn small danger', onclick: async () => {
      if (!confirm('Clear the whole queue?')) return;
      await zoneCmd(zoneId, 'queue', undefined, 'DELETE');
    } }, icon('trash'), 'Clear queue'),
  );
  s.body.append(bar, list);
  let version = null;
  let index = null;

  async function load() {
    try {
      const q = await api(`/zones/${encodeURIComponent(zoneId)}/queue`);
      version = q.queueVersion;
      index = q.index;
      draw(q);
    } catch (err) {
      list.replaceChildren(h('p', { class: 'hint' }, err.message));
    }
  }
  function draw(q) {
    if (!q.items.length) {
      list.replaceChildren(h('p', { class: 'hint' }, 'The queue is empty.'));
      return;
    }
    const from = Math.max(0, q.index - 20);
    const to = Math.min(q.items.length, from + 400);
    const rows = [];
    if (from > 0) rows.push(h('p', { class: 'hint' }, `${from} earlier songs not shown`));
    for (let i = from; i < to; i++) {
      const it = q.items[i];
      rows.push(itemRow({
        num: i === q.index ? '▶' : i + 1,
        title: it.title,
        subtitle: it.artist,
        duration: it.duration,
        current: i === q.index,
        onclick: () => zoneCmd(zoneId, 'queue/jump', { index: i }),
        actions: [iconBtn('x', 'Remove from queue', stop(() => zoneCmd(zoneId, `queue/${i}`, undefined, 'DELETE')))],
      }));
    }
    if (to < q.items.length) rows.push(h('p', { class: 'hint' }, `…and ${q.items.length - to} more`));
    list.replaceChildren(...rows);
    list.querySelector('.current')?.scrollIntoView({ block: 'center' });
  }
  function onZone(nz) {
    if (nz.id === zoneId && (nz.queueVersion !== version || nz.index !== index)) load();
  }
  zoneListeners.add(onZone);
  list.append(spinner());
  load();
}

// ----------------------------------------------------------- speaker menu --
function openZoneMenu(zoneId) {
  const z = state.zones.get(zoneId);
  if (!z) return;
  const s = openSheet({ title: z.name });
  const name = h('input', { class: 'field', value: z.name, maxlength: 60, dir: 'auto' });
  const sp = z.speaker;
  const details = [
    ['Bridge', z.online ? `Online · ${z.bridge?.host ?? ''}` : `Offline · last seen ${ago(z.lastSeen)}`],
    ['Bridge address', z.bridge?.address],
    ['Player', z.bridge?.player],
    ['Speaker', sp ? `${sp.name ?? 'Unknown'} (${sp.connected ? 'connected' : 'not connected'})` : 'Default audio output'],
    ['Bluetooth address', sp?.address],
    ['Adapter', sp?.adapter],
    ['Battery', Number.isFinite(sp?.battery) ? `${sp.battery}%` : null],
    ['Status', sp?.message],
    ['Speaker id', z.id],
  ].filter(([, v]) => v);
  s.body.append(h('div', { class: 'pane' },
    h('label', { class: 'stack' }, 'Name', name),
    h('div', { class: 'toolbar' },
      h('button', { class: 'btn primary', onclick: async () => {
        try {
          upsertZone(await api(`/zones/${encodeURIComponent(zoneId)}`, { method: 'PATCH', body: { name: name.value } }));
          s.close();
        } catch (err) {
          toast(err.message, true);
        }
      } }, 'Save name'),
      sp && z.online ? h('button', { class: 'btn', onclick: async () => {
        await zoneCmd(zoneId, 'bluetooth/reconnect');
        toast('Reconnecting the speaker…');
      } }, icon('bluetooth'), 'Reconnect speaker') : null,
    ),
    h('dl', { class: 'kv card' }, ...details.flatMap(([k, v]) => [h('dt', null, k), h('dd', null, v)])),
    h('p', { class: 'hint' }, 'Volume here is the stream\'s own volume. The speaker\'s hardware volume is never changed by this system — set it once on the speaker and leave it.'),
    !z.online ? h('button', { class: 'btn danger', onclick: async () => {
      if (!confirm(`Remove "${z.name}"? It comes back automatically if its bridge connects again.`)) return;
      try {
        await api(`/zones/${encodeURIComponent(zoneId)}`, { method: 'DELETE' });
        s.close();
      } catch (err) {
        toast(err.message, true);
      }
    } }, icon('trash'), 'Remove speaker') : null,
  ));
}

function chooseZone(title) {
  return new Promise((resolve) => {
    let chosen = null;
    const s = openSheet({ title, onClose: () => resolve(chosen) });
    const zones = [...state.zones.values()];
    if (!zones.length) s.body.append(h('p', { class: 'hint' }, 'No speakers yet.'));
    s.body.append(h('div', { class: 'list' }, ...zones.map((z) => itemRow({
      fallback: 'speaker',
      title: z.name,
      subtitle: !z.online ? 'Bridge offline' : z.current ? `${z.state === 'playing' ? 'Playing' : 'Paused'}: ${z.current.title}` : 'Idle',
      onclick: () => {
        chosen = z.id;
        s.close();
      },
    }))));
  });
}

// ---------------------------------------------------------------- library --
const AUDIO_RE = /\.(mp3|m4a|m4b|aac|flac|ogg|oga|opus|wav|wma|aiff?|mka|webm|mp2|ape|wv)$/i;

async function renderLibrary(detail = null) {
  const view = $('#view');
  if (detail) return renderCollection(detail);

  const colInput = h('input', { class: 'field', list: 'collections-list', placeholder: 'e.g. Kitchen MP3 player', dir: 'auto', value: storage.get('multiroom.uploadCollection', '') });
  const datalist = h('datalist', { id: 'collections-list' });
  const filesInput = h('input', { type: 'file', multiple: true, accept: 'audio/*,.mp3,.m4a,.flac,.wav,.ogg,.opus,.wma,.aac', class: 'hidden' });
  const folderInput = h('input', { type: 'file', multiple: true, webkitdirectory: true, class: 'hidden' });
  const progress = h('div', { class: 'hidden' }, h('div', { class: 'bar' }, h('i')), h('p', { class: 'muted' }));
  const onPick = (input) => async () => {
    const collection = colInput.value.trim() || 'Uploads';
    storage.set('multiroom.uploadCollection', collection);
    await uploadFiles([...input.files], collection, progress);
    input.value = '';
  };
  filesInput.addEventListener('change', onPick(filesInput));
  folderInput.addEventListener('change', onPick(folderInput));
  const list = h('div', { class: 'list' }, spinner());
  const summary = h('span', { class: 'muted' });

  view.replaceChildren(
    h('div', { class: 'card' },
      h('h2', { style: 'margin:0 0 4px;font-size:17px' }, 'Add music'),
      h('p', { class: 'muted', style: 'margin:0 0 12px' }, 'Upload each MP3 player\'s songs into its own collection. Folders keep their structure.'),
      h('label', { class: 'stack' }, 'Collection', colInput, datalist),
      h('div', { class: 'split', style: 'margin-top:12px' },
        h('button', { class: 'btn primary', onclick: () => filesInput.click() }, icon('upload'), 'Add songs'),
        h('button', { class: 'btn', onclick: () => folderInput.click() }, icon('folder'), 'Add folder'),
      ),
      filesInput, folderInput, progress,
    ),
    h('div', { class: 'section-title', style: 'display:flex;justify-content:space-between;align-items:center' },
      h('span', null, 'Collections'),
      h('button', { class: 'btn small', onclick: async () => {
        try {
          const r = await api('/library/rescan', { method: 'POST' });
          toast(`Library rescanned: ${plural(r.total, 'song')}`);
          refresh(true);
        } catch (err) {
          toast(err.message, true);
        }
      } }, icon('refresh'), 'Rescan'),
    ),
    summary,
    list,
  );

  async function refresh(force = false) {
    let cols;
    try {
      cols = await loadCollections(force);
    } catch (err) {
      list.replaceChildren(h('p', { class: 'hint' }, err.message));
      return;
    }
    datalist.replaceChildren(...cols.map((c) => h('option', { value: c.name })));
    const total = cols.reduce((n, c) => n + c.tracks, 0);
    summary.textContent = cols.length ? `${plural(total, 'song')} in ${plural(cols.length, 'collection')}` : '';
    list.replaceChildren(
      ...(cols.length ? [] : [h('p', { class: 'hint' }, 'No music yet. Upload songs above, or copy files into the hub\'s library folder and tap Rescan.')]),
      ...cols.map((col) => itemRow({
        art: col.cover ? `/api/library/tracks/${col.cover}/cover` : null,
        fallback: 'folder',
        title: col.name,
        subtitle: `${plural(col.tracks, 'song')}${col.duration ? ` · ${fmtLong(col.duration)}` : ''}`,
        onclick: () => renderCollection(col),
        actions: [icon('chevron')],
      })),
    );
  }
  const onLib = () => state.tab === 'library' && $('.zones') === null && refresh(true);
  libraryListeners.clear();
  libraryListeners.add(onLib);
  refresh();
}

async function renderCollection(col) {
  const view = $('#view');
  view.replaceChildren(spinner());
  let items;
  try {
    ({ items } = await api(`/library/tracks?collection=${encodeURIComponent(col.name)}&limit=5000`));
  } catch (err) {
    view.replaceChildren(h('p', { class: 'hint' }, err.message));
    return;
  }
  const collection = [{ kind: 'collection', name: col.name }];
  const playOn = async (payload, opts) => {
    const zoneId = await chooseZone('Play on…');
    if (zoneId) playItems(zoneId, payload, opts);
  };
  view.replaceChildren(
    h('button', { class: 'back', onclick: () => renderLibrary() }, icon('back'), 'Library'),
    h('h2', { dir: 'auto', style: 'margin:4px 0 2px' }, col.name),
    h('p', { class: 'muted', style: 'margin:0' }, `${plural(items.length, 'song')}${col.duration ? ` · ${fmtLong(col.duration)}` : ''}`),
    h('div', { class: 'toolbar', style: 'margin-top:12px' },
      h('button', { class: 'btn small primary', onclick: () => playOn(collection, { shuffle: false }) }, icon('play'), 'Play on…'),
      h('button', { class: 'btn small', onclick: () => playOn(collection, { shuffle: true }) }, icon('shuffle'), 'Shuffle on…'),
      h('button', { class: 'btn small danger', onclick: async () => {
        if (!confirm(`Delete the collection "${col.name}" and its ${items.length} files from the hub?`)) return;
        try {
          await api(`/library/collections/${encodeURIComponent(col.name)}`, { method: 'DELETE' });
          toast('Collection deleted');
          renderLibrary();
        } catch (err) {
          toast(err.message, true);
        }
      } }, icon('trash'), 'Delete'),
    ),
    h('div', { class: 'list' }, ...items.map((t, i) => itemRow({
      num: i + 1,
      title: t.title,
      subtitle: [t.artist, t.album].filter(Boolean).join(' · '),
      duration: t.duration,
      onclick: () => playOn(collection, { startIndex: i }),
      actions: [previewBtn({ kind: 'track', ref: t.id, title: t.title }), iconBtn('trash', 'Delete song', stop(async () => {
        if (!confirm(`Delete "${t.title}" from the hub?`)) return;
        try {
          await api(`/library/tracks/${t.id}`, { method: 'DELETE' });
          renderCollection(col);
        } catch (err) {
          toast(err.message, true);
        }
      }))],
    }))),
  );
}

// Uploads in batches so a big folder doesn't become one fragile giant request.
async function uploadFiles(files, collection, progressEl) {
  const audio = files.filter((f) => AUDIO_RE.test(f.name));
  if (!audio.length) {
    toast('No audio files in that selection', true);
    return;
  }
  const batches = [];
  let cur = [];
  let size = 0;
  for (const f of audio) {
    if (cur.length && (cur.length >= 25 || size + f.size > 200 * 1024 * 1024)) {
      batches.push(cur);
      cur = [];
      size = 0;
    }
    cur.push(f);
    size += f.size;
  }
  batches.push(cur);

  const total = audio.reduce((n, f) => n + f.size, 0);
  let done = 0;
  let saved = 0;
  const skipped = [];
  const bar = progressEl.querySelector('.bar i');
  const label = progressEl.querySelector('p');
  progressEl.classList.remove('hidden');
  const show = (loaded) => {
    const pct = total ? Math.round(((done + loaded) / total) * 100) : 100;
    bar.style.width = `${pct}%`;
    label.textContent = `Uploading ${audio.length} songs to “${collection}” — ${pct}%`;
  };
  try {
    for (const batch of batches) {
      const res = await xhrUpload(batch, collection, show);
      saved += res.saved.length;
      skipped.push(...res.skipped);
      done += batch.reduce((n, f) => n + f.size, 0);
      show(0);
    }
    label.textContent = `Added ${plural(saved, 'song')} to “${collection}”${skipped.length ? ` · ${skipped.length} skipped` : ''}`;
    toast(`Added ${plural(saved, 'song')}`);
    state.collections = null;
  } catch (err) {
    label.textContent = `Upload stopped: ${err.message} (${plural(saved, 'song')} saved)`;
    toast(err.message, true);
  }
}

function xhrUpload(files, collection, onProgress) {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    for (const f of files) fd.append('files', f, f.webkitRelativePath || f.name);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${BASE}/api/library/upload?collection=${encodeURIComponent(collection)}`);
    if (state.token) xhr.setRequestHeader('Authorization', `Bearer ${state.token}`);
    xhr.upload.onprogress = (e) => onProgress(e.loaded);
    xhr.onload = () => {
      let data = null;
      try { data = JSON.parse(xhr.responseText); } catch { /* ignore */ }
      if (xhr.status >= 200 && xhr.status < 300 && data) resolve(data);
      else reject(new Error(data?.error || `Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.send(fd);
  });
}

// -------------------------------------------------------------- playlists --
// Build playlists that mix library songs, YouTube songs and links, then play them anywhere.
async function renderPlaylists(openId = null) {
  const view = $('#view');
  playlistListeners.clear();
  if (openId) return renderPlaylist(openId);
  const name = h('input', { class: 'field', placeholder: 'New playlist name', dir: 'auto' });
  const list = h('div', { class: 'list' }, spinner());
  view.replaceChildren(
    h('form', { class: 'card pane', onsubmit: async (e) => {
      e.preventDefault();
      try {
        const pl = await api('/playlists', { method: 'POST', body: { name: name.value } });
        renderPlaylist(pl.id);
      } catch (err) {
        toast(err.message, true);
      }
    } },
      h('h2', { style: 'margin:0;font-size:17px' }, 'New playlist'),
      h('p', { class: 'muted', style: 'margin:0' }, 'Mix songs from your library, YouTube Music and links in any order.'),
      h('div', { class: 'split' }, name, h('button', { class: 'btn primary', type: 'submit' }, icon('plus'), 'Create')),
    ),
    h('div', { class: 'section-title' }, 'Your playlists'),
    list,
  );
  const load = async () => {
    let lists;
    try {
      lists = await api('/playlists');
    } catch (err) {
      list.replaceChildren(h('p', { class: 'hint' }, err.message));
      return;
    }
    list.replaceChildren(
      ...(lists.length ? [] : [h('p', { class: 'hint' }, 'No playlists yet.')]),
      ...lists.map((pl) => itemRow({
        art: pl.artwork,
        fallback: 'list',
        title: pl.name,
        subtitle: `${plural(pl.count, 'song')}${pl.duration ? ` · ${fmtLong(pl.duration)}` : ''}${pl.kinds.length ? ` · ${pl.kinds.map((k) => KIND_LABEL[k]).join(' + ')}` : ''}`,
        onclick: () => renderPlaylist(pl.id),
        actions: [icon('chevron')],
      })),
    );
  };
  playlistListeners.add(load);
  load();
}

async function renderPlaylist(id) {
  const view = $('#view');
  playlistListeners.clear();
  let pl;
  let editing = false;
  const reload = async () => {
    try {
      pl = await api(`/playlists/${id}`);
    } catch (err) {
      view.replaceChildren(h('button', { class: 'back', onclick: () => renderPlaylists() }, icon('back'), 'Playlists'), h('p', { class: 'hint' }, err.message));
      return;
    }
    draw();
  };
  const spec = () => [{ kind: 'playlist', id }];
  const playOn = async (opts) => {
    const zoneId = await chooseZone('Play on…');
    if (zoneId) playItems(zoneId, spec(), opts);
  };
  const edit = async (fn) => {
    try {
      pl = await fn();
      draw();
    } catch (err) {
      toast(err.message, true);
    }
  };
  function draw() {
    const n = pl.items.length;
    view.replaceChildren(
      h('button', { class: 'back', onclick: () => renderPlaylists() }, icon('back'), 'Playlists'),
      h('h2', { dir: 'auto', style: 'margin:4px 0 2px' }, pl.name),
      h('p', { class: 'muted', style: 'margin:0' }, `${plural(n, 'song')}${n ? ` · ${fmtLong(pl.items.reduce((t, i) => t + (i.duration ?? 0), 0))}` : ''}`),
      h('div', { class: 'toolbar', style: 'margin-top:12px' },
        h('button', { class: 'btn small primary', onclick: () => openPickerFor(playlistTarget(pl, (r) => ((pl = r), draw()))) }, icon('plus'), 'Add songs'),
        n ? h('button', { class: 'btn small', onclick: () => playOn({ shuffle: false }) }, icon('play'), 'Play on…') : null,
        n ? h('button', { class: 'btn small', onclick: () => playOn({ shuffle: true }) }, icon('shuffle'), 'Shuffle on…') : null,
        h('button', { class: 'btn small', onclick: () => {
          const name = prompt('Rename playlist', pl.name);
          if (name) edit(() => api(`/playlists/${id}`, { method: 'PATCH', body: { name } }));
        } }, icon('edit'), 'Rename'),
        n ? h('button', { class: `btn small${editing ? ' primary' : ''}`, onclick: () => ((editing = !editing), draw()) }, icon('list'), editing ? 'Done' : 'Edit order') : null,
        h('button', { class: 'btn small danger', onclick: async () => {
          if (!confirm(`Delete the playlist “${pl.name}”? (The songs themselves stay.)`)) return;
          try {
            await api(`/playlists/${id}`, { method: 'DELETE' });
            renderPlaylists();
          } catch (err) {
            toast(err.message, true);
          }
        } }, icon('trash'), 'Delete'),
      ),
      h('div', { class: 'list' },
        ...(n ? [] : [h('p', { class: 'hint' }, 'Empty. Tap “Add songs” to pick from your library, YouTube Music or a link.')]),
        ...pl.items.map((it, i) => itemRow({
          num: i + 1,
          title: it.title,
          subtitle: [it.artist, KIND_LABEL[it.kind]].filter(Boolean).join(' · '),
          duration: editing ? null : it.duration,
          onclick: () => (editing ? null : playOn({ startIndex: i })),
          actions: !editing ? [previewBtn({ kind: it.kind, ref: it.ref, title: it.title })] : [
            i > 0 ? iconBtn('up', 'Move up', stop(() => edit(() => api(`/playlists/${id}/items/move`, { method: 'POST', body: { from: i, to: i - 1 } })))) : null,
            i < n - 1 ? iconBtn('down', 'Move down', stop(() => edit(() => api(`/playlists/${id}/items/move`, { method: 'POST', body: { from: i, to: i + 1 } })))) : null,
            iconBtn('x', 'Remove from playlist', stop(() => edit(() => api(`/playlists/${id}/items/${i}`, { method: 'DELETE' })))),
          ].filter(Boolean),
        })),
      ),
    );
  }
  playlistListeners.add((changed) => (changed === id || changed === null) && reload());
  view.replaceChildren(spinner());
  reload();
}

// ---------------------------------------------------------- speaker setup --
// Add or remove Bluetooth speakers from the app: the home Pi scans, pairs the chosen
// speaker to a free USB Bluetooth adapter and starts playing to it.
async function renderSpeakerSetup(el) {
  let st;
  try {
    st = await api('/setup');
  } catch (err) {
    el.replaceChildren(h('p', { class: 'muted', style: 'margin:0' },
      state.demo ? 'In the demo the speakers are simulated. On your real system this is where you add and remove Bluetooth speakers.' : err.message));
    return;
  }
  const refresh = () => renderSpeakerSetup(el);
  el.replaceChildren(
    h('p', { class: 'muted', style: 'margin:0' }, `${plural(st.adapters.length, 'Bluetooth adapter')} on the Pi · ${st.free} free${st.free ? '' : ' — plug in another USB Bluetooth adapter to add a speaker'}`),
    h('div', { class: 'list' }, ...st.speakers.map((sp) => itemRow({
      fallback: 'speaker',
      title: sp.name,
      subtitle: `${sp.speaker ?? ''} · adapter ${sp.adapter ?? ''}`,
      actions: [iconBtn('trash', `Remove ${sp.name}`, stop(async () => {
        if (!confirm(`Remove “${sp.name}”? The Pi forgets the speaker and frees its adapter.`)) return;
        try {
          await api(`/setup/speakers/${encodeURIComponent(sp.id)}`, { method: 'DELETE' });
          toast(`Removed ${sp.name}`);
          refresh();
        } catch (err) {
          toast(err.message, true);
        }
      }))],
    }))),
    h('div', { class: 'toolbar', style: 'margin:0' },
      h('button', { class: 'btn primary', disabled: !st.free, onclick: () => openAddSpeaker(refresh) }, icon('plus'), 'Add a speaker'),
      h('button', { class: 'btn', onclick: openSystemCheck }, icon('refresh'), 'Run system check'),
    ),
  );
}

// Runs the Pi's system check (deploy/doctor.sh) and shows the report.
async function openSystemCheck() {
  const s = openSheet({ title: 'System check', tall: true });
  s.body.append(spinner(), h('p', { class: 'hint', style: 'text-align:center' }, 'Checking the Pi… (up to a minute)'));
  try {
    const r = await api('/setup/check');
    s.body.replaceChildren(h('div', { class: 'pane' }, ...r.report.split('\n').map((line) => {
      const cls = line.startsWith('✗') ? 'bad' : line.startsWith('!') ? 'warn' : line.startsWith('✓') ? 'ok' : '';
      return h('div', { class: `check ${cls}`, dir: 'auto' }, line);
    })));
  } catch (err) {
    s.body.replaceChildren(h('p', { class: 'hint' }, err.message));
  }
}

function openAddSpeaker(onDone) {
  const s = openSheet({ title: 'Add a speaker', tall: true });
  const body = h('div', { class: 'pane' });
  s.body.append(body);
  const start = () => body.replaceChildren(
    h('p', { style: 'margin:0' }, '1. Turn the speaker on and put it in ', h('strong', null, 'pairing mode'), ' (usually: hold its Bluetooth button until the light blinks).'),
    h('p', { class: 'muted', style: 'margin:0' }, 'If it was connected to a phone or MP3 player before, switch Bluetooth off on that device first.'),
    h('button', { class: 'btn primary', onclick: scan }, icon('search'), '2. Search for speakers'),
  );
  async function scan() {
    body.replaceChildren(spinner(), h('p', { class: 'hint', style: 'text-align:center' }, 'Searching for about 12 seconds…'));
    let found;
    try {
      found = await api('/setup/scan', { method: 'POST', body: {} });
    } catch (err) {
      body.replaceChildren(h('p', { class: 'hint' }, err.message), h('button', { class: 'btn', onclick: start }, 'Back'));
      return;
    }
    body.replaceChildren(
      h('p', { style: 'margin:0' }, found.length ? '3. Tap your speaker:' : 'Nothing found. Is the speaker in pairing mode?'),
      h('div', { class: 'list' }, ...found.map((d) => itemRow({
        fallback: d.audio ? 'speaker' : 'bluetooth',
        title: d.name,
        subtitle: `${d.audio ? 'Speaker / audio' : 'Other device'} · ${d.address}${d.rssi !== null ? ` · signal ${d.rssi} dBm` : ''}`,
        onclick: () => confirmAdd(d),
      }))),
      h('button', { class: 'btn', onclick: scan }, icon('refresh'), 'Search again'),
    );
  }
  function confirmAdd(d) {
    const name = h('input', { class: 'field', value: d.name, maxlength: 60, dir: 'auto' });
    body.replaceChildren(
      h('label', { class: 'stack' }, 'Name in the app (e.g. the room)', name),
      h('button', { class: 'btn primary', onclick: async () => {
        body.replaceChildren(spinner(), h('p', { class: 'hint', style: 'text-align:center' }, `Pairing ${d.name}… this can take up to 30 seconds.`));
        try {
          const r = await api('/setup/speakers', { method: 'POST', body: { address: d.address, name: name.value } });
          toast(`${r.name} added`);
          s.close();
          onDone?.();
        } catch (err) {
          body.replaceChildren(h('p', { class: 'hint' }, err.message), h('button', { class: 'btn', onclick: start }, 'Try again'));
        }
      } }, icon('plus'), 'Add speaker'),
      h('button', { class: 'btn', onclick: scan }, 'Back'),
    );
  }
  start();
}

// --------------------------------------------------------------- settings --
async function renderSettings() {
  const view = $('#view');
  const token = h('input', { class: 'field', type: 'password', value: state.token, placeholder: 'Password', autocomplete: 'current-password' });
  const about = h('dl', { class: 'kv' });
  const btSection = h('div', { class: 'card pane' }, spinner());
  view.replaceChildren(
    h('div', { class: 'section-title' }, 'Speakers & Bluetooth'),
    btSection,
    h('div', { class: 'section-title' }, 'All speakers'),
    h('div', { class: 'card toolbar', style: 'margin:0' },
      h('button', { class: 'btn', onclick: () => api('/zones/pause-all', { method: 'POST' }).then(() => toast('Paused everything'), (e) => toast(e.message, true)) }, icon('pause'), 'Pause all'),
      h('button', { class: 'btn danger', onclick: () => api('/zones/stop-all', { method: 'POST' }).then(() => toast('Stopped everything'), (e) => toast(e.message, true)) }, 'Stop all'),
    ),
    h('div', { class: 'section-title' }, 'Password'),
    h('div', { class: 'card pane' },
      token,
      h('div', null, h('button', { class: 'btn primary', onclick: async () => {
        await saveToken(token.value.trim());
      } }, 'Save password')),
      h('p', { class: 'hint', style: 'margin:0' }, 'The app password (MULTIROOM_TOKEN on the server). The home Pi uses the same one.'),
    ),
    h('div', { class: 'section-title' }, 'About this hub'),
    h('div', { class: 'card' }, about),
    h('div', { class: 'section-title' }, 'Install on your phone'),
    h('div', { class: 'card muted' },
      h('p', { style: 'margin:0 0 6px' }, 'iPhone (Safari): Share → Add to Home Screen.'),
      h('p', { style: 'margin:0' }, 'Android (Chrome): ⋮ menu → Add to Home screen.'),
    ),
  );
  renderSpeakerSetup(btSection);
  const zones = [...state.zones.values()];
  if (!state.youtube) state.youtube = await api('/youtube/status').catch(() => ({ available: false }));
  const sys = await api('/system').catch(() => null);
  const gb = (n) => `${(n / 1e9).toFixed(n < 1e10 ? 1 : 0)} GB`;
  const rows = [
    ['Hub version', state.hubVersion ?? '–'],
    ['Music library', sys ? `${plural(sys.library.tracks, 'song')} · ${gb(sys.library.bytes)}` : '–'],
    ['Storage free', sys ? `${gb(sys.disk.free)} of ${gb(sys.disk.total)}` : '–'],
    ['Speakers online', `${zones.filter((z) => z.online).length} of ${zones.length}`],
    ['Now playing', `${zones.filter((z) => z.state === 'playing').length}`],
    ['YouTube Music', state.youtube.available ? `yt-dlp ${state.youtube.version}` : 'Not installed on the hub'],
    ['Web address', location.origin],
  ];
  about.replaceChildren(...rows.flatMap(([k, v]) => [h('dt', null, k), h('dd', null, v)]));
}

async function saveToken(value) {
  state.token = value;
  storage.set(`multiroom.token${BASE}`, value);
  try {
    await api('/zones');
    toast('Password saved');
    if (ws) ws.close();
    else connectWs();
    render();
  } catch (err) {
    toast(err.message, true);
  }
}

// ------------------------------------------------------------------ login --
let loginShown = false;
function showLogin(message) {
  if (loginShown) return;
  loginShown = true;
  const token = h('input', { class: 'field', type: 'password', placeholder: 'Password', autocomplete: 'current-password' });
  const submit = async (e) => {
    e.preventDefault();
    state.token = token.value.trim();
    storage.set(`multiroom.token${BASE}`, state.token);
    try {
      const r = await fetch(`${BASE}/api/zones`, { headers: { Authorization: `Bearer ${state.token}` } });
      if (!r.ok) throw new Error('Wrong password');
      loginShown = false;
      connectWs();
      render();
    } catch (err) {
      toast(err.message, true);
    }
  };
  $('#view').replaceChildren(
    h('form', { class: 'card pane', style: 'margin-top:24px', onsubmit: submit },
      h('h2', { style: 'margin:0' }, 'Home Audio'),
      h('p', { class: 'muted', style: 'margin:0' }, message),
      token,
      h('button', { class: 'btn primary', type: 'submit' }, 'Continue'),
    ),
  );
  token.focus();
}

// ------------------------------------------------------------------- boot --
async function boot() {
  const health = await fetch(`${BASE}/api/health`).then((r) => r.json()).catch(() => null);
  if (!health) {
    setConn('bad', 'Hub unreachable');
    setTimeout(boot, 3000);
    return;
  }
  state.demo = Boolean(health.demo);
  if (health.auth) {
    const ok = state.token && (await fetch(`${BASE}/api/zones`, { headers: { Authorization: `Bearer ${state.token}` } })).ok;
    if (!ok) {
      showLogin('Enter the password once — this phone will remember it.');
      return;
    }
  }
  render();
  connectWs();
}

if ('serviceWorker' in navigator && window.isSecureContext) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
boot();
