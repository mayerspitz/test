import { useMutation, useQuery } from '@tanstack/react-query';
import type { LocationResult, ReportRequestBody, Units } from '@windwise/shared';
import { useMemo, useState, type FormEvent } from 'react';
import { api, saveFile } from './api';
import { LocationSearch } from './components/LocationSearch';
import { RangePicker } from './components/RangePicker';
import { ReportSkeleton, ReportView } from './components/ReportView';
import { UnitsToggle } from './components/UnitsToggle';
import { dayOptions, defaultRange, localToday, toRequestRange, type RangePick } from './dates';

const FALLBACK_DAYS = 5;

export function App() {
  const caps = useQuery({
    queryKey: ['capabilities'],
    queryFn: api.capabilities,
    staleTime: Infinity,
  });
  const maxDays = caps.data?.maxDailyDays ?? FALLBACK_DAYS;
  const today = useMemo(() => localToday(), []);
  const days = useMemo(() => dayOptions(today, maxDays), [today, maxDays]);

  const [location, setLocation] = useState<LocationResult | null>(null);
  const [units, setUnits] = useState<Units>('imperial');
  const [picked, setPicked] = useState<{ start?: RangePick; end?: RangePick }>({});
  const defaults = defaultRange(today, maxDays);
  const start = picked.start ?? defaults.start;
  const end = picked.end ?? defaults.end;

  const report = useMutation({ mutationFn: api.report });
  const pdf = useMutation({
    mutationFn: api.pdf,
    onSuccess: ({ blob, filename }) => saveFile(blob, filename),
  });
  const [requested, setRequested] = useState<ReportRequestBody | null>(null);

  const range = toRequestRange(start, end);
  const formError = !location
    ? 'Pick a location.'
    : range.end <= range.start
      ? 'End must be after start.'
      : null;

  function generate(e: FormEvent) {
    e.preventDefault();
    if (!location || formError) return;
    const body: ReportRequestBody = { locationKey: location.key, ...range, units };
    setRequested(body);
    pdf.reset();
    report.mutate(body);
  }

  const error = report.error ?? pdf.error ?? (caps.error as Error | null);

  return (
    <div className="app">
      <header className="topbar">
        <img src="/favicon.svg" alt="" width={28} height={28} />
        <span className="brand">WindWise</span>
      </header>

      <main className="content">
        <form className="controls" onSubmit={generate}>
          <LocationSearch value={location} onChange={setLocation} />
          <RangePicker
            start={start}
            end={end}
            days={days}
            onStart={(v) => setPicked((p) => ({ ...p, start: v }))}
            onEnd={(v) => setPicked((p) => ({ ...p, end: v }))}
          />
          <UnitsToggle value={units} onChange={setUnits} />
          <div className="field submit">
            <button type="submit" className="primary" disabled={!!formError || report.isPending}>
              {report.isPending ? 'Generating…' : 'Generate'}
            </button>
          </div>
        </form>
        {caps.data?.periodsMode === 'day-night' ? (
          <p className="notice">Your API plan provides Day/Night only.</p>
        ) : null}

        {error ? (
          <div className="banner error" role="alert">
            {error.message}
          </div>
        ) : null}

        {report.isPending ? (
          <ReportSkeleton />
        ) : report.data ? (
          <section className="result">
            <div className="actions">
              <button
                type="button"
                className="primary"
                disabled={!requested || pdf.isPending}
                onClick={() => requested && pdf.mutate(requested)}
              >
                {pdf.isPending ? 'Preparing PDF…' : 'Download PDF'}
              </button>
            </div>
            <ReportView report={report.data} />
          </section>
        ) : !error ? (
          <div className="empty">
            <p>Pick a location and a range, then Generate.</p>
          </div>
        ) : null}
      </main>
    </div>
  );
}
