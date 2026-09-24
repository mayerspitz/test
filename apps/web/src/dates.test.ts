import { describe, expect, it } from 'vitest';
import { dayOptions, defaultRange, toRequestRange } from './dates';

describe('defaultRange', () => {
  it('Thu → next Fri Morning to Sun Night', () => {
    expect(defaultRange('2026-09-24', 5)).toEqual({
      start: { date: '2026-09-25', period: 'morning' },
      end: { date: '2026-09-27', period: 'overnight' },
    });
  });

  it('Mon with a 5-day plan: clamps to the window', () => {
    expect(defaultRange('2026-09-21', 5)).toEqual({
      start: { date: '2026-09-25', period: 'morning' },
      end: { date: '2026-09-25', period: 'overnight' },
    });
  });

  it('Sat → the current weekend', () => {
    expect(defaultRange('2026-09-26', 5)).toEqual({
      start: { date: '2026-09-26', period: 'morning' },
      end: { date: '2026-09-27', period: 'overnight' },
    });
  });
});

describe('toRequestRange', () => {
  it('Night ends at 06:00 the next day', () => {
    expect(
      toRequestRange(
        { date: '2026-09-25', period: 'morning' },
        { date: '2026-09-27', period: 'overnight' },
      ),
    ).toEqual({ start: '2026-09-25T06:00', end: '2026-09-28T06:00' });
  });
});

describe('dayOptions', () => {
  it('lists maxDailyDays days from today', () => {
    expect(dayOptions('2026-09-24', 3)).toEqual([
      { value: '2026-09-24', label: 'Thu Sep 24' },
      { value: '2026-09-25', label: 'Fri Sep 25' },
      { value: '2026-09-26', label: 'Sat Sep 26' },
    ]);
  });
});
