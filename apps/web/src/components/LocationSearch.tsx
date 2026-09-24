import { useQuery } from '@tanstack/react-query';
import type { LocationResult } from '@windwise/shared';
import { useId, useState } from 'react';
import { api } from '../api';
import { useDebounced } from '../useDebounced';

export function locationText(l: LocationResult): string {
  return [l.name, l.admin, l.country].filter(Boolean).join(', ');
}

export function LocationSearch({
  value,
  onChange,
}: {
  value: LocationResult | null;
  onChange: (location: LocationResult | null) => void;
}) {
  const id = useId();
  const [text, setText] = useState(value ? locationText(value) : '');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const q = useDebounced(text.trim(), 300);
  const searching = q.length >= 2 && !(value && q === locationText(value));

  const results = useQuery({
    queryKey: ['locations', q],
    queryFn: () => api.locations(q),
    enabled: searching,
    staleTime: 5 * 60_000,
  });
  const options = searching ? (results.data ?? []) : [];
  const showList = open && searching && (options.length > 0 || results.isFetched);

  function pick(l: LocationResult) {
    onChange(l);
    setText(locationText(l));
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && showList && options.length) {
      e.preventDefault();
      pick(options[active] ?? options[0]!);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div className="field location">
      <label htmlFor={`${id}-input`}>Location</label>
      <div className="combo">
        <input
          id={`${id}-input`}
          type="search"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showList}
          aria-controls={`${id}-list`}
          aria-activedescendant={showList && options.length ? `${id}-opt-${active}` : undefined}
          placeholder="City or zip code"
          autoComplete="off"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setActive(0);
            setOpen(true);
            if (value) onChange(null);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={onKeyDown}
        />
        {results.isFetching && searching ? <span className="spinner" aria-hidden /> : null}
        {showList ? (
          <ul id={`${id}-list`} role="listbox" className="options">
            {options.length ? (
              options.map((l, i) => (
                <li
                  key={l.key}
                  id={`${id}-opt-${i}`}
                  role="option"
                  aria-selected={i === active}
                  className={i === active ? 'active' : undefined}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(l)}
                >
                  {locationText(l)}
                </li>
              ))
            ) : (
              <li className="none" aria-disabled>
                {results.isError ? (results.error as Error).message : 'No matches.'}
              </li>
            )}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
