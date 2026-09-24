// Runs the real server against the mock AccuWeather upstream (used by the Playwright smoke test).
import { buildApp } from '../src/app';
import { loadConfig } from '../src/config/env';
import { startMockAccuWeather } from './mock-accuweather';

const upstream = await startMockAccuWeather({ apiKey: 'test-key' });
const port = process.env.E2E_PORT ?? '8787';
const config = loadConfig({
  ACCUWEATHER_API_KEY: 'test-key',
  ACCUWEATHER_BASE_URL: upstream.url,
  ACCUWEATHER_TIER: 'prime',
  PORT: port,
  WEB_ORIGIN: `http://127.0.0.1:${port}`,
});
const app = await buildApp({ config, logger: false });
await app.listen({ port: config.PORT, host: '127.0.0.1' });
console.log(`e2e server on http://127.0.0.1:${port}`);
