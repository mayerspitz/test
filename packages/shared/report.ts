import type { AwAlert, AwDaily, AwDailyForecast, AwHour, AwLocation } from './accuweather';
import { buildPeriods, GAP_NAME, type PeriodData, type PeriodSource } from './periods';
import { clockTime, dayOfWeek, slotsInRange, type Range, type Slot } from './range';
import { buildWindSection, speed, GUSTY_MPH, type Units, type WindSection } from './wind';

export type { Units } from './wind';

export type Period = {
  label: string; // "Fri Afternoon"
  start: string; // local "YYYY-MM-DDTHH:mm"
  temp: string; // "69° (68°)" | "Low 58° (51°)"
  conditions: string;
  windDir: string; // "NNE"
  wind: number; // mph or km/h
  gust: number; // mph or km/h
  rainChance: number | null; // %
  rainAmount: number; // inches or mm
  rainHours?: number;
  source: PeriodSource; // hourly buckets, or the daily Day / Night fallback
};

export type Alert = { name: string; start: string; end: string; area?: string };

export type ReportLocation = {
  key: string;
  name: string;
  admin: string;
  country: string;
  tz: string;
};

export type Report = {
  location: ReportLocation;
  range: Range;
  story: string; // one line; from daily Headline.Text, trimmed
  periods: Period[];
  alerts: Alert[];
  alertsAvailable: boolean; // false when the API plan has no alerts
  sun: { date: string; day: string; rise: string; set: string }[]; // per day
  worstWindow: string; // "" when nothing stands out
  dataGaps: string[]; // omitted periods, grouped by day: "Sun morning/night"
  notes: string[];
  wind: WindSection;
  source: string; // "AccuWeather, {Location}, retrieved {date}."
  units: Units;
};

export type BuildOptions = { units?: Units; retrievedAt?: Date };

export const DAY_NIGHT_NOTE = 'Period detail limited by API plan; showing Day/Night.';

export function mapLocation(loc: AwLocation): ReportLocation {
  const country = loc.Country?.ID ?? '';
  const northAmerica = country === 'US' || country === 'CA';
  return {
    key: loc.Key,
    name: loc.LocalizedName,
    admin:
      (northAmerica ? loc.AdministrativeArea?.ID : loc.AdministrativeArea?.LocalizedName) ?? '',
    country,
    tz: loc.TimeZone?.Name ?? 'UTC',
  };
}

/** "Brooklyn, NY" in the US and Canada; "Paris, FR" elsewhere. */
export function locationLabel(l: Pick<ReportLocation, 'name' | 'admin' | 'country'>): string {
  const region = l.country === 'US' || l.country === 'CA' ? l.admin : l.country;
  return region ? `${l.name}, ${region}` : l.name;
}

function retrievedDate(date: Date, tz: string): string {
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
  try {
    return new Intl.DateTimeFormat('en-US', { ...opts, timeZone: tz }).format(date);
  } catch {
    return new Intl.DateTimeFormat('en-US', { ...opts, timeZone: 'UTC' }).format(date);
  }
}

/** The consecutive periods with the highest rain chance × gust, e.g. "Sat evening–overnight (rain + wind)". */
export function worstWindow(periods: PeriodData[]): string {
  const score = (p: PeriodData) => ((p.rainChance ?? 0) / 100) * p.gust;
  let top = -1;
  let topScore = 0;
  periods.forEach((p, i) => {
    if (score(p) > topScore) {
      top = i;
      topScore = score(p);
    }
  });
  if (top < 0) return '';

  let from = top;
  let to = top;
  const prev = periods[top - 1];
  const next = periods[top + 1];
  const neighbor = prev && (!next || score(prev) >= score(next)) ? top - 1 : next ? top + 1 : -1;
  if (neighbor >= 0 && score(periods[neighbor]!) >= topScore / 2) {
    from = Math.min(top, neighbor);
    to = Math.max(top, neighbor);
  }

  const a = periods[from]!;
  const b = periods[to]!;
  const [aDow, aName] = a.phrase.split(' ');
  const [bDow, bName] = b.phrase.split(' ');
  let when = a.phrase;
  if (from !== to)
    when = aDow === bDow ? `${aDow} ${aName}–${bName}` : `${a.phrase}–${bDow} ${bName}`;

  const span = periods.slice(from, to + 1);
  const rain = span.some((p) => (p.rainChance ?? 0) >= 50);
  const wind = span.some((p) => p.gust >= GUSTY_MPH);
  const tag = rain && wind ? ' (rain + wind)' : rain ? ' (rain)' : wind ? ' (wind)' : '';
  return when + tag;
}

