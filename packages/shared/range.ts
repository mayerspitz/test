// Local-time period grid. All stamps are "YYYY-MM-DDTHH:mm" in the location's own time zone,
// so they compare correctly as plain strings.

export const PERIOD_KEYS = ['morning', 'afternoon', 'evening', 'overnight'] as const;
export type PeriodKey = (typeof PERIOD_KEYS)[number];

/** Local hours [start, end). Overnight runs 22:00–05:59 and belongs to the day it starts on. */
export const PERIOD_HOURS: Record<PeriodKey, { start: number; end: number }> = {
  morning: { start: 6, end: 12 },
  afternoon: { start: 12, end: 17 },
  evening: { start: 17, end: 22 },
  overnight: { start: 22, end: 30 },
};

/** Names used by the range picker. */
export const PERIOD_PICKER_LABELS: Record<PeriodKey, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
  overnight: 'Night',
};

export type Range = { start: string; end: string };

export type Slot = { date: string; period: PeriodKey; start: string; end: string };

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

function parseDate(date: string): Date {
  return new Date(`${date.slice(0, 10)}T00:00:00Z`);
}

export function addDays(date: string, n: number): string {
  const d = parseDate(date);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function dayOfWeek(date: string): string {
  return DOW[parseDate(date).getUTCDay()]!;
}

/** "Sep 25" */
export function monthDay(date: string): string {
  const d = parseDate(date);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** "Sep 25, 2026" */
export function monthDayYear(date: string): string {
  return `${monthDay(date)}, ${parseDate(date).getUTCFullYear()}`;
}

/** Stamp for a local date plus an hour offset (hour may exceed 23). */
export function stamp(date: string, hour: number): string {
  const d = addDays(date, Math.floor(hour / 24));
  return `${d}T${String(hour % 24).padStart(2, '0')}:00`;
}

export function slotStart(date: string, period: PeriodKey): string {
  return stamp(date, PERIOD_HOURS[period].start);
}

export function slotEnd(date: string, period: PeriodKey): string {
  return stamp(date, PERIOD_HOURS[period].end);
}

/** Hour stamps inside a slot, in order. */
export function slotHours(slot: Pick<Slot, 'date' | 'period'>): string[] {
  const { start, end } = PERIOD_HOURS[slot.period];
  const out: string[] = [];
  for (let h = start; h < end; h++) out.push(stamp(slot.date, h));
  return out;
}

/** Every period whose start falls inside [range.start, range.end). */
export function slotsInRange(range: Range): Slot[] {
  const out: Slot[] = [];
  const last = range.end.slice(0, 10);
  for (let date = range.start.slice(0, 10); date <= last; date = addDays(date, 1)) {
    for (const period of PERIOD_KEYS) {
      const start = slotStart(date, period);
      if (start >= range.start && start < range.end) {
        out.push({ date, period, start, end: slotEnd(date, period) });
      }
    }
  }
  return out;
}

/** Local "YYYY-MM-DDTHH:mm" from an AccuWeather timestamp such as 2026-09-25T06:00:00-04:00. */
export function localStamp(iso: string): string {
  return iso.slice(0, 16);
}

/** "6:48 AM" from an AccuWeather local timestamp. */
export function clockTime(iso: string, withMinutes = true): string {
  const h = Number(iso.slice(11, 13));
  const m = iso.slice(14, 16);
  const suffix = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return withMinutes || m !== '00' ? `${h12}:${m} ${suffix}` : `${h12} ${suffix}`;
}
