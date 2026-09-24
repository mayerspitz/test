import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import { mapLocation, pdfFilename } from '@windwise/shared';
import { PdfTooLongError, renderReportPdf } from '@windwise/shared/pdf';
import Fastify, { type FastifyServerOptions } from 'fastify';
import { z } from 'zod';
import {
  createAccuWeatherClient,
  UpstreamError,
  type AccuWeatherClient,
} from './accuweather/client';
import { createCache } from './cache';
import type { Config } from './config/env';
import { capabilitiesFor } from './config/tiers';
import { BadRequestError, createReport, ReportBody } from './report-service';

const LocationQuery = z.object({
  q: z.string().trim().min(2, 'Type at least 2 characters.').max(60, 'Search is too long.'),
});

export type AppOptions = {
  config: Config;
  client?: AccuWeatherClient;
  logger?: FastifyServerOptions['logger'];
};

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new BadRequestError(result.error.issues[0]?.message ?? 'Invalid request.');
  return result.data;
}

export async function buildApp({ config, client, logger = true }: AppOptions) {
  const app = Fastify({ logger, trustProxy: true, bodyLimit: 10_000 });
  const aw =
    client ??
    createAccuWeatherClient({
      apiKey: config.ACCUWEATHER_API_KEY,
      authMode: config.ACCUWEATHER_AUTH_MODE,
      baseUrl: config.ACCUWEATHER_BASE_URL,
      cache: createCache(),
      log: app.log,
    });
  const caps = capabilitiesFor(config.ACCUWEATHER_TIER);

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof UpstreamError || err instanceof BadRequestError) {
      return reply.status(err.statusCode).send({ error: err.message });
    }
    if (err instanceof PdfTooLongError) return reply.status(422).send({ error: err.message });
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    if (status < 500) return reply.status(status).send({ error: (err as Error).message });
    req.log.error(err);
    return reply.status(500).send({ error: 'Unexpected server error.' });
  });

  await app.register(cors, { origin: config.WEB_ORIGIN, exposedHeaders: ['Content-Disposition'] });

  await app.register(
    async (api) => {
      await api.register(rateLimit, { max: 60, timeWindow: '1 minute' });

      api.get('/health', async () => ({ ok: true }));

      api.get('/capabilities', async () => caps);

      api.get('/locations', async (req) => {
        const { q } = parse(LocationQuery, req.query);
        const list = await aw.searchLocations(q);
        return list.map((l) => {
          const { key, name, admin, country } = mapLocation(l);
          return { key, name, admin, country };
        });
      });

      api.post('/report', async (req) => {
        const body = parse(ReportBody, req.body);
        return createReport(aw, caps, body, config.DEFAULT_UNITS);
      });

      api.post('/report/pdf', async (req, reply) => {
        const body = parse(ReportBody, req.body);
        const report = await createReport(aw, caps, body, config.DEFAULT_UNITS);
        const pdf = await renderReportPdf(report);
        return reply
          .header('Content-Type', 'application/pdf')
          .header('Content-Disposition', `attachment; filename="${pdfFilename(report)}"`)
          .send(pdf);
      });
    },
    { prefix: '/api' },
  );

  // Serve the built web app (single service in production).
  const webDist = config.WEB_DIST_DIR ?? fileURLToPath(new URL('../../web/dist', import.meta.url));
  if (existsSync(join(webDist, 'index.html'))) {
    await app.register(fastifyStatic, { root: webDist });
    app.setNotFoundHandler((req, reply) => {
      if (req.method !== 'GET' || req.url.startsWith('/api')) {
        return reply.status(404).send({ error: 'Not found.' });
      }
      return reply.sendFile('index.html');
    });
  }

  return app;
}
