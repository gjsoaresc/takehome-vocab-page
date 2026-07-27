# Build with bun (workspace install + bundle), run on plain Node 22.
# The `seed` target shares the installed base so `docker compose run --rm seed`
# needs no host toolchain.

FROM oven/bun:1.3-alpine AS base
WORKDIR /app
COPY . .
RUN bun install --ignore-scripts

FROM base AS build
RUN cd apps/api && bun run build

# One-shot seeder: schema + functions + words + 120k-event history.
FROM base AS seed
CMD ["bun", "packages/db/src/seed.ts"]

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/apps/api/dist ./dist
EXPOSE 3001
HEALTHCHECK --interval=10s --timeout=3s --retries=10 \
  CMD wget -qO- http://127.0.0.1:3001/healthz || exit 1
CMD ["node", "dist/index.js"]
