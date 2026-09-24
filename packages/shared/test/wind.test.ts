import { describe, expect, it } from 'vitest';
import type { PeriodData } from '../periods';
import { buildWindSection, tierForGust, WIND_TIERS } from '../wind';

function p(date: string, name: string, wind: number, gust: number): PeriodData {
  return {
    date,
    label: name,
    phrase: name,
    start: `${date}T06:00`,
    source: 'hourly',
    tempKind: 'plain',
    temp: 60,
    realFeel: 60,
    conditions: '',
    windDir: 'N',
    wind,
    gust,
    rainChance: 0,
    rainAmount: 0,
  };
}

describe('tierForGust', () => {
  it.each([
    [0, 'calm'],
    [19, 'calm'],
    [20, 'breezy'],
    [29, 'breezy'],
    [30, 'windy'],
    [39, 'windy'],
    [40, 'gale'],
    [54, 'gale'],
    [55, 'storm'],
    [80, 'storm'],
  ])('%i mph gusts → %s', (gust, tier) => {
    expect(tierForGust(gust).id).toBe(tier);
  });

  it('has 6 rows × 4 columns for every tier with a table', () => {
    for (const t of WIND_TIERS) {
      if (t.id === 'calm') {
        expect(t.rows).toBeNull();
        continue;
      }
      expect(t.rows).toHaveLength(6);
      expect(t.rows!.map((r) => r.item)).toEqual([
        'Patio umbrella, pop-up canopy',
        'Sukkah',
        'Light chairs, cushions, toys, pots',
        'Trash bins, grill cover',
        'Trampoline',
        'Trees, fence, shed',
      ]);
    }
  });

  it('only Windy is approved among the tables (drafts await owner approval)', () => {
    expect(WIND_TIERS.filter((t) => t.approved && t.rows).map((t) => t.id)).toEqual(['windy']);
  });
});

describe('buildWindSection', () => {
  it('Calm: one line, no table, no rule of thumb', () => {
    const w = buildWindSection([p('2026-09-25', 'Fri morning', 8, 15)], 'imperial');
    expect(w.tier).toBe('calm');
    expect(w.rows).toBeNull();
    expect(w.ruleOfThumb).toBeNull();
    expect(w.summary).toBe('**Fri:** 8 mph, gusts 15. Light wind. No backyard prep needed.');
  });

  it('Breezy: summary shown, draft table withheld until approved', () => {
    const w = buildWindSection([p('2026-09-25', 'Fri morning', 14, 25)], 'imperial');
    expect(w.tier).toBe('breezy');
    expect(w.rows).toBeNull();
    expect(w.ruleOfThumb).toBeNull(); // no period reaches 30 mph gusts
  });

  it('Gale: rule of thumb names the first and last gusty periods', () => {
    const w = buildWindSection(
      [
        p('2026-09-25', 'Fri evening', 20, 28),
        p('2026-09-25', 'Fri overnight', 25, 44),
        p('2026-09-26', 'Sat day', 30, 52),
        p('2026-09-26', 'Sat overnight', 15, 22),
      ],
      'imperial',
    );
    expect(w.tier).toBe('gale');
    expect(w.summary).toBe(
      '**Fri:** 25 mph, gusts 44. **Sat:** gusts to 52. Damaging gusts possible. Secure everything loose; small limbs may fall.',
    );
    expect(w.ruleOfThumb).toBe(
      'secure anything that catches air or weighs under ~20 lbs **before Fri overnight**, through Sat day.',
    );
    expect([w.maxSustained, w.gustLow, w.gustHigh]).toEqual([30, 40, 55]);
  });

  it('single gusty period: no "through" clause', () => {
    const w = buildWindSection([p('2026-09-25', 'Fri evening', 20, 33)], 'imperial');
    expect(w.ruleOfThumb).toBe(
      'secure anything that catches air or weighs under ~20 lbs **before Fri evening**.',
    );
  });
});
