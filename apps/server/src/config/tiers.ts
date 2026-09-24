/**
 * AccuWeather plan → capabilities.
 *
 * Source: AccuWeather Core Weather packages (developer.accuweather.com/packages), checked Sep 24, 2026:
 *   Free trial  $0        14 days, 500 calls/day, Core Weather endpoints for evaluation
 *   Starter     $2/mo     15,000 calls/mo      Current Conditions, 12-hour hourly, 5-day daily
 *   Standard    $25/mo    225,000 calls/mo     12-hour hourly, 5-day daily, 5-day indices
 *   Prime       $250/mo   1,800,000 calls/mo   72-hour hourly, 10-day daily, Alerts, Tropical, Imagery
 *   Elite       $500/mo   2,400,000 calls/mo   120-hour hourly, 15-day daily, 15-day indices, Alerts, Tropical, Imagery
 *
 * The free trial is mapped to Starter limits (the plan it converts to). Re-check the pricing page
 * before changing plans; AccuWeather revises packages without notice.
 */
import type { Capabilities as SharedCapabilities } from '@windwise/shared';

export const TIER_NAMES = ['free', 'starter', 'standard', 'prime', 'elite'] as const;
export type TierName = (typeof TIER_NAMES)[number];

export type Tier = {
  maxDailyDays: 5 | 10 | 15;
  maxHourlyHours: 12 | 72 | 120;
  alerts: boolean;
};

export const TIERS: Record<TierName, Tier> = {
  free: { maxDailyDays: 5, maxHourlyHours: 12, alerts: false },
  starter: { maxDailyDays: 5, maxHourlyHours: 12, alerts: false },
  standard: { maxDailyDays: 5, maxHourlyHours: 12, alerts: false },
  prime: { maxDailyDays: 10, maxHourlyHours: 72, alerts: true },
  elite: { maxDailyDays: 15, maxHourlyHours: 120, alerts: true },
};

/** Hourly data is used for Morning/Afternoon/Evening/Overnight only when it spans a multi-day range. */
export const MIN_HOURLY_FOR_PERIODS = 72;

export type Capabilities = SharedCapabilities & { tier: TierName };

export function capabilitiesFor(tier: TierName): Capabilities {
  const t = TIERS[tier];
  return {
    tier,
    maxDailyDays: t.maxDailyDays,
    maxHourlyHours: t.maxHourlyHours,
    periodsMode: t.maxHourlyHours >= MIN_HOURLY_FOR_PERIODS ? '4-period' : 'day-night',
  };
}
