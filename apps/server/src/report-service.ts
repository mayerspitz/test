import { buildReport, monthDay, slotsInRange, type Report, type Units } from '@windwise/shared';
import { z } from 'zod';
import { UpstreamError, type AccuWeatherClient } from './accuweather/client';
import { DAILY_WINDOWS, TIERS, type Capabilities } from './config/tiers';

const Stamp = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/,
    'Start and end must be local times (YYYY-MM-DDTHH:mm).',
  );

export const ReportBody = z.object({
  locationKey: z.string().regex(/^[A-Za-z0-9_-]{1,40}$/, 'Pick a location first.'),
  start: Stamp,
  end: Stamp,
  units: z.enum(['imperial', 'metric']).optional(),
});
export type ReportRequest = z.infer<typeof ReportBody>;

export class BadRequestError extends Error {
  readonly statusCode = 400;
}

/** True when AccuWeather refused because the key's plan does not cover the endpoint. */
function isPlanRefusal(err: unknown): boolean {
  return err instanceof UpstreamError && (err.upstreamStatus === 401 || err.upstreamStatus === 403);
}

/** Optional data (hourly, alerts) the plan doesn't include is skipped, not fatal. */
async function optional<T>(load: () => Promise<T>): Promise<T | null> {
  try {
    return await load();
  } catch (err) {
    if (isPlanRefusal(err)) return null;
    throw err;
  }
}

/**
 * Daily forecast is the one call the report cannot do without, so a plan narrower than
 * ACCUWEATHER_TIER claims must not be fatal: step down the published windows until one is allowed.
 * Only a plan refusal (401/403) steps down; every other failure surfaces. See docs/DECISIONS.md #D-22.
 */
async function loadDaily(client: AccuWeatherClient, key: string, maxDays: number) {
  const windows = DAILY_WINDOWS.filter((d) => d <= maxDays);
  let lastErr: unknown;
  for (const days of windows) {
    try {
      return await client.getDaily(key, days);
    } catch (err) {
      if (!isPlanRefusal(err)) throw err;
      lastErr = err;
    }
  }
  throw lastErr ?? new UpstreamError(502, 'AccuWeather returned no daily forecast.');
}

export async function createReport(
  client: AccuWeatherClient,
  caps: Capabilities,
  body: ReportRequest,
  defaultUnits: Units,
): Promise<Report> {
  const range = { start: body.start, end: body.end };
  if (range.end <= range.start) throw new BadRequestError('End must be after start.');
  const slots = slotsInRange(range);
  if (!slots.length) throw new BadRequestError('The range contains no periods.');

  const [location, daily] = await Promise.all([
    client.getLocation(body.locationKey),
    loadDaily(client, body.locationKey, caps.maxDailyDays),
  ]);
  const dates = daily.DailyForecasts.map((f) => f.Date.slice(0, 10));
  const first = dates[0];
  const last = dates[dates.length - 1];
  if (!first || !last) throw new UpstreamError(502, 'AccuWeather returned no daily forecast.');
  if (slots[slots.length - 1]!.date > last) {
    throw new BadRequestError(`Forecasts available through ${monthDay(last)}.`);
  }
  if (slots[0]!.date < first) {
    throw new BadRequestError(`Forecasts start ${monthDay(first)}.`);
  }

  const [hourly, alerts] = await Promise.all([
    caps.periodsMode === '4-period'
      ? optional(() => client.getHourly(body.locationKey, caps.maxHourlyHours))
      : Promise.resolve(null),
    TIERS[caps.tier].alerts
      ? optional(() => client.getAlerts(body.locationKey))
      : Promise.resolve(null),
  ]);

  return buildReport(daily, hourly, alerts, location, range, {
    units: body.units ?? defaultUnits,
    retrievedAt: new Date(),
  });
}
