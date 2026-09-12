# AGENTS.md

AI agents should read this first. Keep changes small, project-specific, and backed by code facts.

## Project Snapshot

- This repo is `Hono + React SPA`, not Next.js or SSR.
- Runtime stack: Bun, Hono, React 19, React Router 8, Vite, Tailwind CSS 4, PostgreSQL, Drizzle ORM, Better Auth, Redis, NATS, AI SDK.
- Use `bun` / `bunx` and the checked-in `bun.lock`. Do not introduce npm/yarn/pnpm lockfiles.
- Path aliases are `@app` -> `src/react-app`, `@server` -> `src/server`, and `@shared` -> `src/shared`.

## Key Directories

- `src/index.ts`: Bun/Hono entrypoint, WebSocket adapter, cron and message infrastructure lifecycle.
- `src/server`: Hono app, routes, auth, services, repositories, jobs, Redis, LLM, SMTP.
- `src/react-app`: React SPA routes, layouts, game shell, UI, hooks, providers.
- `src/shared`: shared contracts, game engines, config, pure logic, domain types.
- `src/server/lib/drizzle/schema.ts`: Drizzle schema for `wanjiedaoyou_*` business tables.
- `drizzle/`: Drizzle SQL migrations and snapshots.
- `drizzle-auth/`: independent Drizzle migrations and snapshots for the fixed `better_auth` schema.
- `docs/`: design and architecture notes; verify against current code before treating old docs as current truth.
- `.agents/skills/`: project-specific AI skills. Use the matching skill before editing that area.

## Commands

```bash
bun install
bun run dev
bun run prd
bun run lint
bun run test
bun run build
bun run db:migrate
```

- `dev[:api|:web]` selects `env/local.env`; `prd[:api|:web]` selects `env/staging.env`. Bun's implicit env loading is disabled; other tools require explicitly injected variables or `bun --env-file=...`.
- `bun run build` sequentially invokes `build:client` and `build:server`; Vite configs separate client and server targets. The old V5 resolver Worker target was retired in Phase 10H. Preserve the remaining CI/CD entrypoints.
- Vitest uses node environment and discovers tests only under `src/shared`.
- Docker runtime contains only `dist`; ALTCHA uses the server-side `ALTCHA_HMAC_SECRET` and does not require a frontend site key.
- GitHub Actions currently builds and pushes the Docker image on tag pushes; it is not a lint/test quality gate.

## Skills To Use

- `daoyou-backend-api-security`: Hono routes, auth, admin, cron/internal APIs, LLM/provider security, Redis/SMTP integration boundaries.
- `daoyou-data-layer`: Drizzle schema/migrations, repositories, transactions, Better Auth schema, durable models.
- `daoyou-game-ui`: `GameViewportLayout` main-flow scene UI structure and review rules.
- `daoyou-ink-portraits`: 玩家、NPC、BOSS 写意墨像立绘的固定笔墨基准、生成与视觉验收；见 `.agents/skills/daoyou-ink-portraits/SKILL.md`。
- `daoyou-game-core-domain`: combat-v6 core/rules/projection, sects, equipment, manuals, beasts, and shared inventory/reward rules.
- `daoyou-beast-design`: 灵兽物种、生灵层次、命名、资质成长及出生技能池设计与审查；扩充或调整物种前读取 `.agents/skills/daoyou-beast-design/SKILL.md`，实施同时遵守领域技能。
- Only the skills present in `.agents/skills/` are project skill entrypoints. For runtime work, inspect `package.json`, `src/index.ts`, Vite/Docker configs and `docs/local-development.md`; for condition/alchemy/market work, combine the domain, data and backend skills as applicable.

## Architecture Rules

- New API routes go through `src/server/routes/api/index.ts` and existing Hono middleware: `requireUser`, `requireActiveCultivatorRef`, `requireAdmin`, `validateJson`, `validateQuery`.
- Frontend route loaders are UX guards only; backend middleware is the security boundary.
- `/api/auth/*` is Better Auth through `src/server/lib/auth/hono.ts`.
- `/internal/cron/*` uses Bearer `CRON_SECRET` when configured; production requires it, while non-production without `CRON_SECRET` currently allows the request.
- Shared request/response contracts live in `src/shared/contracts`; domain DTO/types live in `src/shared/types`.
- LLM calls should use `src/server/utils/aiClient.ts`; BYOK validation truth is `src/shared/config/llm.ts`. Server routing is one `LLM_PROVIDER` table (`provider[/model][:weight]`) parsed in `src/shared/config/llmRouting.ts`; multiple routes are sticky by user id hash. Request BYOK still wins.
- Treat all LLM output as untrusted. Resource, reward, cost, drop, and other state-changing numbers need deterministic service/schema/resource-layer guards.
- Redis access must go through `src/server/lib/redis`; do not instantiate feature-local Redis clients.
- SMTP mail goes through `src/server/lib/admin/smtp.ts`.

## Frontend Rules

- Numeric data uses Tailwind default `font-mono`; prose inherits the body font. Keep quantity weight/spacing local (`font-semibold tracking-tight`), and do not override `--font-mono` or add numeric font tokens/classes. See `docs/numeric-typography.md`.

