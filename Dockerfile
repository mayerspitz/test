# WindWise: one Node service — Fastify API plus the built React app.
FROM node:22-slim

RUN npm install -g pnpm@10.33.0
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

ENV NODE_ENV=production HOST=0.0.0.0 PORT=10000
EXPOSE 10000
USER node
CMD ["node", "apps/server/dist/index.js"]
