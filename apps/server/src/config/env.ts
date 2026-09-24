import { z } from 'zod';
import { TIER_NAMES } from './tiers';

const blankToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);
const opt = <T extends z.ZodType>(schema: T) => z.preprocess(blankToUndefined, schema);

const EnvSchema = z.object({
  ACCUWEATHER_API_KEY: opt(z.string().trim().default('')),
  ACCUWEATHER_AUTH_MODE: opt(z.enum(['query', 'bearer']).default('query')),
  ACCUWEATHER_TIER: opt(z.enum(TIER_NAMES).default('free')),
  ACCUWEATHER_BASE_URL: opt(z.url().default('https://dataservice.accuweather.com')),
  PORT: opt(z.coerce.number().int().positive().default(8787)),
  HOST: opt(z.string().default('0.0.0.0')),
  WEB_ORIGIN: opt(z.string().default('http://localhost:5173')),
  DEFAULT_UNITS: opt(z.enum(['imperial', 'metric']).default('imperial')),
  WEB_DIST_DIR: opt(z.string().optional()),
});

export type Config = z.infer<typeof EnvSchema>;

export function loadConfig(env: Record<string, string | undefined>): Config {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment: ${issues}`);
  }
  return parsed.data;
}
