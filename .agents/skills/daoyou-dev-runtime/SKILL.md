---
name: daoyou-dev-runtime
description: Daoyou 本地开发、环境变量、构建、Docker、compose、cron 和部署脚本操作指南。Use when starting the app, debugging build/dev-server/runtime failures, changing package scripts, Dockerfile, docker-compose, Vite build config, environment variables, health checks, cron jobs, or deployment scripts in this repo.
---

# Daoyou Dev Runtime

## Read First

- `README.md`
- `package.json`
- `vite.config.ts`
- `src/index.ts`
- `src/server/app.ts`
- `src/server/lib/jobs/internalCronScheduler.ts`
- `docker/Dockerfile.app`
- `docker/Dockerfile.battle`
- `scripts/docker-compose.production.yml`
- `scripts/docker-compose.nats.yml`
- `scripts/blue-green-app.sh`
- `scripts/deploy-battle.sh`
- `.github/workflows/deploy.yml`

## Core Facts

- This repo is `Hono + React SPA`, not Next.js or SSR.
- Use Bun. The repo has `bun.lock` and scripts use `bun` / `bunx`; do not introduce npm/yarn/pnpm lockfiles.
- `bun run build` builds three independent artifacts: client SPA, Bun/Hono API, and Node LTS battle-server.
- The SPA is built with `build:client` for independent static deployment; backend Docker builds never run it.
- The Hono API uses `@hono/vite-build/bun` with entry `src/index.ts`; unmatched routes redirect to the public client rather than serving SPA files.
- The battle-server uses `vite.battle.config.ts` and outputs `dist-battle/battle-server.js` for Node LTS.
- `VITE_TURNSTILE_SITE_KEY` is a frontend-only build-time value.
- Health check is `/api/health-check`; Redis down returns 503, missing Redis returns `redis: disabled`.
- Production Bun cron jobs currently include `auction-expire`, `bet-battle-expire`, `rank-rewards`, and `market-refresh`.
- React SPA is independently deployed and is never copied into backend images.
- Production Compose defines `app-blue`, `app-green`, and the stable Node LTS battle service. `scripts/blue-green-app.sh` selects one app profile at a time and switches OpenResty.
- PostgreSQL, Redis, NATS, SMTP, and the reverse proxy remain external production dependencies.
- GitHub Actions builds and pushes separate app and battle images; it does not SSH deploy and does not run lint/test as a separate quality gate.

## Common Commands

```bash
bun install
cp .env.example .env.local
bunx drizzle-kit migrate
bun run auth:migrate
bun run dev
bun run build
bun run preview
bun run start
```

Docker:

```bash
docker build -t daoyou-app:local -f docker/Dockerfile.app .
docker build -t daoyou-battle:local -f docker/Dockerfile.battle .
APP_IMAGE=daoyou-app:local ENV_FILE=/path/to/.env.production ./scripts/blue-green-app.sh
BATTLE_IMAGE=daoyou-battle:local ENV_FILE=/path/to/.env.production ./scripts/deploy-battle.sh
docker compose -f scripts/docker-compose.nats.yml up -d
```

## Workflow

1. Identify whether the issue is dev-server, client build, server build, runtime env, database, Redis, Docker, or cron.
2. Check the relevant config before editing:
   - Vite/dev/build: `vite.config.ts`
   - runtime fallback and cron registration: `src/index.ts`
   - API app wiring: `src/server/app.ts`
   - Docker/compose: `docker/`, `scripts/docker-compose.*.yml`, deployment scripts
3. Preserve the independent client/server/battle outputs; never copy client SPA output into backend images.
4. When changing env variables, update `.env.example` and README only if the variable is real in code.
5. When changing cron jobs, update both `src/server/lib/jobs/internalCronScheduler.ts` and `src/server/routes/internal/cron.router.ts` if the job should also be manually triggerable.
6. For Redis-backed jobs, keep Redis token locks and TTLs; do not replace them with in-memory locks.

## Do Not

- Do not use Next.js/SSR assumptions for routing or server rendering.
- Do not make production SPA fallback swallow `/api/*`, `/internal/*`, or static file requests.
- Do not move frontend build-time variables into runtime-only Docker env and expect the client bundle to see them.
- Do not assume GitHub Actions runs lint/test; current workflow only builds and pushes Docker image on `master`.
- Do not assume production Compose provisions PostgreSQL, Redis, NATS, SMTP, or OpenResty; it only manages battle and the shared runtime network.
- Do not run both external HTTP cron and Bun cron without understanding duplicate scheduling. Redis locks prevent concurrent execution, but they are not a deployment policy.

## Verify

- Config-only or docs-only: inspect `git diff`.
- Runtime/build changes: run `bun run build`.
- Dev-server changes: run `bun run dev` and hit `/api/health-check`.
- Docker changes: build locally or inspect the exact script affected.
- Cron changes: run lint/build and verify `CRON_SECRET` behavior with focused runtime checks; do not add server unit tests.
