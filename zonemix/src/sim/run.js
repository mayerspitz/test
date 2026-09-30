#!/usr/bin/env node
// Plays a simulated wedding evening through the engine and prints what it
// did.  Usage: npm run simulate [-- path/to/venue.json] [--seed N]
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadVenue, ConfigError } from '../engine/config.js';
import { alignmentDelaysMs } from '../engine/geometry.js';
import { runScenario, weddingEvening } from './scenario.js';

const args = process.argv.slice(2);
const seedAt = args.indexOf('--seed');
const seed = seedAt >= 0 ? Number(args[seedAt + 1]) : 1;
const file = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--seed') ??
  fileURLToPath(new URL('../../config/example-venue.json', import.meta.url));

let venue;
try {
  venue = loadVenue(JSON.parse(readFileSync(file, 'utf8')));
} catch (err) {
  console.error(err instanceof ConfigError ? err.message : `Could not read ${file}: ${err.message}`);
  process.exit(1);
}
for (const w of venue.warnings) console.warn(`Warning: ${w}`);

const f = (x) => (x === null || x === undefined || !Number.isFinite(x) ? '  -  ' : x.toFixed(1).padStart(5));
const ids = venue.zones.map((z) => z.id);

console.log(`${weddingEvening.name} in "${venue.name}" (seed ${seed})\n`);
console.log('Each zone: true program level at its sensor / target (auto) or limit (limit-only), and bus gain.\n');
console.log(['time ', 'scene    ', ...ids.map((id) => id.padEnd(22))].join(' '));

const { records, summary } = runScenario(venue, weddingEvening, { seed });
for (const r of records) {
  if (Math.round(r.t) % 60 !== 0) continue;
  const cells = ids.map((id) => {
    const z = r.zones[id];
    const ref = z.mode === 'auto' ? z.targetDb : null;
    return `${f(z.trueProgramDb)}/${f(ref)} g${f(z.gainDb)}`.padEnd(22);
  });
  const mm = String(Math.round(r.t / 60)).padStart(2, '0');
  console.log([`${mm}:00`, r.scene.padEnd(9), ...cells].join(' '));
}

console.log('\nSummary (music scenes, after settling; errors are 60-second Leq vs target)');
for (const [id, s] of Object.entries(summary)) {
  const hold = s.meanAbsErrorDb === null ? 'not auto' : `mean error ${s.meanAbsErrorDb} dB, 90% within ${s.p90AbsErrorDb} dB`;
  const leq = s.maxLeqDb === null ? '' : `  worst rolling Leq ${s.maxLeqDb} dB (limit ${s.leqLimitDb})`;
  console.log(`  ${id.padEnd(9)} ${hold.padEnd(42)} loudest second ${s.maxTrueLevelDb} dB (limit ${s.limitDb})${leq}`);
  console.log(`  ${''.padEnd(9)} alarms: ${s.alarms.join(', ') || 'none'}`);
}

const delays = alignmentDelaysMs(venue);
if (Object.keys(delays).length) {
  console.log('\nSuggested speaker delays from the floor plan (ms):');
  for (const [id, ms] of Object.entries(delays)) console.log(`  ${id.padEnd(9)} ${ms}`);
}
