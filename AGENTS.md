# AGENTS.md

AI agents should read this first. Keep changes small, project-specific, and backed by code facts.

## Project Snapshot

- NestJS框架代码迁移与pnpm/Turborepo工具链切换完成：开发／构建入口为`apps/api/src`，Docker运行其部署产物，旧Hono入口、路由和依赖已移除；特殊数据／发布验收仍有未完成项，尚未部署生产。进度和验收见`docs/nestjs-migration.md`。使用Nest Controller、Guard、Zod Pipe、Filter和构造器注入，不恢复Hono兼容路由层。

- This repo is `NestJS + React SPA`, not Next.js or SSR.
- Runtime stack: Node.js 24, NestJS 12 (Express/native ws), pnpm + Turborepo tooling, React 19, React Router 8, Vite, Tailwind CSS 4, PostgreSQL, Drizzle ORM, Better Auth, Redis, NATS, AI SDK.
- Use the pinned `pnpm` version and `pnpm-lock.yaml` for development and deployment. Do not introduce Bun/npm/yarn lockfiles. Turborepo orchestrates package builds and typechecks; turbo watch rebuilds dependencies and restarts persistent development tasks.
- pnpm workspaces: `apps/api`, `apps/web`, `packages/shared`. Each owns its runtime dependencies; root owns lint/test/maintenance tooling. Shared must not import either app; API and Web may import shared. ESLint (Web/shared/tools) and Oxlint (API) enforce these boundaries, repository direction, and combat core independence.
- Path aliases are `@app` -> `apps/web/src`, `@server` -> `apps/api/src`, and `@daoyou/shared/*` resolves through the workspace package exports (no source alias bypass).

## Key Directories

- `apps/api/src/main.ts`: Node/Nest entrypoint, HTTP/WS adapters and shutdown coordination; runtime module owns cron and messaging lifecycle.
- `apps/api/src`: Nest feature modules. Each feature owns its `application/` implementations (sects uses `organization/`); player owns state coordination, runtime owns jobs/message composition, and `lib` retains shared infrastructure.
- `apps/web/src`: React SPA routes, layouts, game shell, UI, hooks, providers.
- `packages/shared/src`: shared contracts, game engines, config, pure logic, domain types.
- `apps/api/src/lib/drizzle/schema.ts`: Drizzle schema for `wanjiedaoyou_*` business tables.
- `drizzle/`: Drizzle SQL migrations and snapshots.
- `drizzle-auth/`: independent Drizzle migrations and snapshots for the fixed `better_auth` schema.
- `docs/`: design and architecture notes; verify against current code before treating old docs as current truth.
- `.agents/skills/`: project-specific AI skills. Use the matching skill before editing that area.

## Commands

```bash
pnpm install
pnpm run dev
pnpm run prd
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run build
pnpm run db:migrate
```

- `dev[:api|:web]` selects `env/local.env`; `prd[:api|:web]` selects `env/staging.env`. Node/Nest explicitly loads the selected file; maintenance scripts use `node --env-file=... --import tsx`.
- `pnpm run build` uses Turbo to build the independent API and Web packages; Nest CLI 12 builds `apps/api` with its default tsc builder; shared is compiled first with tsc and exports JavaScript/declarations from dist; Vite builds `apps/web`. The old V5 resolver Worker target was retired in Phase 10H. Preserve the remaining CI/CD entrypoints.
- Vitest uses node environment and discovers tests only under `packages/shared/src`.
- Docker runtime contains Node, the pnpm-deployed API production dependencies, package metadata and `dist`; ALTCHA uses the server-side `ALTCHA_HMAC_SECRET` and does not require a frontend site key.
- GitHub Actions runs lint/typecheck/shared tests/build on PRs and master pushes; tag pushes build the API image and always publish latest.

## Skills To Use

