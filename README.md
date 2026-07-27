# SAT Vocabulary

A full-stack SAT-vocabulary study app: four study modes (Learn, Quiz, Matching, Game)
backed by a Hono/Node API and PostgreSQL 17 as the single source of truth — SM-2
spaced repetition in PL/pgSQL, transactional + idempotent event writes, and SQL-only
analytics.

> Work in progress — full setup, architecture, scheduler, parsing notes, performance
> evidence, and the "Why this game" note land with the final task.

## Quickstart (dev)

```bash
docker compose up -d postgres
bun install
bun run db:migrate
bun run dev        # api :3001, web :3000
```

## Repo layout

- `apps/api` — Hono on `@hono/node-server` (Node 22)
- `apps/web` — Vite + React 19 + Tailwind v4
- `packages/shared` — zod API contracts shared by api and web
- `packages/db` — `schema.sql`, PL/pgSQL functions, PDF parser, seed + bench scripts
