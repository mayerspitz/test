import type { AwAlert, AwDaily, AwHour, AwLocation } from '@windwise/shared';
import { TTL, type Cache } from '../cache';

/** An AccuWeather failure, already translated into a message safe to show the user. */
export class UpstreamError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
    readonly upstreamStatus?: number,
  ) {
    super(message);
  }
}

export type AccuWeatherClient = {
  searchLocations(q: string): Promise<AwLocation[]>;
  getLocation(key: string): Promise<AwLocation>;
  getDaily(key: string, days: number): Promise<AwDaily>;
  getHourly(key: string, hours: number): Promise<AwHour[]>;
  getAlerts(key: string): Promise<AwAlert[]>;
};

type Log = { warn: (obj: object, msg: string) => void };

export type ClientOptions = {
  apiKey: string;
  authMode: 'query' | 'bearer';
  baseUrl: string;
  cache: Cache;
  log: Log;
  fetch?: typeof fetch;
};

function translate(status: number): UpstreamError {
  if (status === 401 || status === 403) {
    return new UpstreamError(502, "API key invalid or plan doesn't include this data", status);
  }
  if (status === 503 || status === 429)
    return new UpstreamError(503, 'Daily API limit reached', status);
  if (status === 400 || status === 404)
    return new UpstreamError(404, 'Location not found.', status);
  return new UpstreamError(502, `AccuWeather error (HTTP ${status}).`, status);
}

export function createAccuWeatherClient(opts: ClientOptions): AccuWeatherClient {
  const fetchImpl = opts.fetch ?? fetch;
  const inFlight = new Map<string, Promise<unknown>>();

  async function request<T>(path: string, params: Record<string, string>, ttl: number): Promise<T> {
    const query = new URLSearchParams({ language: 'en-us', ...params });
    const cacheKey = `${path}?${query}`;
    const hit = opts.cache.get(cacheKey);
    if (hit !== undefined) return hit as T;
    const pending = inFlight.get(cacheKey);
    if (pending) return pending as Promise<T>;

    if (!opts.apiKey) {
      throw new UpstreamError(503, 'AccuWeather API key is not configured on the server.');
    }
    const url = new URL(path, opts.baseUrl);
    url.search = query.toString();
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (opts.authMode === 'bearer') headers.Authorization = `Bearer ${opts.apiKey}`;
    else url.searchParams.set('apikey', opts.apiKey);

    const run = (async () => {
      let res: Response;
      try {
        res = await fetchImpl(url, { headers, signal: AbortSignal.timeout(10_000) });
      } catch {
        opts.log.warn({ path }, 'AccuWeather request failed');
        throw new UpstreamError(504, 'AccuWeather did not respond. Try again.');
      }
      if (!res.ok) {
        // Log the path and status only; never the URL (it may carry the key).
        opts.log.warn({ path, status: res.status }, 'AccuWeather error');
        throw translate(res.status);
      }
      const data = (await res.json()) as T & object;
      opts.cache.set(cacheKey, data, { ttl });
      return data;
    })();
    inFlight.set(cacheKey, run);
    try {
      return await run;
    } finally {
      inFlight.delete(cacheKey);
    }
  }

  const detailed = { details: 'true', metric: 'false' };

  return {
    async searchLocations(q) {
      const path = /\d/.test(q)
        ? '/locations/v1/postalcodes/search'
        : '/locations/v1/cities/autocomplete';
      let list = await request<AwLocation[]>(path, { q }, TTL.locations);
      if (!list.length)
        list = await request<AwLocation[]>('/locations/v1/cities/search', { q }, TTL.locations);
      return list.slice(0, 10);
    },
    getLocation: (key) =>
      request<AwLocation>(`/locations/v1/${encodeURIComponent(key)}`, {}, TTL.locations),
    getDaily: (key, days) =>
      request<AwDaily>(
        `/forecasts/v1/daily/${days}day/${encodeURIComponent(key)}`,
        detailed,
        TTL.daily,
      ),
    getHourly: (key, hours) =>
      request<AwHour[]>(
        `/forecasts/v1/hourly/${hours}hour/${encodeURIComponent(key)}`,
        detailed,
        TTL.hourly,
      ),
    getAlerts: (key) =>
      request<AwAlert[]>(`/alerts/v1/${encodeURIComponent(key)}`, { details: 'true' }, TTL.alerts),
  };
}
