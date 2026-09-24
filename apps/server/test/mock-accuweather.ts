// A tiny stand-in for dataservice.accuweather.com used by server tests and the e2e smoke test.
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { MOCK_KEY, MOCK_LOCATION, mockAlerts, mockDaily, mockHourly } from './mock-data';

export type MockUpstream = {
  url: string;
  hits: string[];
  /** When set, every request fails with this HTTP status. */
  failWith: number | null;
  /** When set, daily windows wider than this are refused with 401, as a narrower plan would. */
  maxDailyDays: number | null;
  close(): Promise<void>;
};

export async function startMockAccuWeather(
  opts: { apiKey?: string; port?: number } = {},
): Promise<MockUpstream> {
  const apiKey = opts.apiKey ?? 'test-key';
  const state: Pick<MockUpstream, 'hits' | 'failWith' | 'maxDailyDays'> = {
    hits: [],
    failWith: null,
    maxDailyDays: null,
  };

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://mock');
    state.hits.push(url.pathname);
    const send = (status: number, body: unknown) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    const authorized =
      url.searchParams.get('apikey') === apiKey || req.headers.authorization === `Bearer ${apiKey}`;
    if (!authorized)
      return send(401, { Code: 'Unauthorized', Message: 'Api Authorization failed' });
    if (state.failWith) return send(state.failWith, { Code: 'Error', Message: 'Mock failure' });

    const q = (url.searchParams.get('q') ?? '').toLowerCase();
    const now = new Date();
    const p = url.pathname;
    let m: RegExpMatchArray | null;
    if (p === '/locations/v1/cities/autocomplete' || p === '/locations/v1/cities/search') {
      return send(200, q && 'brooklyn'.startsWith(q) ? [MOCK_LOCATION] : []);
    }
    if (p === '/locations/v1/postalcodes/search')
      return send(200, q === '11201' ? [MOCK_LOCATION] : []);
    if (p === `/locations/v1/${MOCK_KEY}`) return send(200, MOCK_LOCATION);
    if ((m = p.match(/^\/forecasts\/v1\/daily\/(\d+)day\/(.+)$/)) && m[2] === MOCK_KEY) {
      const days = Number(m[1]);
      if (state.maxDailyDays !== null && days > state.maxDailyDays) {
        return send(401, { Code: 'Unauthorized', Message: 'Plan does not include this window' });
      }
      return send(200, mockDaily(now, days));
    }
    if ((m = p.match(/^\/forecasts\/v1\/hourly\/(\d+)hour\/(.+)$/)) && m[2] === MOCK_KEY) {
      return send(200, mockHourly(now, Number(m[1])));
    }
    if (p === `/alerts/v1/${MOCK_KEY}`) return send(200, mockAlerts(now));
    return send(400, { Code: 'BadRequest', Message: 'Unknown location' });
  });

  await new Promise<void>((resolve) => server.listen(opts.port ?? 0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return Object.assign(state, {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  });
}