- `daoyou-backend-api-security`: Nest controllers/guards, auth, admin, cron/internal APIs, LLM/provider security, Redis/SMTP integration boundaries.
- `daoyou-data-layer`: Drizzle schema/migrations, repositories, transactions, Better Auth schema, durable models.
- `daoyou-game-ui`: `GameViewportLayout` main-flow scene UI structure and review rules.
- `daoyou-item-preview`: 新增道具或调整物品预览字段、文案、层级、交互与适配器时，遵循 [.agents/skills/daoyou-item-preview/SKILL.md](.agents/skills/daoyou-item-preview/SKILL.md) 的固定展示规范和分类基线，避免恢复已删除的冗余信息。
- `daoyou-ink-portraits`: 玩家、NPC、BOSS 与灵兽写意墨像立绘的固定笔墨基准、物种设计方法、彩墨与视觉验收；见 `.agents/skills/daoyou-ink-portraits/SKILL.md`。
- `daoyou-map-art`: 世界总览与独立区域地图的国画水墨、彩墨、地域辨识、空间尺度及素材交付；见 [.agents/skills/daoyou-map-art/SKILL.md](.agents/skills/daoyou-map-art/SKILL.md)。
- `daoyou-game-core-domain`: combat-v6 core/rules/projection, sects, equipment, manuals, beasts, and shared inventory/reward rules.
- `daoyou-beast-design`: 灵兽物种、生灵层次、命名、资质成长及出生技能池设计与审查；扩充或调整物种前读取 `.agents/skills/daoyou-beast-design/SKILL.md`，实施同时遵守领域技能。
- Only the skills present in `.agents/skills/` are project skill entrypoints. For runtime work, inspect `package.json`, `apps/api/src/main.ts`, Vite/Docker configs and `docs/local-development.md`; for condition/alchemy/market work, combine the domain, data and backend skills as applicable.

## Architecture Rules

- New API routes belong to Nest feature modules imported by `apps/api/src/app.module.ts`. Reuse `AccessGuard`/`@Access`, `SessionService`, `JsonBody`, `FirstQuery`, Zod pipes and existing exception filters. Use explicit constructor `@Inject`; the API build deliberately disables implicit design-type metadata.
- Frontend route loaders are UX guards only; backend middleware is the security boundary.
- `/api/auth/*` is Better Auth through `apps/api/src/lib/auth/handler.ts`.
- `/internal/cron/*` uses Bearer `CRON_SECRET` when configured; production requires it, while non-production without `CRON_SECRET` currently allows the request.
- Shared request/response contracts live in `packages/shared/src/contracts`; domain DTO/types live in `packages/shared/src/types`.
- LLM calls should use `apps/api/src/utils/aiClient.ts`; BYOK validation truth is `packages/shared/src/config/llm.ts`. Server routing is one `LLM_PROVIDER` table (`provider[/model][:weight]`) parsed in `packages/shared/src/config/llmRouting.ts`; multiple routes are sticky by user id hash. Request BYOK still wins.
- Treat all LLM output as untrusted. Resource, reward, cost, drop, and other state-changing numbers need deterministic service/schema/resource-layer guards.
- Server config: `apps/api/src/config/configuration.module.ts` uses `@nestjs/config`, ignores dotenv discovery, and publishes the validated immutable environment from `lib/config/environment.ts`. Use injected `AppConfigService` in Nest services and that snapshot in framework-independent libraries; do not add direct `process.env` reads outside it.
- Redis access must go through `apps/api/src/lib/redis`; do not instantiate feature-local Redis clients.
- SMTP mail goes through `apps/api/src/lib/admin/smtp.ts`.

## Frontend Rules

- 新增或迁移图标渲染统一使用 `apps/web/src/components/ui/GameIcon.tsx`：emoji 直接传值，SVG／WebP／PNG 使用 `icon:名称`；素材统一放在 `apps/web/public/assets/icons/`，名称与路径只在 `components/ui/icons/registry.ts` 注册，业务组件不得自行解析协议或直接引用图标文件。见 `docs/game-icons.md`。

- Numeric data uses Tailwind default `font-mono`; prose inherits the body font. Keep quantity weight/spacing local (`font-semibold tracking-tight`), and do not override `--font-mono` or add numeric font tokens/classes. See `docs/numeric-typography.md`.

- React routes are assembled in `apps/web/src/router.tsx` from `route-definitions/**` and loaded with `lazyRoute`. Preserve route nesting/order and implicit IDs when moving definitions.
- Game scenes use `handle={scene(...)}`; the scene id must exist in `apps/web/src/components/game-shell/gameNavigation.ts`.
- `/game` uses distinct genesis, narrative, viewport, activity, combat, map and dungeon layouts. V6 battles have `CombatV6Layout`; inspect `route-definitions/game.tsx` and its branches for the actual wrapper before changing a scene.
- Main-flow game UI must follow `daoyou-game-ui`: identity layer, task layer, and navigation layer stay separate.
- Do not add `InkPageShell` to game routes.
- Cross-route reusable UI belongs in `apps/web/src/components/feature/**`, `apps/web/src/components/ui/**`, or `apps/web/src/components/game-shell/**`; `apps/web/src/routes/game/**/components` is page-private.
- Reuse `apps/web/src/lib/resources` hooks/store, `fetchJsonCached`, `useTaskList`, and provider contexts before adding new page-level state.

