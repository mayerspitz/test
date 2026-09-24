import { PERIOD_KEYS, PERIOD_PICKER_LABELS, type PeriodKey } from '@windwise/shared';
import { useId } from 'react';
import type { RangePick } from '../dates';

function Pick({
  label,
  value,
  days,
  onChange,
}: {
  label: string;
  value: RangePick;
  days: { value: string; label: string }[];
  onChange: (v: RangePick) => void;
}) {
  const id = useId();
  return (
    <div className="field pick" role="group" aria-labelledby={id}>
      <span className="label" id={id}>
        {label}
      </span>
      <div className="pair">
        <select
          aria-label={`${label} day`}
          value={value.date}
          onChange={(e) => onChange({ ...value, date: e.target.value })}
        >
          {days.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
        <select
          aria-label={`${label} period`}
          value={value.period}
          onChange={(e) => onChange({ ...value, period: e.target.value as PeriodKey })}
        >
          {PERIOD_KEYS.map((p) => (
            <option key={p} value={p}>
              {PERIOD_PICKER_LABELS[p]}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export function RangePicker({
  start,
  end,
  days,
  onStart,
  onEnd,
}: {
  start: RangePick;
  end: RangePick;
  days: { value: string; label: string }[];
  onStart: (v: RangePick) => void;
  onEnd: (v: RangePick) => void;
}) {
  return (
    <>
      <Pick label="Start" value={start} days={days} onChange={onStart} />
      <Pick label="End" value={end} days={days} onChange={onEnd} />
    </>
  );
}
