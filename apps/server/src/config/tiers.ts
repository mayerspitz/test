/**
 * AccuWeather plan → capabilities.
 *
 * Sources:
 *  - AccuWeather Core Weather packages (developer.accuweather.com/packages), checked Sep 24, 2026.
 *  - The owner's own developer-portal screenshots (Sep 24, 2026), which document the trial exactly.
 *
 *   trial       $0        14 days, 500 calls/day, **Elite-level** Core Weather:
 *                         15-day daily, 120-hour hourly, severe weather alerts, imagery.
 *   starter     $2/mo     15,000 calls/mo      Current Conditions, 12-hour hourly, 5-day daily
 *   standard    $25/mo    225,000 calls/mo     12-hour hourly, 5-day daily, 5-day indices
 *   prime       $250/mo   1,800,000 calls/mo   72-hour hourly, 10-day daily, Alerts, Tropical, Imagery
 *   elite       $500/mo   2,400,000 calls/mo   120-hour hourly, 15-day daily, 15-day indices, Alerts
 *
 * `free` is kept as the safe floor (what a non-trial, unpaid key can be assumed to reach) and is the
 * default, so a misconfigured deployment under-asks rather than failing. When the trial lapses,
 * move the deployment to the plan that was bought. See docs/DECISIONS.md #D-21.
 *
 * Re-check the pricing page before changing plans; AccuWeather revises packages without notice.
 */
import type { Capabilities as SharedCapabilities } from '@windwise/shared';

export const TIER_NAMES = ['free', 'trial', 'starter', 'standard', 'prime', 'elite'] as const;
export type TierName = (typeof TIER_NAMES)[number];

export type Tier = {
  maxDailyDays: 1 | 5 | 10 | 15;
  maxHourlyHours: 12 | 72 | 120;
  alerts: boolean;
};

export const TIERS: Record<TierName, Tier> = {
  free: { maxDailyDays: 5, maxHourlyHours: 12, alerts: false },
  trial: { maxDailyDays: 15, maxHourlyHours: 120, alerts: true },
  starter: { maxDailyDays: 5, maxHourlyHours: 12, alerts: false },
  standard: { maxDailyDays: 5, maxHourlyHours: 12, alerts: false },
  prime: { maxDailyDays: 10, maxHourlyHours: 72, alerts: true },
  elite: { maxDailyDays: 15, maxHourlyHours: 120, alerts: true },
};

/**
 * Daily windows AccuWeather publishes, widest first. If the configured tier asks for more than the
 * key actually allows, the report service walks down this ladder instead of failing outright.
 */
export const DAILY_WINDOWS = [15, 10, 5, 1] as const;

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
