import rules from './wind-rules.json';
import type { PeriodData } from './periods';
import { dayOfWeek } from './range';

export type WindTier = 'calm' | 'breezy' | 'windy' | 'gale' | 'storm';
export type Units = 'imperial' | 'metric';

export type BackyardRow = {
  item: string;
  sustained: string;
  gusts: string;
  action: string;
  gustsBold: boolean;
};

export type TierRule = {
  id: WindTier;
  minGust: number; // mph
  beaufort: string;
  summary: string;
  approved: boolean;
  rows: BackyardRow[] | null;
};

export type WindSection = {
  maxSustained: number; // header value, rounded to the nearest 5
  gustLow: number; // header value, rounded down to 5
  gustHigh: number; // header value, rounded up to 5
  tier: WindTier;
  summary: string; // **bold** marks bold text
  rows: BackyardRow[] | null;
  ruleOfThumb: string | null; // **bold** marks bold text
};

export const WIND_TIERS = rules.tiers as TierRule[];

/** Gusts at or above this (mph) drive the rule of thumb and the summary days. */
export const GUSTY_MPH = 30;

export function tierForGust(gustMph: number): TierRule {
  let tier = WIND_TIERS[0]!;
  for (const t of WIND_TIERS) if (gustMph >= t.minGust) tier = t;
  return tier;
}

export function speed(mph: number, units: Units): number {
  return Math.round(units === 'metric' ? mph * 1.609344 : mph);
}

export function speedUnit(units: Units): string {
  return units === 'metric' ? 'km/h' : 'mph';
}

const round5 = (n: number) => Math.round(n / 5) * 5;
const floor5 = (n: number) => Math.floor(n / 5) * 5;
const ceil5 = (n: number) => Math.ceil(n / 5) * 5;

type DayWind = { date: string; wind: number; gust: number };

function byDay(periods: PeriodData[]): DayWind[] {
  const days: DayWind[] = [];
  for (const p of periods) {
    const last = days[days.length - 1];
    if (last && last.date === p.date) {
      last.wind = Math.max(last.wind, p.wind);
      last.gust = Math.max(last.gust, p.gust);
    } else {
      days.push({ date: p.date, wind: p.wind, gust: p.gust });
    }
  }
  return days;
}

export function buildWindSection(periods: PeriodData[], units: Units): WindSection {
  const maxGust = Math.max(0, ...periods.map((p) => p.gust));
  const maxWind = Math.max(0, ...periods.map((p) => p.wind));
  const tier = tierForGust(maxGust);
  const unit = speedUnit(units);
  const sp = (mph: number) => speed(mph, units);

  const days = byDay(periods);
  let listed = days.filter((d) => d.gust >= GUSTY_MPH);
  if (!listed.length && days.length) {
    listed = [days.reduce((a, b) => (b.gust > a.gust ? b : a))];
  }
  const dayParts = listed.map((d, i) =>
    i === 0
      ? `**${dayOfWeek(d.date)}:** ${sp(d.wind)} ${unit}, gusts ${sp(d.gust)}.`
      : `**${dayOfWeek(d.date)}:** gusts to ${sp(d.gust)}.`,
  );
  const summary = [...dayParts, tier.summary].join(' ');

  let ruleOfThumb: string | null = null;
  const gusty = periods.filter((p) => p.gust >= GUSTY_MPH);
  if (tier.id !== 'calm' && gusty.length) {
    const first = gusty[0]!.phrase;
    const last = gusty[gusty.length - 1]!.phrase;
    const weight = units === 'metric' ? '~9 kg' : '~20 lbs';
    ruleOfThumb =
      `secure anything that catches air or weighs under ${weight} **before ${first}**` +
      (last !== first ? `, through ${last}.` : '.');
  }

  const lowestListed = listed.length ? Math.min(...listed.map((d) => d.gust)) : maxGust;
  return {
    maxSustained: round5(sp(maxWind)),
    gustLow: floor5(sp(lowestListed)),
    gustHigh: ceil5(sp(maxGust)),
    tier: tier.id,
    summary,
    rows: tier.approved ? tier.rows : null,
    ruleOfThumb,
  };
}
