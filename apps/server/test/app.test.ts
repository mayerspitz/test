import { addDays, type Report } from '@windwise/shared';
import { countPdfPages } from '@windwise/shared/pdf';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';
import { loadConfig } from '../src/config/env';
import { startMockAccuWeather, type MockUpstream } from './mock-accuweather';
import { MOCK_KEY } from './mock-data';

let upstream: MockUpstream;
beforeAll(async () => {
  upstream = await startMockAccuWeather({ apiKey: 'test-key' });
});
afterAll(() => upstream.close());
afterEach(() => {
  upstream.failWith = null;
  upstream.maxDailyDays = null;
  upstream.hits.length = 0;
});

function app(env: Record<string, string> = {}) {
  const config = loadConfig({
    ACCUWEATHER_API_KEY: 'test-key',
    ACCUWEATHER_BASE_URL: upstream.url,
    ACCUWEATHER_TIER: 'prime',
    WEB_DIST_DIR: '/nonexistent',
    ...env,
  });
  return buildApp({ config, logger: false });
}

const today = new Date().toISOString().slice(0, 10);
const body = (over: Record<string, unknown> = {}) => ({
  locationKey: MOCK_KEY,
  start: `${addDays(today, 1)}T06:00`,
  end: `${addDays(today, 3)}T06:00`,
  ...over,
});

describe('GET routes', () => {
  it('health', async () => {
    const res = await (await app()).inject('/api/health');
    expect(res.json()).toEqual({ ok: true });
  });

  it('capabilities per tier', async () => {
    expect((await (await app()).inject('/api/capabilities')).json()).toEqual({
      tier: 'prime',
      maxDailyDays: 10,
      maxHourlyHours: 72,
      periodsMode: '4-period',
    });
    const free = await (await app({ ACCUWEATHER_TIER: 'free' })).inject('/api/capabilities');
    expect(free.json()).toMatchObject({ tier: 'free', maxDailyDays: 5, periodsMode: 'day-night' });
  });

  it('location search by text and zip', async () => {
    const a = await app();
    expect((await a.inject('/api/locations?q=Brook')).json()).toEqual([
      { key: MOCK_KEY, name: 'Brooklyn', admin: 'NY', country: 'US' },
    ]);
    expect((await a.inject('/api/locations?q=11201')).json()).toHaveLength(1);
    expect(upstream.hits).toContain('/locations/v1/postalcodes/search');
    const bad = await a.inject('/api/locations?q=B');
    expect(bad.statusCode).toBe(400);
    expect(bad.json()).toEqual({ error: 'Type at least 2 characters.' });
  });

  it('caches location searches', async () => {
    const a = await app();
    await a.inject('/api/locations?q=brooklyn');
    await a.inject('/api/locations?q=brooklyn');
    expect(upstream.hits.filter((h) => h === '/locations/v1/cities/autocomplete')).toHaveLength(1);
  });
});

describe('POST /api/report', () => {
  it('builds a 4-period report with alerts', async () => {
    const res = await (await app()).inject({ method: 'POST', url: '/api/report', payload: body() });
    expect(res.statusCode).toBe(200);
    const report = res.json() as Report;
    expect(report.location).toMatchObject({ name: 'Brooklyn', admin: 'NY' });
    expect(report.periods.length).toBeGreaterThan(0);
    expect(report.periods[0]!.label).toMatch(/ AM$/);
    expect(report.alertsAvailable).toBe(true);
    expect(report.alerts[0]!.name).toBe('Coastal Flood Advisory');
    expect(report.sun).toHaveLength(2);
    expect(report.wind.tier).toBe('windy');
  });

  it('uses Day/Night only and skips hourly and alerts on the free plan', async () => {
    const res = await (
      await app({ ACCUWEATHER_TIER: 'free' })
    ).inject({
      method: 'POST',
      url: '/api/report',
      payload: body(),
    });
    const report = res.json() as Report;
    expect(report.periods.map((p) => p.source)).not.toContain('hourly');
    expect(report.notes).toEqual(['Period detail limited by API plan; showing Day/Night.']);
    expect(report.alertsAvailable).toBe(false);
    expect(upstream.hits.some((h) => h.includes('/hourly/') || h.includes('/alerts/'))).toBe(false);
    expect(upstream.hits).toContain(`/forecasts/v1/daily/5day/${MOCK_KEY}`);
  });

  it('converts to metric', async () => {
    const res = await (
      await app()
    ).inject({
      method: 'POST',
      url: '/api/report',
      payload: body({ units: 'metric' }),
    });
    expect((res.json() as Report).units).toBe('metric');
  });

  it('serves repeat reports from cache', async () => {
    const a = await app();
    await a.inject({ method: 'POST', url: '/api/report', payload: body() });
    const hits = upstream.hits.length;
    await a.inject({ method: 'POST', url: '/api/report', payload: body() });
    expect(upstream.hits.length).toBe(hits);
  });

  it('rejects ranges outside the forecast window', async () => {
    const a = await app({ ACCUWEATHER_TIER: 'free' });
    const res = await a.inject({
      method: 'POST',
      url: '/api/report',
      payload: body({ end: `${addDays(today, 6)}T06:00` }),
    });
    expect(res.statusCode).toBe(400);
    const last = new Date(`${addDays(today, 4)}T00:00:00Z`);
    const label = last.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    });
    expect(res.json()).toEqual({ error: `Forecasts available through ${label}.` });
  });

  it('rejects bad input', async () => {
    const a = await app();
    const backwards = await a.inject({
      method: 'POST',
      url: '/api/report',
      payload: body({ start: `${addDays(today, 2)}T06:00`, end: `${addDays(today, 1)}T06:00` }),
    });
    expect(backwards.json()).toEqual({ error: 'End must be after start.' });
    const noLoc = await a.inject({
      method: 'POST',
      url: '/api/report',
      payload: body({ locationKey: '' }),
    });
    expect(noLoc.statusCode).toBe(400);
    expect(noLoc.json()).toEqual({ error: 'Pick a location first.' });
  });

  it('maps AccuWeather errors to clear messages', async () => {
    const wrongKey = await (
      await app({ ACCUWEATHER_API_KEY: 'nope' })
    ).inject({
      method: 'POST',
      url: '/api/report',
      payload: body(),
    });
    expect(wrongKey.statusCode).toBe(502);
    expect(wrongKey.json()).toEqual({ error: "API key invalid or plan doesn't include this data" });

    upstream.failWith = 503;
    const quota = await (
      await app()
    ).inject({ method: 'POST', url: '/api/report', payload: body() });
    expect(quota.statusCode).toBe(503);
    expect(quota.json()).toEqual({ error: 'Daily API limit reached' });
  });

  it('explains a missing API key', async () => {
    const res = await (
      await app({ ACCUWEATHER_API_KEY: '' })
    ).inject({
      method: 'POST',
      url: '/api/report',
      payload: body(),
    });
    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ error: 'AccuWeather API key is not configured on the server.' });
  });

  it('supports bearer auth', async () => {
    const res = await (
      await app({ ACCUWEATHER_AUTH_MODE: 'bearer' })
    ).inject({
      method: 'POST',
      url: '/api/report',
      payload: body(),
    });
    expect(res.statusCode).toBe(200);
  });

  it('never returns the API key', async () => {
    const a = await app();
    for (const res of [
      await a.inject('/api/capabilities'),
      await a.inject('/api/locations?q=brooklyn'),
      await a.inject({ method: 'POST', url: '/api/report', payload: body() }),
    ]) {
      expect(res.body).not.toContain('test-key');
      expect(JSON.stringify(res.headers)).not.toContain('test-key');
    }
  });
});

