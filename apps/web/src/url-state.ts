/**
 * The controls are mirrored in the query string so a report is a shareable link.
 *
 * Opening a link prefills the controls; it does not generate the report, so a shared link never
 * spends an API call before the recipient asks for one.
 *
 * Params: `loc` (AccuWeather location key) with `name`/`admin`/`country` so the search box can show
 * the place without a lookup, `start`/`end` as `YYYY-MM-DD:period`, and `units`.
 */
import { PERIOD_KEYS, type LocationResult, type PeriodKey, type Units } from '@windwise/shared';
import type { RangePick } from './dates';

export type Controls = {
  location: LocationResult | null;
  start: RangePick;
  end: RangePick;
  units: Units;
};

/** What a link actually carried. Anything absent or malformed comes back null, never a guess. */
export type PartialControls = {
  location: LocationResult | null;
  start: RangePick | null;
  end: RangePick | null;
  units: Units | null;
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function isPeriod(v: string): v is PeriodKey {
  return (PERIOD_KEYS as readonly string[]).includes(v);
}

function parsePick(raw: string | null): RangePick | null {
  if (!raw) return null;
  const [date, period] = raw.split(':');
  if (!date || !period || !DATE.test(date) || !isPeriod(period)) return null;
  return { date, period };
}

const pickToParam = (p: RangePick) => `${p.date}:${p.period}`;

export function parseControls(search: string): PartialControls {
  const q = new URLSearchParams(search);
  const key = q.get('loc');
  const units = q.get('units');
  return {
    location: key
      ? {
          key,
          name: q.get('name') ?? key,
          admin: q.get('admin') ?? '',
          country: q.get('country') ?? '',
        }
      : null,
    start: parsePick(q.get('start')),
    end: parsePick(q.get('end')),
    units: units === 'imperial' || units === 'metric' ? units : null,
  };
}

/** The query string for the current controls, leading "?" included, or "" when nothing is set. */
export function buildSearch(c: Controls): string {
  const q = new URLSearchParams();
  if (c.location) {
    q.set('loc', c.location.key);
    q.set('name', c.location.name);
    if (c.location.admin) q.set('admin', c.location.admin);
    if (c.location.country) q.set('country', c.location.country);
  }
  q.set('start', pickToParam(c.start));
  q.set('end', pickToParam(c.end));
  q.set('units', c.units);
  const s = q.toString();
  return s ? `?${s}` : '';
}
