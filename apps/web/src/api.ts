import type { Capabilities, LocationResult, Report, ReportRequestBody } from '@windwise/shared';

async function errorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    if (body.error) return body.error;
  } catch {
    // not JSON
  }
  return `Request failed (HTTP ${res.status}).`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) throw new Error(await errorMessage(res));
  return (await res.json()) as T;
}

const post = (body: ReportRequestBody): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const api = {
  capabilities: () => request<Capabilities>('/api/capabilities'),
  locations: (q: string) => request<LocationResult[]>(`/api/locations?q=${encodeURIComponent(q)}`),
  report: (body: ReportRequestBody) => request<Report>('/api/report', post(body)),
  async pdf(body: ReportRequestBody): Promise<{ blob: Blob; filename: string }> {
    const res = await fetch('/api/report/pdf', post(body));
    if (!res.ok) throw new Error(await errorMessage(res));
    const disposition = res.headers.get('Content-Disposition') ?? '';
    const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? 'WindWise_Weather.pdf';
    return { blob: await res.blob(), filename };
  },
};

export function saveFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
