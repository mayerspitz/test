import { describe, expect, it } from 'vitest';
import {
  backyardCells,
  backyardColumns,
  buildReport,
  DAY_COLUMNS,
  infoItems,
  pdfFilename,
  periodCells,
  reportTitle,
} from '../index';
import { brooklyn } from './fixture';

const report = buildReport(
  brooklyn.daily,
  brooklyn.hourly,
  brooklyn.alerts,
  brooklyn.location,
  brooklyn.range,
  { retrievedAt: brooklyn.retrievedAt },
);

// Handoff §2.1, the approved Day-by-Day table.
const APPROVED_DAY_ROWS = [
  ['Fri AM', 'Rising to upper 60s', 'Some sun, clouds building', 'NNE 20 / 35', 'Low', '0.00"'],
  ['Fri Afternoon', '69° (68°)', 'Mostly cloudy, windy', 'NNE 20 / 35', '25%', '0.00"'],
  [
    'Fri Evening',
    '62° (56°)',
    'Mostly cloudy, breezy, a little rain',
    'NNE 15 / 28',
    '55%',
    '0.02"',
  ],
  [
    'Fri Overnight',
    'Low 58° (51°)',
    'Mostly cloudy, touch of rain',
    'N 15 / 28',
    '55%',
    '0.04" night (~2 hrs)',
  ],
  [
    'Sat Day',
    'High 69° (66°)',
    'Cloudy and windy, a bit of rain',
    'N 20 / 38',
    '55%',
    '0.04" (~1.5 hrs)',
  ],
  ['Sat Evening', '58° (47°)', 'Windy with periods of rain', 'WNW 21 / 32', '70%', '0.12"'],
  [
    'Sat Overnight',
    'Low 57° (47°)',
    'Windy, periods of rain; ponding on roads',
    'NNW 20 / 32',
    '91%',
    '0.24" night (~3 hrs)',
  ],
  ['Sun Afternoon', '66° (62°)', 'Cloudy, breezy, a little rain', 'NNW 15 / 28', '55%', '0.02"'],
  ['Sun Evening', '60° (56°)', 'Mostly cloudy, chance of rain', 'NNW 13 / 22', '35%', '0.00"'],
];

// Handoff §2.2, the approved backyard table (Windy tier), character for character.
const APPROVED_BACKYARD_ROWS = [
  [
    'Patio umbrella, pop-up canopy',
    'Strains, pulls on base/legs',
    'Tips, flips, or launches',
    'Close and strap, or take down',
  ],
  [
    'Sukkah',
    'Walls billow, schach shifts',
    'Walls act like sails; schach blows off',
    'Anchor frame, tie walls, secure schach',
  ],
  [
    'Light chairs, cushions, toys, pots',
    'Slide or wobble',
    'Blow away or tip',
    'Bring in or group against a wall',
  ],
  [
    'Trash bins, grill cover',
    'Lids and cover flap',
    'Tip over / blow off',
    'Weight bins; remove cover',
  ],
  ['Trampoline', 'Can shift', 'Can lift and flip', 'Stake down or flip over'],
  [
    'Trees, fence, shed',
    'Sway / fine',
    'Twigs drop; loose panels rattle',
    'Secure loose panels; avoid parking under dead limbs',
  ],
];
const APPROVED_BOLD = [true, true, true, false, true, false];