- React routes are centralized in `src/react-app/router.tsx` and loaded with `lazyRoute`.
- Game scenes use `handle={scene(...)}`; the scene id must exist in `src/react-app/components/game-shell/gameNavigation.ts`.
- `/game` uses distinct genesis, narrative, viewport, activity, combat, map and dungeon layouts. V6 battles have `CombatV6Layout`; inspect `router.tsx` for the actual wrapper before changing a scene.
- Main-flow game UI must follow `daoyou-game-ui`: identity layer, task layer, and navigation layer stay separate.
- Do not add `InkPageShell` to game routes.
- Cross-route reusable UI belongs in `src/react-app/components/feature/**`, `src/react-app/components/ui/**`, or `src/react-app/components/game-shell/**`; `src/react-app/routes/game/**/components` is page-private.
- Reuse `src/react-app/lib/resources` hooks/store, `fetchJsonCached`, `useTaskList`, and provider contexts before adding new page-level state.

## Data And Domain Rules

- Do not create parallel `src/db` or `src/server/db`; DB entrypoints are `src/server/lib/drizzle/db.ts` and `schema.ts`.
- The main Drizzle Kit flow manages only `wanjiedaoyou_*` business tables. `drizzle.auth.config.ts` independently manages the fixed `better_auth` schema.
- Pass `DbExecutor` / `DbTransaction` through write paths; do not open a fresh executor inside a transaction.
- Current equipment/items use `inventory_items` and `cultivator_equipment_slots`; personal manuals and beasts belong to the cultivator, while sect combat progression belongs to membership. See `daoyou-data-layer` for tables and ownership.
- Runtime DB access uses `pg.Pool` / node-postgres; use `runDbTasks` when a group of reads may run inside a transaction.
- Active V6 combat is Redis-authoritative; durable history uses `combat_replay_archives` / `combat_replay_participants`, with NATS-backed terminal/replay delivery.
- Character persistent state is `cultivators.condition`. Bag consumable facts (including `spec`) are stored in `inventory_items.instance_data`; residual old tables are not the V6 bag authority.
- Character permanent attributes remain vitality, strength, spirit, endurance, speed, willpower. Current projection is `projectCharacterToCombatV6`; display shares that V6 pipeline.
- V6 core must stay independent of rules/projection/content and must not import battle-v5 or creation-v2. Do not restore old ability/tag/product projection machinery for new V6 behavior.
- Legacy tables/types can remain without being current authorities. Check runtime callers and `docs/combat-v6-legacy-table-retirement.md` before migration/deletion; `/api/battle-records/*` is retired with 410.

## High-Risk Areas

- Client/server build separation, `src/index.ts` startup/shutdown and `src/server/app.ts` routing.
- Auth, ALTCHA, Better Auth schema, admin allowlist, and session cookie passthrough.
- LLM provider headers, prompt schemas, resource/reward/cost parsing, and metrics.
- Drizzle migrations, legacy tables, JSONB model shape, and transaction boundaries.
- `GameViewportLayout`, bottom dock/HUD/world-chat offset, and scene metadata.
- combat-v6 core/content/projection, `condition`, unified inventory, alchemy, market and resource updates.
- Redis CAS/occupancy locks, NATS/outboxes, terminal settlement, cron jobs, rankings and health-check behavior.

## Verification Checklist

- Testing has only two layers: pure `src/shared` unit tests and Codex browser/Playwright simulations following `docs/testing.md`. Do not add one-off smoke, E2E, seed, benchmark, or fault-injection scripts.
- Local browser test accounts and their shared password are documented in `docs/testing.md` section 3. Reuse them; query the local database read-only to select existing accounts and characters instead of asking the user for known credentials again. Complete email verification through Mailpit and never apply these credentials or test writes to staging/production.

- Unit tests are forbidden under `src/react-app` and `src/server`; do not add `*.test.*` or `*.spec.*` files there.
- New unit tests are allowed only for pure, deterministic, reusable engine/domain logic under `src/shared`.
- Do not write tests that exercise or mock databases, repositories, Hono routes, auth, Redis, LLM/SMTP providers, network APIs, or other third-party services.
- Frontend and backend changes must be verified with lint, typecheck/build, code inspection, and focused manual/runtime checks instead of unit tests.
- For eligible shared engine changes, pick focused tests first, then broader shared-engine checks if the blast radius is large.
- Run `bun run lint`, `bun run test`, or `bun run build` when code/config changes justify it.
- For route/layout changes, run lint/build and inspect the affected navigation and layout behavior manually.
- For LLM/provider changes, run lint/build and inspect provider validation and runtime behavior without adding provider integration tests.
- For data/model changes, inspect generated migrations, transaction boundaries, and build output; do not add database/repository tests.
- For docs/skill-only changes, inspect Markdown structure, skill validation, and `git diff`; full app tests are usually unnecessary.
- Always report commands run and any checks skipped.

## Working Style

- State assumptions before coding. If multiple interpretations exist, surface them.
- Prefer the minimum code that solves the request. Do not add speculative flexibility.
- Touch only files needed for the task. Do not clean unrelated code or revert user changes.
- Match existing patterns even if you would design them differently.
- Remove only unused imports/variables/functions created by your own change.
- For bugs in eligible pure shared engine logic, prefer a reproducing test first. For frontend, backend, database, or third-party behavior, use non-test verification.