/** Groups missing periods by day: ["Sat morning", "Sun morning/night"]. */
export function groupGaps(gaps: Slot[]): string[] {
  const out: { date: string; names: string[] }[] = [];
  for (const g of gaps) {
    const last = out[out.length - 1];
    if (last && last.date === g.date) last.names.push(GAP_NAME[g.period]);
    else out.push({ date: g.date, names: [GAP_NAME[g.period]] });
  }
  return out.map((d) => `${dayOfWeek(d.date)} ${d.names.join('/')}`);
}

function toPeriod(d: PeriodData, units: Units): Period {
  const t = (f: number) => Math.round(units === 'metric' ? ((f - 32) * 5) / 9 : f);
  const prefix = d.tempKind === 'plain' ? '' : `${d.tempKind} `;
  const rain = units === 'metric' ? Math.round(d.rainAmount * 25.4 * 10) / 10 : d.rainAmount;
  const period: Period = {
    label: d.label,
    start: d.start,
    temp: `${prefix}${t(d.temp)}° (${t(d.realFeel)}°)`,
    conditions: d.conditions,
    windDir: d.windDir,
    wind: speed(d.wind, units),
    gust: speed(d.gust, units),
    rainChance: d.rainChance,
    rainAmount: rain,
    source: d.source,
  };
  if (d.rainHours !== undefined) period.rainHours = d.rainHours;
  return period;
}

function mapAlerts(raw: AwAlert[]): Report['alerts'] {
  const seen = new Set<string>();
  const out: Report['alerts'] = [];
  for (const a of raw) {
    const area = a.Area?.[0];
    const alert: Alert = {
      name: a.Description?.Localized ?? a.Description?.English ?? 'Weather alert',
      start: area?.StartTime ?? '',
      end: area?.EndTime ?? '',
    };
    if (area?.Name) alert.area = area.Name;
    const key = `${alert.name}|${alert.start}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(alert);
  }
  return out;
}

/**
 * Pure report builder. `rawHourly` is null when the API plan has no usable hourly data;
 * `rawAlerts` is null when the plan has no alerts. Inputs are AccuWeather imperial units.
 */
export function buildReport(
  rawDaily: AwDaily,
  rawHourly: AwHour[] | null,
  rawAlerts: AwAlert[] | null,
  rawLocation: AwLocation,
  range: Range,
  options: BuildOptions = {},
): Report {
  const units = options.units ?? 'imperial';
  const location = mapLocation(rawLocation);
  const { periods, gaps } = buildPeriods(rawDaily, rawHourly, range);

  const dailyMap = new Map<string, AwDailyForecast>();
  for (const f of rawDaily.DailyForecasts) dailyMap.set(f.Date.slice(0, 10), f);
  const dates = [...new Set(slotsInRange(range).map((s) => s.date))];
  const sun: Report['sun'] = [];
  for (const date of dates) {
    const s = dailyMap.get(date)?.Sun;
    if (s?.Rise && s?.Set) {
      sun.push({ date, day: dayOfWeek(date), rise: clockTime(s.Rise), set: clockTime(s.Set) });
    }
  }

  const notes = periods.some((p) => p.source !== 'hourly') ? [DAY_NIGHT_NOTE] : [];
  const retrieved = retrievedDate(options.retrievedAt ?? new Date(), location.tz);

  return {
    location,
    range,
    story: (rawDaily.Headline?.Text ?? '').trim(),
    periods: periods.map((p) => toPeriod(p, units)),
    alerts: rawAlerts ? mapAlerts(rawAlerts) : [],
    alertsAvailable: rawAlerts !== null,
    sun,
    worstWindow: worstWindow(periods),
    dataGaps: groupGaps(gaps),
    notes,
    wind: buildWindSection(periods, units),
    source: `AccuWeather, ${locationLabel(location)}, retrieved ${retrieved}.`,
    units,
  };
}