## Data And Domain Rules

- Do not create parallel `src/db` or `apps/api/src/db`; DB entrypoints are `apps/api/src/lib/drizzle/db.ts` and `schema.ts`.
- The main Drizzle Kit flow manages only `wanjiedaoyou_*` business tables. `drizzle.auth.config.ts` independently manages the fixed `better_auth` schema.
- Nest `DatabaseModule` exposes the same Drizzle client through `DRIZZLE_DATABASE`; never create a second pool. `RuntimeService` closes `DatabaseService` only after draining requests and messaging.
- Pass `DbExecutor` / `DbTransaction` through write paths; do not open a fresh executor inside a transaction.
- Current equipment/items use `inventory_items` and `cultivator_equipment_slots`; personal manuals and beasts belong to the cultivator, while sect combat progression belongs to membership. See `daoyou-data-layer` for tables and ownership.
- Runtime DB access uses `pg.Pool` / node-postgres; use `runDbTasks` when a group of reads may run inside a transaction.
- Active V6 combat is Redis-authoritative; durable history uses `combat_replay_archives` / `combat_replay_participants`, with NATS-backed terminal/replay delivery.
- Character persistent state is `cultivators.condition`. Bag consumable facts (including `spec`) are stored in `inventory_items.instance_data`; residual old tables are not the V6 bag authority.
- Character permanent attributes remain vitality, strength, spirit, endurance, speed, willpower. Current projection is `projectCharacterToCombatV6`; display shares that V6 pipeline.
- V6 core must stay independent of rules/projection/content and must not import battle-v5 or creation-v2. Do not restore old ability/tag/product projection machinery for new V6 behavior.
- Legacy tables/types can remain without being current authorities. Check runtime callers and `docs/combat-v6-legacy-table-retirement.md` before migration/deletion; `/api/battle-records/*` is removed; do not restore legacy history routes.

## High-Risk Areas

- Client/server build separation, `apps/api/src/main.ts` startup/shutdown, runtime lifecycle and HTTP/WS configuration.
- Auth, ALTCHA, Better Auth schema, admin allowlist, and session cookie passthrough.
- LLM provider headers, prompt schemas, resource/reward/cost parsing, and metrics.
- Drizzle migrations, legacy tables, JSONB model shape, and transaction boundaries.
- `GameViewportLayout`, bottom dock/HUD/world-chat offset, and scene metadata.
- combat-v6 core/content/projection, `condition`, unified inventory, alchemy, market and resource updates.
- Redis CAS/occupancy locks, NATS/outboxes, terminal settlement, cron jobs, rankings and health-check behavior.

## Verification Checklist

- Testing has only two layers: pure `packages/shared/src` unit tests and Codex browser/Playwright simulations following `docs/testing.md`. Do not add one-off smoke, E2E, seed, benchmark, or fault-injection scripts.
- Local browser test accounts and their shared password are documented in `docs/testing.md` section 3. Reuse them; query the local database read-only to select existing accounts and characters instead of asking the user for known credentials again. Complete email verification through Mailpit and never apply these credentials or test writes to staging/production.

- Unit tests are forbidden under `apps/web/src` and `apps/api/src`; do not add `*.test.*` or `*.spec.*` files there.
- New unit tests are allowed only for pure, deterministic, reusable engine/domain logic under `packages/shared/src`.
- Do not write tests that exercise or mock databases, repositories, HTTP controllers, auth, Redis, LLM/SMTP providers, network APIs, or other third-party services.
- Frontend and backend changes must be verified with lint, typecheck/build, code inspection, and focused manual/runtime checks instead of unit tests.
- For eligible shared engine changes, pick focused tests first, then broader shared-engine checks if the blast radius is large.
- Run `pnpm run lint`, `pnpm run test`, or `pnpm run build` when code/config changes justify it.
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
