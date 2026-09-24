import { describe, expect, it } from 'vitest';
import type { AwDaily, AwHour } from '../accuweather';
import { buildPeriods } from '../periods';
import { slotsInRange } from '../range';
import { gapsSentence } from '../format';
import { buildReport, DAY_NIGHT_NOTE } from '../report';
import { brooklyn } from './fixture';

function hour(stamp: string, over: Partial<AwHour> = {}): AwHour {
  return {
    DateTime: `${stamp}:00-04:00`,
    IconPhrase: 'Sunny',
    HasPrecipitation: false,
    Temperature: { Value: 70 },
    RealFeelTemperature: { Value: 70 },
    Wind: { Speed: { Value: 5 }, Direction: { Localized: 'S' } },
    WindGust: { Speed: { Value: 10 } },
    PrecipitationProbability: 0,
    RainProbability: 0,
    Rain: { Value: 0 },
    ...over,
  };
}

function hoursFor(
  date: string,
  from: number,
  to: number,
  over: (h: number) => Partial<AwHour> = () => ({}),
) {
  const out: AwHour[] = [];
  for (let h = from; h < to; h++) {
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCHours(h);
    out.push(hour(d.toISOString().slice(0, 16), over(h)));
  }
  return out;
}

const emptyDaily: AwDaily = { DailyForecasts: [] };

describe('slotsInRange', () => {
  it('lists Fri Morning through Sun Night in order', () => {
    const slots = slotsInRange({ start: '2026-09-25T06:00', end: '2026-09-28T06:00' });
    expect(slots).toHaveLength(12);
    expect(slots[0]).toMatchObject({
      date: '2026-09-25',
      period: 'morning',
      start: '2026-09-25T06:00',
    });
    expect(slots[3]).toMatchObject({
      period: 'overnight',
      start: '2026-09-25T22:00',
      end: '2026-09-26T06:00',
    });
    expect(slots[11]).toMatchObject({ date: '2026-09-27', period: 'overnight' });
  });

  it('includes only periods inside the range', () => {
    const slots = slotsInRange({ start: '2026-09-25T12:00', end: '2026-09-25T22:00' });
    expect(slots.map((s) => s.period)).toEqual(['afternoon', 'evening']);
  });
});

describe('buildPeriods (hourly buckets)', () => {
  const range = { start: '2026-09-25T06:00', end: '2026-09-26T06:00' };

  it('buckets hours 06–11 / 12–16 / 17–21 / 22–05 and puts overnight on the day it starts', () => {
    const temps: Record<number, number> = {
      6: 50,
      11: 60,
      12: 61,
      16: 66,
      17: 64,
      21: 59,
      22: 58,
      26: 52,
      29: 55,
    };
    const hourly = hoursFor('2026-09-25', 6, 30, (h) => ({
      Temperature: { Value: temps[h] ?? 57 },
      RealFeelTemperature: { Value: (temps[h] ?? 57) - 2 },
    }));
    const { periods, gaps } = buildPeriods(emptyDaily, hourly, range);
    expect(gaps).toEqual([]);
    expect(periods.map((p) => [p.label, p.temp, p.tempKind])).toEqual([
      ['Fri AM', 60, 'plain'], // max
      ['Fri Afternoon', 66, 'plain'], // max
      ['Fri Evening', 64, 'plain'], // value at bucket start
      ['Fri Overnight', 52, 'Low'], // min, including hours after midnight
    ]);
  });

  it('picks conditions from the wettest hour, else the most frequent phrase', () => {
    const hourly = hoursFor('2026-09-25', 6, 30, (h) =>
      h === 13
        ? { IconPhrase: 'Showers', HasPrecipitation: true, PrecipitationProbability: 80 }
        : h === 14
          ? { IconPhrase: 'Cloudy', HasPrecipitation: true, PrecipitationProbability: 60 }
          : { IconPhrase: h % 2 ? 'Partly sunny' : 'Sunny' },
    );
    const { periods } = buildPeriods(emptyDaily, hourly, range);
    expect(periods[0]!.conditions).toBe('Sunny'); // 6,8,10 vs 7,9,11 → tie → first seen
    expect(periods[1]!.conditions).toBe('Showers');
  });

  it('aggregates wind, gusts, rain chance and rain amount', () => {
    const hourly = hoursFor('2026-09-25', 6, 30, (h) => ({
      Wind: { Speed: { Value: h === 7 ? 18 : 10 }, Direction: { Localized: h < 8 ? 'N' : 'SW' } },
      WindGust: { Speed: { Value: h === 9 ? 31 : 15 } },
      RainProbability: h === 10 ? 45 : 5,
      Rain: { Value: h >= 9 && h <= 10 ? 0.03 : 0 },
    }));
    const [am] = buildPeriods(emptyDaily, hourly, range).periods;
    expect(am).toMatchObject({
      wind: 18,
      windDir: 'SW',
      gust: 31,
      rainChance: 45,
      rainAmount: 0.06,
    });
    expect(am!.rainHours).toBeUndefined();
  });

  it('falls back to PrecipitationProbability and to null', () => {
    const hourly = hoursFor('2026-09-25', 6, 30, () => ({
      RainProbability: undefined,
      PrecipitationProbability: 20,
    }));
    expect(buildPeriods(emptyDaily, hourly, range).periods[0]!.rainChance).toBe(20);
    const bare = hoursFor('2026-09-25', 6, 30, () => ({
      RainProbability: undefined,
      PrecipitationProbability: undefined,
    }));
    expect(buildPeriods(emptyDaily, bare, range).periods[0]!.rainChance).toBeNull();
  });
});

