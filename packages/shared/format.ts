// Display helpers shared by the HTML preview and the PDF, so both render identical text.
import type { Period, Report, Units } from './report';
import { locationLabel } from './report';
import { clockTime, dayOfWeek, monthDay, slotsInRange } from './range';
import { speedUnit, type BackyardRow } from './wind';

export const DAY_COLUMNS = [
  'Day / Period',
  'Temp (RealFeel)',
  'Conditions',
  'Wind / Gusts',
  'Rain chance',
  'Rain amount',
] as const;

export function fmtRainAmount(p: Period, units: Units): string {
  const amount =
    units === 'metric' ? `${p.rainAmount.toFixed(1)} mm` : `${p.rainAmount.toFixed(2)}"`;
  if (!p.rainHours) return amount;
  const hours = Number(p.rainHours.toFixed(1));
  return `${amount}${p.source === 'night' ? ' night' : ''} (~${hours} hrs)`;
}

export function periodCells(p: Period, units: Units): string[] {
  return [
    p.label,
    p.temp,
    p.conditions,
    `${p.windDir} ${p.wind} / ${p.gust}`.trim(),
    p.rainChance === null ? '—' : `${p.rainChance}%`,
    fmtRainAmount(p, units),
  ];
}

export function backyardColumns(report: Report): string[] {
  const { maxSustained, gustLow, gustHigh } = report.wind;
  const unit = speedUnit(report.units);
  const gusts = gustLow === gustHigh ? `${gustHigh}` : `${gustLow}–${gustHigh}`;
  return [
    'Item',
    `At ${maxSustained} ${unit} (sustained)`,
    `At ${gusts} ${unit} (gusts)`,
    'Action',
  ];
}

export function backyardCells(row: BackyardRow): string[] {
  return [row.item, row.sustained, row.gusts, row.action];
}

/** Index of the backyard column rendered bold when a row is high-risk. */
export const BACKYARD_BOLD_COLUMN = 2;

export type Segment = { text: string; bold: boolean };

/** Splits "**bold** plain" markup into segments. */
export function boldSegments(text: string): Segment[] {
  return text
    .split(/(\*\*[^*]+\*\*)/)
    .filter(Boolean)
    .map((part) =>
      part.startsWith('**') && part.endsWith('**')
        ? { text: part.slice(2, -2), bold: true }
        : { text: part, bold: false },
    );
}

function rangeDates(report: Report): { first: string; last: string } {
  const slots = slotsInRange(report.range);
  const first = slots[0]?.date ?? report.range.start.slice(0, 10);
  const last = slots[slots.length - 1]?.date ?? first;
  return { first, last };
}

export function reportTitle(report: Report): string {
  const { first, last } = rangeDates(report);
  const year = first.slice(0, 4);
  const day = (d: string) => `${dayOfWeek(d)} ${monthDay(d)}`;
  const dates = first === last ? day(first) : `${day(first)} – ${day(last)}`;
  return `${locationLabel(report.location)} — Weather, ${dates}, ${year}`;
}

/** "{City}_Weather_{MonDD}-{MonDD}.pdf" */
export function pdfFilename(report: Report): string {
  const { first, last } = rangeDates(report);
  const city = report.location.name.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const md = (d: string) => monthDay(d).replace(' ', '');
  return `${city || 'Location'}_Weather_${md(first)}-${md(last)}.pdf`;
}

export function gapsSentence(gaps: string[]): string {
  if (!gaps.length) return '';
  const list =
    gaps.length === 1 ? gaps[0]! : `${gaps.slice(0, -1).join(', ')} and ${gaps[gaps.length - 1]}`;
  const plural = gaps.length > 1 || gaps[0]!.includes('/');
  return `${list} ${plural ? 'were' : 'was'} not available from the forecast.`;
}

function alertWhen(start: string, end: string): string {
  if (!start || !end) return '';
  return `${dayOfWeek(start)} ${clockTime(start, false)}–${dayOfWeek(end)} ${clockTime(end, false)}`;
}

/** The alerts line: alerts, sunrise/sunset, worst window, data gaps, notes. */
export function infoItems(report: Report): { label: string; text: string }[] {
  const items: { label: string; text: string }[] = [];
  const alerts = report.alertsAvailable
    ? report.alerts.length
      ? report.alerts
          .map((a) => {
            const when = alertWhen(a.start, a.end);
            return when ? `${a.name} (${when})` : a.name;
          })
          .join('; ')
      : 'None active'
    : 'Not included in API plan';
  items.push({ label: 'Alerts', text: alerts });
  if (report.sun.length) {
    items.push({
      label: 'Sunrise/Sunset',
      text: report.sun.map((s) => `${s.day} ${s.rise} / ${s.set}`).join('; '),
    });
  }
  if (report.worstWindow) items.push({ label: 'Worst window', text: report.worstWindow });
  if (report.dataGaps.length)
    items.push({ label: 'Data gaps', text: gapsSentence(report.dataGaps) });
  for (const note of report.notes) items.push({ label: 'Note', text: note });
  return items;
}
