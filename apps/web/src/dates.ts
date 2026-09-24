import { addDays, dayOfWeek, monthDay, slotEnd, slotStart, type PeriodKey } from '@windwise/shared';

export type RangePick = { date: string; period: PeriodKey };

/** Today's date (YYYY-MM-DD) in the browser's time zone. */
export function localToday(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function dayOptions(today: string, maxDays: number): { value: string; label: string }[] {
  return Array.from({ length: maxDays }, (_, i) => {
    const date = addDays(today, i);
    return { value: date, label: `${dayOfWeek(date)} ${monthDay(date)}` };
  });
}

/**
 * Default range: Fri Morning → Sun Night of the coming weekend (the current one from Fri to Sun),
 * clamped to the forecast window.
 */
export function defaultRange(today: string, maxDays: number): { start: RangePick; end: RangePick } {
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay(); // 0 Sun … 6 Sat
  const toFriday = dow === 0 || dow >= 5 ? 0 : 5 - dow;
  const toSunday = dow === 0 ? 0 : 7 - dow;
  const last = addDays(today, maxDays - 1);
  const start = addDays(today, toFriday);
  const end = addDays(today, toSunday);
  return {
    start: { date: start > last ? today : start, period: 'morning' },
    end: { date: end > last ? last : end, period: 'overnight' },
  };
}

export function toRequestRange(start: RangePick, end: RangePick): { start: string; end: string } {
  return { start: slotStart(start.date, start.period), end: slotEnd(end.date, end.period) };
}
