import { describe, expect, it } from 'vitest';
import { buildSearch, parseControls, type Controls } from './url-state';

const controls: Controls = {
  location: { key: '10001', name: 'Brooklyn', admin: 'NY', country: 'US' },
  start: { date: '2026-09-25', period: 'morning' },
  end: { date: '2026-09-27', period: 'overnight' },
  units: 'imperial',
};

describe('url state', () => {
  it('round-trips every control', () => {
    const parsed = parseControls(buildSearch(controls));
    expect(parsed).toEqual(controls);
  });

  it('keeps the location readable without a lookup', () => {
    const q = new URLSearchParams(buildSearch(controls));
    expect(q.get('loc')).toBe('10001');
    expect(q.get('name')).toBe('Brooklyn');
    expect(q.get('start')).toBe('2026-09-25:morning');
    expect(q.get('units')).toBe('imperial');
  });

  it('round-trips a metric report and a place with no admin area', () => {
    const c: Controls = {
      ...controls,
      location: { key: '328328', name: 'London', admin: '', country: 'GB' },
      units: 'metric',
    };
    expect(parseControls(buildSearch(c))).toEqual(c);
  });

  it('returns nulls for an empty query string rather than guessing', () => {
    expect(parseControls('')).toEqual({ location: null, start: null, end: null, units: null });
  });

  it('rejects malformed values instead of half-applying them', () => {
    const bad = parseControls('?loc=1&start=25-09-2026:morning&end=2026-09-27:teatime&units=stone');
    expect(bad.start).toBeNull();
    expect(bad.end).toBeNull();
    expect(bad.units).toBeNull();
    expect(bad.location).toMatchObject({ key: '1' });
  });

  it('survives a location whose name needs escaping', () => {
    const c: Controls = {
      ...controls,
      location: { key: 'x&y', name: "Martha's Vineyard, MA?", admin: 'MA', country: 'US' },
    };
    expect(parseControls(buildSearch(c)).location).toEqual(c.location);
  });
});