describe('golden fixture: Brooklyn, Sep 25–27', () => {
  it('uses the approved Day-by-Day columns in order', () => {
    expect([...DAY_COLUMNS]).toEqual([
      'Day / Period',
      'Temp (RealFeel)',
      'Conditions',
      'Wind / Gusts',
      'Rain chance',
      'Rain amount',
    ]);
  });

  it('produces the approved period rows', () => {
    const rows = report.periods.map((p) => periodCells(p, 'imperial'));
    expect(rows.map((r) => r[0])).toEqual(APPROVED_DAY_ROWS.map((r) => r[0]));
    // Rows 2–9 match §2.1 exactly.
    expect(rows.slice(1)).toEqual(APPROVED_DAY_ROWS.slice(1));
  });

  it('builds Fri AM with the §5 rules (§2.1 shows hand-written "Rising to upper 60s" / "Low")', () => {
    const [label, temp, conditions, wind, chance, amount] = periodCells(
      report.periods[0]!,
      'imperial',
    );
    expect([label, conditions, wind, amount]).toEqual([
      'Fri AM',
      'Some sun, clouds building',
      'NNE 20 / 35',
      '0.00"',
    ]);
    expect(temp).toBe('68° (66°)'); // max temp (max RealFeel) for Morning
    expect(chance).toBe('10%'); // max RainProbability
  });

  it('matches the approved Windy backyard table character for character', () => {
    expect(report.wind.tier).toBe('windy');
    expect(report.wind.rows!.map(backyardCells)).toEqual(APPROVED_BACKYARD_ROWS);
    expect(report.wind.rows!.map((r) => r.gustsBold)).toEqual(APPROVED_BOLD);
  });

  it('keeps all 4 backyard columns with dynamic headers', () => {
    expect(backyardColumns(report)).toEqual([
      'Item',
      'At 20 mph (sustained)',
      'At 35–40 mph (gusts)',
      'Action',
    ]);
  });

  it('writes the wind summary and rule of thumb', () => {
    expect(report.wind.summary).toBe(
      '**Fri:** 20 mph, gusts 35. **Sat:** gusts to 38. Moves anything light or loose, not damaging-storm level.',
    );
    expect(report.wind.ruleOfThumb).toBe(
      'secure anything that catches air or weighs under ~20 lbs **before Fri morning**, through Sat overnight.',
    );
  });

  it('fills the alerts line', () => {
    expect(report.worstWindow).toBe('Sat evening–overnight (rain + wind)');
    expect(report.dataGaps).toEqual(['Sun morning/night']);
    expect(infoItems(report)).toEqual([
      {
        label: 'Alerts',
        text: 'Coastal Flood Advisory (Sat 6 PM–Sun 6 AM); Rip Current Statement (Fri 6 AM–Sun 8 PM)',
      },
      { label: 'Sunrise/Sunset', text: 'Fri 6:49 AM / 6:52 PM; Sat 6:50 AM / 6:50 PM' },
      { label: 'Worst window', text: 'Sat evening–overnight (rain + wind)' },
      { label: 'Data gaps', text: 'Sun morning/night were not available from the forecast.' },
      { label: 'Note', text: 'Period detail limited by API plan; showing Day/Night.' },
    ]);
  });

  it('fills the header, source and file name', () => {
    expect(reportTitle(report)).toBe('Brooklyn, NY — Weather, Fri Sep 25 – Sun Sep 27, 2026');
    expect(report.story).toBe('Windy with periods of rain Saturday night; breezy Sunday');
    expect(report.source).toBe('AccuWeather, Brooklyn, NY, retrieved Sep 24, 2026.');
    expect(pdfFilename(report)).toBe('Brooklyn_Weather_Sep25-Sep27.pdf');
  });

  it('converts to metric', () => {
    const metric = buildReport(
      brooklyn.daily,
      brooklyn.hourly,
      brooklyn.alerts,
      brooklyn.location,
      brooklyn.range,
      { units: 'metric', retrievedAt: brooklyn.retrievedAt },
    );
    expect(periodCells(metric.periods[1]!, 'metric')).toEqual([
      'Fri Afternoon',
      '21° (20°)',
      'Mostly cloudy, windy',
      'NNE 32 / 56',
      '25%',
      '0.0 mm',
    ]);
    expect(periodCells(metric.periods[6]!, 'metric')[5]).toBe('6.1 mm night (~3 hrs)');
    expect(metric.wind.tier).toBe('windy');
    expect(backyardColumns(metric)[1]).toBe('At 35 km/h (sustained)');
  });
});
