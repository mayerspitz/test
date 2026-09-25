import { describe, expect, it } from 'vitest';
import type { PeriodData } from '../periods';
import { buildReport } from '../report';
import { buildWindSection } from '../wind';
import { countPdfPages, PdfTooLongError, renderReportPdf } from '../pdf/ReportPdf';
import { brooklyn } from './fixture';

describe('renderReportPdf', () => {
  it('renders the golden report on exactly one landscape Letter page', async () => {
    const report = buildReport(
      brooklyn.daily,
      brooklyn.hourly,
      brooklyn.alerts,
      brooklyn.location,
      brooklyn.range,
      { retrievedAt: brooklyn.retrievedAt },
    );
    const pdf = await renderReportPdf(report);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(countPdfPages(pdf)).toBe(1);
    // Landscape Letter: 792 × 612 pt.
    expect(pdf.toString('latin1')).toMatch(/\/MediaBox \[0 0 792 612\]/);
  });

  it('refuses to spill onto a second page', async () => {
    const report = buildReport(
      brooklyn.daily,
      brooklyn.hourly,
      brooklyn.alerts,
      brooklyn.location,
      brooklyn.range,
    );
    const many = Array.from({ length: 12 }, () => report.periods).flat();
    await expect(renderReportPdf({ ...report, periods: many })).rejects.toBeInstanceOf(
      PdfTooLongError,
    );
  });
});

describe('newly approved wind tiers still fit one page', () => {
  // Gale and Storm render a 6-row backyard table that used to be withheld (D-36). The owner's hard
  // requirement is one page WITH both sections, so check each at the length of a real
  // Fri-morning-to-Sun-night report rather than trusting the Windy golden case to cover them.
  const golden = () =>
    buildReport(
      brooklyn.daily,
      brooklyn.hourly,
      brooklyn.alerts,
      brooklyn.location,
      brooklyn.range,
      {
        retrievedAt: brooklyn.retrievedAt,
      },
    );

  for (const [name, gust] of [
    ['gale', 45],
    ['storm', 60],
  ] as const) {
    it(`${name} tier renders on exactly one landscape page`, async () => {
      const base = golden();
      const windPeriods: PeriodData[] = base.periods.map((period) => ({
        date: period.start.slice(0, 10),
        label: period.label,
        phrase: period.label,
        start: period.start,
        source: 'hourly',
        tempKind: 'plain',
        temp: 60,
        realFeel: 60,
        conditions: period.conditions,
        windDir: period.windDir,
        wind: Math.round(gust * 0.55),
        gust,
        rainChance: period.rainChance,
        rainAmount: period.rainAmount,
      }));
      const report = { ...base, wind: buildWindSection(windPeriods, base.units) };

      expect(report.wind.tier).toBe(name);
      expect(report.wind.rows).toHaveLength(6);
      expect(report.periods.length).toBeGreaterThanOrEqual(9);

      const pdf = await renderReportPdf(report);
      expect(countPdfPages(pdf)).toBe(1);
      expect(pdf.toString('latin1')).toMatch(/\/MediaBox \[0 0 792 612\]/);
    });
  }
});
