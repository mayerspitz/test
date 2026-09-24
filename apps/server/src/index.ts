import { fileURLToPath } from 'node:url';
import { buildApp } from './app';
import { loadConfig } from './config/env';

// Local development reads the repo-root .env; hosted environments set real env vars.
try {
  process.loadEnvFile(fileURLToPath(new URL('../../../.env', import.meta.url)));
} catch {
  // no .env file
}

const config = loadConfig(process.env);
const app = await buildApp({ config });
if (!config.ACCUWEATHER_API_KEY) app.log.warn('ACCUWEATHER_API_KEY is not set; reports will fail.');
await app.listen({ port: config.PORT, host: config.HOST });
