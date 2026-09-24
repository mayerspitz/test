import { describe, expect, it } from 'vitest';
import { buildReport } from '../report';
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
