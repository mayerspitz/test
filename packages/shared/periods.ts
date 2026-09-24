import type { AwDaily, AwDailyForecast, AwHour } from './accuweather';
import {
  dayOfWeek,
  localStamp,
  slotHours,
  slotsInRange,
  type PeriodKey,
  type Range,
  type Slot,
} from './range';

export type PeriodSource = 'hourly' | 'day' | 'night';
export type TempKind = 'plain' | 'High' | 'Low';

/** One table row before unit conversion (°F, mph, inches). */
export type PeriodData = {
  date: string;
  label: string; // "Fri Afternoon"
  phrase: string; // "Fri afternoon" (for sentences)
  start: string;
  source: PeriodSource;
  tempKind: TempKind;
  temp: number;
  realFeel: number;
  conditions: string;
  windDir: string;
  wind: number;
  gust: number;
  rainChance: number | null;
  rainAmount: number;
  rainHours?: number;
};

export type BuiltPeriods = { periods: PeriodData[]; gaps: Slot[] };

const HOURLY_LABEL: Record<PeriodKey, string> = {
  morning: 'AM',
  afternoon: 'Afternoon',
  evening: 'Evening',
  overnight: 'Overnight',
};

/** Names used in the data-gaps note. */
export const GAP_NAME: Record<PeriodKey, string> = {
  morning: 'morning',
  afternoon: 'afternoon',
  evening: 'evening',
  overnight: 'night',
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Most frequent value; ties go to the first one seen. */
function mostFrequent(values: string[]): string {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best = '';
  let bestCount = 0;
  for (const [v, c] of counts) {
    if (c > bestCount) {
      best = v;
      bestCount = c;
    }
  }
  return best;
}

function tempFor(period: PeriodKey, values: number[]): number {
  if (period === 'evening') return values[0]!;
  if (period === 'overnight') return Math.min(...values);
  return Math.max(...values);
}

function conditionsFor(hours: AwHour[]): string {
  if (hours.some((h) => h.HasPrecipitation)) {
    let best = hours[0]!;
    for (const h of hours) {
      if ((h.PrecipitationProbability ?? 0) > (best.PrecipitationProbability ?? 0)) best = h;
    }
    return best.IconPhrase;
  }
  return mostFrequent(hours.map((h) => h.IconPhrase));
}

function fromHours(slot: Slot, hours: AwHour[]): PeriodData {
  const dow = dayOfWeek(slot.date);
  const chances = hours
    .map((h) => h.RainProbability ?? h.PrecipitationProbability)
    .filter((v): v is number => typeof v === 'number');
  return {
    date: slot.date,
    label: `${dow} ${HOURLY_LABEL[slot.period]}`,
    phrase: `${dow} ${slot.period}`,
    start: slot.start,
    source: 'hourly',
    tempKind: slot.period === 'overnight' ? 'Low' : 'plain',
    temp: tempFor(
      slot.period,
      hours.map((h) => h.Temperature.Value),
    ),
    realFeel: tempFor(
      slot.period,
      hours.map((h) => h.RealFeelTemperature.Value),
    ),
    conditions: conditionsFor(hours),
    windDir: mostFrequent(hours.map((h) => h.Wind.Direction?.Localized ?? '')),
    wind: Math.max(...hours.map((h) => h.Wind.Speed.Value)),
    gust: Math.max(...hours.map((h) => h.WindGust.Speed.Value)),
    rainChance: chances.length ? Math.max(...chances) : null,
    rainAmount: round2(hours.reduce((sum, h) => sum + (h.Rain?.Value ?? 0), 0)),
  };
}

function fromDaily(slot: Slot, f: AwDailyForecast, half: 'day' | 'night'): PeriodData {
  const dow = dayOfWeek(slot.date);
  const hd = half === 'day' ? f.Day : f.Night;
  const isDay = half === 'day';
  return {
    date: slot.date,
    label: `${dow} ${isDay ? 'Day' : 'Overnight'}`,
    phrase: `${dow} ${isDay ? 'day' : 'overnight'}`,
    start: slot.start,
    source: half,
    tempKind: isDay ? 'High' : 'Low',
    temp: isDay ? f.Temperature.Maximum.Value : f.Temperature.Minimum.Value,
    realFeel: isDay ? f.RealFeelTemperature.Maximum.Value : f.RealFeelTemperature.Minimum.Value,
    conditions: hd.LongPhrase || hd.ShortPhrase || hd.IconPhrase || '',
    windDir: hd.Wind.Direction?.Localized ?? '',
    wind: hd.Wind.Speed.Value,
    gust: hd.WindGust.Speed.Value,
    rainChance: hd.RainProbability ?? hd.PrecipitationProbability ?? null,
    rainAmount: round2(hd.Rain?.Value ?? 0),
    rainHours: hd.HoursOfRain ?? 0,
  };
}

/**
 * Builds the rows for a range.
 * - A period uses hourly data when the hourly forecast reaches the period's last hour
 *   (so a period already under way uses its remaining hours).
 * - Otherwise it falls back to the daily Day (morning/afternoon) or Night (evening/overnight)
 *   half; consecutive periods that map to the same half become one row.
 * - With neither, the period is omitted and reported as a data gap. Nothing is invented.
 */
export function buildPeriods(daily: AwDaily, hourly: AwHour[] | null, range: Range): BuiltPeriods {
  const hourMap = new Map<string, AwHour>();
  for (const h of hourly ?? []) hourMap.set(localStamp(h.DateTime).slice(0, 13), h);
  const dailyMap = new Map<string, AwDailyForecast>();
  for (const f of daily.DailyForecasts) dailyMap.set(f.Date.slice(0, 10), f);

  const periods: PeriodData[] = [];
  const gaps: Slot[] = [];
  for (const slot of slotsInRange(range)) {
    const stamps = slotHours(slot);
    const lastHour = stamps[stamps.length - 1]!.slice(0, 13);
    if (hourMap.has(lastHour)) {
      const hours = stamps.map((s) => hourMap.get(s.slice(0, 13))).filter((h): h is AwHour => !!h);
      periods.push(fromHours(slot, hours));
      continue;
    }
    const half = slot.period === 'morning' || slot.period === 'afternoon' ? 'day' : 'night';
    const f = dailyMap.get(slot.date);
    if (!f) {
      gaps.push(slot);
      continue;
    }
    const prev = periods[periods.length - 1];
    if (prev && prev.source === half && prev.date === slot.date) continue;
    periods.push(fromDaily(slot, f, half));
  }
  return { periods, gaps };
}
