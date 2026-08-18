# AGENTS.md

AI agents should read this first. Keep changes small, project-specific, and backed by code facts.

## Project Snapshot

- This repo is `Hono + React SPA`, not Next.js or SSR.
- Runtime stack: Bun, Hono, React 19, React Router 7, Vite, Tailwind CSS 4, PostgreSQL, Drizzle ORM, Better Auth, Redis, AI SDK.
- Use `bun` / `bunx` and the checked-in `bun.lock`. Do not introduce npm/yarn/pnpm lockfiles.
- Path aliases are `@app` -> `src/react-app`, `@server` -> `src/server`, and `@shared` -> `src/shared`.

## Key Directories

- `src/index.ts`: root Hono app, production SPA fallback, Bun cron registration.
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
bun run lint
bun run test
bun run build
bun run check
bunx drizzle-kit migrate
bun run auth:migrate
```

- `bun run build` is two-stage: `tsc -b && vite build --mode client && vite build`.
- Vitest uses node environment and discovers tests only under `src/shared`.
- Docker runtime contains only `dist`; ALTCHA uses the server-side `ALTCHA_HMAC_SECRET` and does not require a frontend site key.
- GitHub Actions currently builds and pushes Docker image on `master`; it is not a lint/test quality gate.

## Skills To Use

- `daoyou-dev-runtime`: local startup, build, Docker, env, health check, cron, deployment scripts.
- `daoyou-test-quality`: tests, lint, typecheck, validation selection, Vitest/ESLint/TS config.
- `daoyou-backend-api-security`: Hono routes, auth, admin, cron/internal APIs, LLM/provider security, Redis/SMTP integration boundaries.
- `daoyou-data-layer`: Drizzle schema/migrations, repositories, transactions, Better Auth schema, durable models.
- `daoyou-frontend-routing-state`: React routes, route handles, scene metadata, admin nav, frontend cache/refresh hooks.
- `daoyou-game-ui`: `GameViewportLayout` main-flow scene UI structure and review rules.
- `daoyou-game-core-domain`: battle-v5, creation-v2, attributes, tags, affixes, product projections.
- `daoyou-condition-alchemy-market`: condition, pills, alchemy, market, recycle, manual draw.

## Architecture Rules

- New API routes go through `src/server/routes/api/index.ts` and existing Hono middleware: `requireUser`, `requireActiveCultivator`, `requireAdmin`, `validateJson`, `validateQuery`.
- Frontend route loaders are UX guards only; backend middleware is the security boundary.
- `/api/auth/*` is Better Auth through `src/server/lib/auth/hono.ts`.
- `/internal/cron/*` uses Bearer `CRON_SECRET` when configured; production requires it, while non-production without `CRON_SECRET` currently allows the request.
- Shared request/response contracts live in `src/shared/contracts`; domain DTO/types live in `src/shared/types`.
- LLM calls should use `src/server/utils/aiClient.ts`; BYOK validation truth is `src/shared/config/llm.ts`. Server routing is one `LLM_PROVIDER` table (`provider[/model][:weight]`) parsed in `src/shared/config/llmRouting.ts`; multiple routes are sticky by user id hash. Request BYOK still wins.
- Treat all LLM output as untrusted. Resource, reward, cost, drop, and other state-changing numbers need deterministic service/schema/resource-layer guards.
- Redis access must go through `src/server/lib/redis`; do not instantiate feature-local Redis clients.
- SMTP mail goes through `src/server/lib/admin/smtp.ts`.

## Frontend Rules

- React routes are centralized in `src/react-app/router.tsx` and loaded with `lazyRoute`.
- Game scenes use `handle={scene(...)}`; the scene id must exist in `src/react-app/components/game-shell/gameNavigation.ts`.
- `/game` has distinct layouts: `GameGenesisLayout`, `GameViewportLayout`, `GameCombatLayout`, `GameMapLayout`, `GameDungeonLayout`.
- Main-flow game UI must follow `daoyou-game-ui`: identity layer, task layer, and navigation layer stay separate.
- Do not add `InkPageShell` to game routes.
- Cross-route reusable UI belongs in `src/react-app/components/feature/**`, `src/react-app/components/ui/**`, or `src/react-app/components/game-shell/**`; `src/react-app/routes/game/**/components` is page-private.
- Reuse `useCultivatorBundle`, `fetchJsonCached`, `useTaskList`, and provider contexts before adding new page-level state.

## Data And Domain Rules

- Do not create parallel `src/db` or `src/server/db`; DB entrypoints are `src/server/lib/drizzle/db.ts` and `schema.ts`.
- The main Drizzle Kit flow manages only `wanjiedaoyou_*` business tables. `drizzle.auth.config.ts` independently manages the fixed `better_auth` schema.
- Pass `DbExecutor` / `DbTransaction` through write paths; do not open a fresh executor inside a transaction.
- v2 products (`skill`, `artifact`, `gongfa`) use `wanjiedaoyou_creation_products`; equipment state is `creation_products.is_equipped`.
- `battleProjection` is runtime data rebuilt during rehydrate; do not persist it directly.
- Battle records use `wanjiedaoyou_battle_records_v2`.
- Character persistent state is `cultivators.condition`; do not restore old `persistent_state` or `persistent_statuses`.
- Consumables use `consumables.spec`; do not restore old `effects`, `use_spec`, or `details`.
- Character base attributes are only vitality, strength, spirit, endurance, speed, willpower. Derived combat/display attributes come from battle-v5 adapters.
- Runtime battle tags come from `GameplayTags`; creation/process tags come from `CreationTags`. Do not handwrite runtime tag strings.

## High-Risk Areas

- Build pipeline and SPA fallback in `vite.config.ts` / `src/index.ts`.
- Auth, ALTCHA, Better Auth schema, admin allowlist, and session cookie passthrough.
- LLM provider headers, prompt schemas, resource/reward/cost parsing, and metrics.
- Drizzle migrations, legacy tables, JSONB model shape, and transaction boundaries.
- `GameViewportLayout`, bottom dock/HUD/world-chat offset, and scene metadata.
- battle-v5, creation-v2, `condition`, alchemy, market, manual draw, and resource updates.
- Redis locks, cron jobs, rankings, market cache, chat cooldown, and health-check behavior.

## Verification Checklist

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