describe('buildPeriods (daily fallback and gaps)', () => {
  it('uses Day/Night only when there is no hourly data', () => {
    const { periods, gaps } = buildPeriods(brooklyn.daily, null, brooklyn.range);
    expect(periods.map((p) => p.label)).toEqual([
      'Fri Day',
      'Fri Overnight',
      'Sat Day',
      'Sat Overnight',
    ]);
    expect(gaps.map((g) => `${g.date} ${g.period}`)).toEqual([
      '2026-09-27 morning',
      '2026-09-27 afternoon',
      '2026-09-27 evening',
      '2026-09-27 overnight',
    ]);
  });

  it('never invents missing periods and explains them', () => {
    const report = buildReport(brooklyn.daily, null, null, brooklyn.location, brooklyn.range);
    expect(report.dataGaps).toEqual(['Sun morning/afternoon/evening/night']);
    expect(report.notes).toEqual([DAY_NIGHT_NOTE]);
    expect(report.alertsAvailable).toBe(false);
  });

  it('switches to Day/Night where the hourly forecast ends', () => {
    // Hourly ends Fri 20:00, so Fri Evening (ends 21:59) falls back to the Night half.
    const hourly = hoursFor('2026-09-25', 6, 21);
    const { periods } = buildPeriods(brooklyn.daily, hourly, {
      start: '2026-09-25T06:00',
      end: '2026-09-26T12:00',
    });
    expect(periods.map((p) => [p.label, p.source])).toEqual([
      ['Fri AM', 'hourly'],
      ['Fri Afternoon', 'hourly'],
      ['Fri Overnight', 'night'],
      ['Sat Day', 'day'],
    ]);
  });

  it('uses the remaining hours of a period already under way', () => {
    const hourly = hoursFor('2026-09-25', 14, 30);
    const { periods } = buildPeriods(brooklyn.daily, hourly, {
      start: '2026-09-25T12:00',
      end: '2026-09-25T22:00',
    });
    expect(periods.map((p) => [p.label, p.source])).toEqual([
      ['Fri Afternoon', 'hourly'],
      ['Fri Evening', 'hourly'],
    ]);
  });
});

describe('gapsSentence', () => {
  it('matches the approved note style', () => {
    expect(gapsSentence(['Sat morning', 'Sun morning/night'])).toBe(
      'Sat morning and Sun morning/night were not available from the forecast.',
    );
    expect(gapsSentence(['Sat morning'])).toBe('Sat morning was not available from the forecast.');
    expect(gapsSentence([])).toBe('');
  });
});
