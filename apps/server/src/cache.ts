import { LRUCache } from 'lru-cache';

const MINUTE = 60_000;

/** Cache lifetimes per AccuWeather data type. */
export const TTL = {
  locations: 24 * 60 * MINUTE,
  daily: 60 * MINUTE,
  hourly: 30 * MINUTE,
  alerts: 10 * MINUTE,
} as const;

export type Cache = LRUCache<string, object>;

export function createCache(): Cache {
  return new LRUCache<string, object>({ max: 1000 });
}
