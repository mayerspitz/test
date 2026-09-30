import { OFF, isNum } from './units.js';

export class ConfigError extends Error {
  constructor(problems) {
    super(`The venue configuration has ${problems.length} problem(s):\n  - ${problems.join('\n  - ')}`);
    this.name = 'ConfigError';
    this.problems = problems;
  }
}

export const MODES = ['auto', 'limit-only', 'manual'];

export const CONTROL_DEFAULTS = Object.freeze({
  tickMs: 100, // control period
  blockS: 1, // estimator and Leq block length
  programWindowS: 30, // how long "typical program level" averages over
  activeThresholdDbfs: -50, // a channel counts as playing above this
  activeHoldS: 20, // ...and for this long after
  sensorLatencyMs: 200, // speaker → sensor → controller delay
  sensorOfflineS: 3,
  maxUpDbPerS: 0.5,
  maxDownDbPerS: 2,
  sceneSlewDbPerS: 6, // allowed while a scene change fades in
  safetyDownDbPerS: 6,
  safetyReleaseMarginDb: 2,
  maxSafetyCutDb: 40,
  limitHeadroomDb: 3, // keep targets this far under a zone's 1 s limit
  driftCompensationDb: 6, // most the controller corrects for room drift
  driftLimitDb: 12, // drift beyond this raises a "check the speakers" alarm
  estimatorWindowS: 60,
  budgetLookaheadS: 60,
  deadbandDb: 0.2, // smallest bus gain change worth sending
  speech: { groups: ['speech'], thresholdDbfs: -45, holdS: 1.5 },
});

const ZONE_DEFAULTS = Object.freeze({
  mode: 'auto',
  gainRangeDb: [-40, 0],
  maxLaeq1sDb: 105,
  leqLimit: null,
  ambient: null,
  duck: null,
});

/**
 * Validates a venue description and fills in defaults. Throws a ConfigError
 * listing every problem in plain English, so all typos are fixed in one pass.
 */