describe('POST /api/report/pdf', () => {
  it('returns a one-page PDF with the expected file name', async () => {
    const res = await (
      await app()
    ).inject({ method: 'POST', url: '/api/report/pdf', payload: body() });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    const start = new Date(`${addDays(today, 1)}T00:00:00Z`);
    const end = new Date(`${addDays(today, 2)}T00:00:00Z`);
    const md = (d: Date) =>
      d
        .toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
        .replace(' ', '');
    expect(res.headers['content-disposition']).toBe(
      `attachment; filename="Brooklyn_Weather_${md(start)}-${md(end)}.pdf"`,
    );
    expect(countPdfPages(res.rawPayload)).toBe(1);
  });

  it('returns 422 when the range cannot fit on one page', async () => {
    const res = await (
      await app({ ACCUWEATHER_TIER: 'elite' })
    ).inject({
      method: 'POST',
      url: '/api/report/pdf',
      payload: body({ start: `${today}T06:00`, end: `${addDays(today, 14)}T06:00` }),
    });
    expect(res.statusCode).toBe(422);
    expect(res.json()).toEqual({ error: 'Range too long for one page — shorten it.' });
  });
});

describe('rate limit', () => {
  it('allows 60 API requests per minute per IP', async () => {
    const a = await app();
    for (let i = 0; i < 60; i++) expect((await a.inject('/api/health')).statusCode).toBe(200);
    const res = await a.inject('/api/health');
    expect(res.statusCode).toBe(429);
  });
});

describe('plan capabilities', () => {
  it('trial reports Elite-level capabilities (500 calls/day, 15-day, 120-hour, alerts)', async () => {
    const res = await (await app({ ACCUWEATHER_TIER: 'trial' })).inject('/api/capabilities');
    expect(res.json()).toEqual({
      tier: 'trial',
      maxDailyDays: 15,
      maxHourlyHours: 120,
      periodsMode: '4-period',
    });
  });

  it("steps the daily window down when the key's plan is narrower than the configured tier", async () => {
    upstream.maxDailyDays = 5;
    const res = await (
      await app({ ACCUWEATHER_TIER: 'trial' })
    ).inject({
      method: 'POST',
      url: '/api/report',
      payload: body(),
    });
    expect(res.statusCode).toBe(200);
    const daily = upstream.hits.filter((h) => h.includes('/forecasts/v1/daily/'));
    expect(daily).toEqual([
      `/forecasts/v1/daily/15day/${MOCK_KEY}`,
      `/forecasts/v1/daily/10day/${MOCK_KEY}`,
      `/forecasts/v1/daily/5day/${MOCK_KEY}`,
    ]);
    expect((res.json() as Report).periods.length).toBeGreaterThan(0);
  });

  it('does not step down on a non-plan failure', async () => {
    upstream.failWith = 500;
    const res = await (
      await app({ ACCUWEATHER_TIER: 'trial' })
    ).inject({
      method: 'POST',
      url: '/api/report',
      payload: body(),
    });
    expect(res.statusCode).toBe(502);
    expect(upstream.hits.filter((h) => h.includes('/forecasts/v1/daily/'))).toHaveLength(1);
  });
});
