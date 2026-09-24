import type { Units } from '@windwise/shared';

const OPTIONS: { value: Units; label: string }[] = [
  { value: 'imperial', label: '°F · mph · in' },
  { value: 'metric', label: '°C · km/h · mm' },
];

export function UnitsToggle({ value, onChange }: { value: Units; onChange: (u: Units) => void }) {
  return (
    <div className="field units">
      <span className="label" aria-hidden>
        Units
      </span>
      <div className="segmented" role="radiogroup" aria-label="Units">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            className={value === o.value ? 'on' : undefined}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