export function loadVenue(raw) {
  if (!raw || typeof raw !== 'object') throw new ConfigError(['The configuration is empty or is not a JSON object.']);
  const problems = [];
  const warnings = [];
  const fail = (msg) => problems.push(msg);

  const groups = Array.isArray(raw.groups) ? raw.groups : [];
  if (groups.length === 0) fail('"groups" must list at least one source group, e.g. ["speech", "band", "playback"].');
  const groupSet = new Set(groups);

  const control = { ...CONTROL_DEFAULTS, ...raw.control, speech: { ...CONTROL_DEFAULTS.speech, ...raw.control?.speech } };
  for (const g of control.speech.groups) {
    if (!groupSet.has(g)) fail(`control.speech.groups lists "${g}", which is not in "groups".`);
  }

  const channels = (raw.channels ?? []).map((c, i) => {
    const where = `Channel ${c?.id ?? `#${i + 1}`}`;
    if (!c?.id) fail(`Channel #${i + 1} needs an "id".`);
    if (!Number.isInteger(c?.mixerChannel) || c.mixerChannel < 1) {
      fail(`${where}: "mixerChannel" must be the mixer's input channel number (1 or higher).`);
    }
    if (!groupSet.has(c?.group)) fail(`${where}: group "${c?.group}" is not in "groups" (${groups.join(', ')}).`);
    if (c?.trimDb !== undefined && !isNum(c.trimDb)) fail(`${where}: "trimDb" must be a number of dB.`);
    if (c?.nominalDbfs !== undefined && !isNum(c.nominalDbfs)) fail(`${where}: "nominalDbfs" must be a number.`);
    return {
      id: c?.id,
      name: c?.name ?? c?.id,
      mixerChannel: c?.mixerChannel,
      group: c?.group,
      trimDb: c?.trimDb ?? 0,
      nominalDbfs: c?.nominalDbfs ?? -20,
    };
  });
  if (channels.length === 0) fail('"channels" must list the mixer inputs to distribute (mics, instruments, playback).');
  checkUnique(channels.map((c) => c.id), 'channel id', fail);
  checkUnique(channels.map((c) => c.mixerChannel), 'mixerChannel', fail);

  const zones = (raw.zones ?? []).map((z, i) => {
    const zone = { ...ZONE_DEFAULTS, ...z };
    const where = `Zone ${z?.id ?? `#${i + 1}`}`;
    if (!z?.id) fail(`Zone #${i + 1} needs an "id".`);
    if (!MODES.includes(zone.mode)) fail(`${where}: "mode" must be one of ${MODES.join(', ')}.`);
    if (!Number.isInteger(zone.bus) || zone.bus < 1) fail(`${where}: "bus" must be the number of the mixer bus feeding its speakers.`);
    if (zone.mode !== 'manual' && !zone.sensorId) fail(`${where}: an ${zone.mode} zone needs a "sensorId".`);
    const [lo, hi] = Array.isArray(zone.gainRangeDb) ? zone.gainRangeDb : [];
    if (!isNum(lo) || !isNum(hi) || lo >= hi) fail(`${where}: "gainRangeDb" must be [min, max] in dB with min below max.`);
    else if (hi > 10) fail(`${where}: "gainRangeDb" goes up to ${hi} dB, but mixer faders stop at +10 dB.`);
    if (!isNum(zone.maxLaeq1sDb)) fail(`${where}: "maxLaeq1sDb" must be a number (the loudest 1-second level allowed, dB(A)).`);
    const leq = zone.leqLimit;
    if (leq && !(isNum(leq.windowMin) && leq.windowMin > 0 && isNum(leq.maxDb))) {
      fail(`${where}: "leqLimit" needs "windowMin" (minutes, above 0) and "maxDb".`);
    }
    const amb = zone.ambient;
    if (amb && !(isNum(amb.thresholdDb) && isNum(amb.slope) && amb.slope >= 0 && isNum(amb.maxBoostDb) && amb.maxBoostDb >= 0)) {
      fail(`${where}: "ambient" needs "thresholdDb", "slope" (0 or more) and "maxBoostDb" (0 or more).`);
    }
    const duck = zone.duck;
    if (duck) {
      if (!Array.isArray(duck.groups) || duck.groups.some((g) => !groupSet.has(g))) {
        fail(`${where}: "duck.groups" must list groups from "groups".`);
      }
      if (!(isNum(duck.depthDb) && duck.depthDb > 0 && isNum(duck.attackS) && duck.attackS > 0 && isNum(duck.releaseS) && duck.releaseS > 0)) {
        fail(`${where}: "duck" needs "depthDb", "attackS" and "releaseS", all above 0.`);
      }
    }
    return {
      id: zone.id,
      name: zone.name ?? zone.id,
      bus: zone.bus,
      sensorId: zone.sensorId ?? null,
      mode: zone.mode,
      gainMinDb: lo,
      gainMaxDb: hi,
      maxLaeq1sDb: zone.maxLaeq1sDb,
      leqLimit: leq ?? null,
      ambient: amb ?? null,
      duck: duck ?? null,
      speakerPos: zone.speakerPos ?? null,
      listenPos: zone.listenPos ?? null,
    };
  });
  if (zones.length === 0) fail('"zones" must list at least one area with its own speakers.');
  checkUnique(zones.map((z) => z.id), 'zone id', fail);
  checkUnique(zones.map((z) => z.bus), 'zone bus', fail);
  checkUnique(zones.filter((z) => z.sensorId).map((z) => z.sensorId), 'sensorId', fail);
  const zoneIds = new Set(zones.map((z) => z.id));

  const scenes = {};
  const sceneEntries = Object.entries(raw.scenes ?? {});
  if (sceneEntries.length === 0) fail('"scenes" must define at least one scene, e.g. "dinner".');
  for (const [name, s] of sceneEntries) {
    const out = {};
    for (const zone of zones) {
      const zs = s?.zones?.[zone.id];
      const where = `Scene "${name}", zone ${zone.id}`;
      if (!zs) {
        fail(`${where}: missing. Every scene must set every zone.`);
        continue;
      }
      const key = zone.mode === 'auto' ? 'targetDb' : 'gainDb';
      const level = zs[key];
      if (!isNum(level)) {
        fail(`${where}: needs "${key}" (${key === 'targetDb' ? 'the program level to hold at its sensor, dB(A)' : 'its bus fader level, dB'}).`);
      } else if (key === 'gainDb' && (level < zone.gainMinDb || level > zone.gainMaxDb)) {
        fail(`${where}: gainDb ${level} is outside the zone's gainRangeDb [${zone.gainMinDb}, ${zone.gainMaxDb}].`);
      } else if (key === 'targetDb' && level > zone.maxLaeq1sDb) {
        fail(`${where}: target ${level} dB(A) is above the zone's limit of ${zone.maxLaeq1sDb} dB(A).`);
      }
      const mix = Object.fromEntries(groups.map((g) => [g, OFF]));
      for (const [g, v] of Object.entries(zs.mix ?? {})) {
        if (!groupSet.has(g)) fail(`${where}: mix group "${g}" is not in "groups".`);
        else if (v === 'off') mix[g] = OFF;
        else if (!isNum(v) || v > 10) fail(`${where}: mix level for "${g}" must be a number of dB up to +10, or "off".`);
        else mix[g] = v;
      }
      out[zone.id] = { level, mix };
    }
    for (const id of Object.keys(s?.zones ?? {})) {
      if (!zoneIds.has(id)) fail(`Scene "${name}": unknown zone "${id}".`);
    }
    const fadeS = s?.fadeS ?? 5;
    if (!isNum(fadeS) || fadeS < 0) fail(`Scene "${name}": "fadeS" must be 0 or more seconds.`);
    scenes[name] = { name, fadeS, zones: out };
  }
  const initialScene = raw.initialScene ?? sceneEntries[0]?.[0];
  if (sceneEntries.length && !scenes[initialScene]) fail(`"initialScene" is "${initialScene}", which is not a scene.`);

  const coupling = {};
  for (const zone of zones) if (zone.sensorId) coupling[zone.sensorId] = {};
  for (const [sensorId, row] of Object.entries(raw.calibration?.couplingDb ?? {})) {
    if (!coupling[sensorId]) {
      fail(`Calibration lists sensor "${sensorId}", which no zone uses.`);
      continue;
    }
    for (const [zoneId, db] of Object.entries(row ?? {})) {
      if (!zoneIds.has(zoneId)) fail(`Calibration for sensor "${sensorId}" lists unknown zone "${zoneId}".`);
      else if (!isNum(db)) fail(`Calibration for sensor "${sensorId}", zone "${zoneId}" must be a number of dB.`);
      else coupling[sensorId][zoneId] = db;
    }
  }
  for (const zone of zones) {
    if (zone.mode === 'manual' || !zone.sensorId) continue;
    const own = coupling[zone.sensorId]?.[zone.id];
    if (!isNum(own)) {
      fail(`Zone ${zone.id}: there is no calibration from its speakers to its sensor "${zone.sensorId}". Run calibration first.`);
      continue;
    }
    const louder = zones.filter((o) => o !== zone && (coupling[zone.sensorId][o.id] ?? OFF) > own);
    if (louder.length) {
      warnings.push(
        `Sensor ${zone.sensorId} hears ${louder.map((o) => o.name).join(', ')} louder than its own zone (${zone.name}). ` +
          'Move it into its zone\'s listening area, or check which bus feeds which speakers.',
      );
    }
  }

  const geometry = raw.geometry ? { temperatureC: 20, precedenceMs: 10, ...raw.geometry } : null;
  if (geometry?.mainZone && !zoneIds.has(geometry.mainZone)) fail(`geometry.mainZone "${geometry.mainZone}" is not a zone.`);

  if (problems.length) throw new ConfigError(problems);
  return { name: raw.name ?? 'Venue', mixer: raw.mixer ?? null, groups, channels, zones, scenes, initialScene, coupling, control, geometry, warnings };
}

function checkUnique(values, label, fail) {
  const seen = new Set();
  for (const v of values) {
    if (v === undefined || v === null) continue;
    if (seen.has(v)) fail(`Two entries share the ${label} "${v}"; each must be different.`);
    seen.add(v);
  }
}
