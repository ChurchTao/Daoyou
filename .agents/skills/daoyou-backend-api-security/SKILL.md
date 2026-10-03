---
name: daoyou-backend-api-security
description: Daoyou NestJS API、认证、授权、Better Auth、ALTCHA、admin、internal cron、LLM header 安全和服务端输入校验指南。Use when adding or modifying apps/api/src controllers, guards, middleware, auth, admin endpoints, cron/internal endpoints, shared contracts, LLM provider handling, API validation, or security-relevant frontend auth/admin loaders in this repo. Does not cover ordinary page styling or navigation.
---

# Daoyou Backend API Security

## Read First

- `apps/api/src/main.ts` and `app.module.ts`
- `apps/api/src/config/configuration.module.ts`, `runtime.config.ts`, and `lib/config/environment.ts`
- `apps/api/src/http/configure-http.ts`
- `apps/api/src/runtime/internal-cron.controller.ts` and `internal-cron.guard.ts`
- `apps/api/src/auth/access.guard.ts` and `session.service.ts`
- `apps/api/src/lib/auth/auth.ts`
- `apps/api/src/lib/auth/handler.ts`
- `apps/api/src/utils/aiClient.ts`
- `packages/shared/src/config/llm.ts`
- `packages/shared/src/config/llmRouting.ts`
- `packages/shared/src/contracts`

## Configuration and Workspace Boundary

- API builds with `nest build` (Nest CLI 12 default tsc, NodeNext ESM); shared builds first with tsc and exports dist JavaScript/declarations; Web builds with Vite. API lint uses Oxlint with type-aware Promise checks and import boundaries; Web/shared/tools retain ESLint. API may import `@daoyou/shared/*`, never Web; shared cannot import either host. LLM generators and prompt rendering belong in `apps/api/src/lib/generation`.
- Nest services inject `AppConfigService`; independent libraries read `getRuntimeEnvironment()`. The snapshot is validated once with Zod; dotenv discovery is disabled. Never log credential values on validation failure.
- `DatabaseModule` exports the existing Drizzle client, preserving one pool and transaction propagation. Runtime closes it after request/message drain.

## API Boundary Facts

- API server is NestJS 12 on Node.js 24 with Express and native ws. Legacy Hono entrypoints, routes and dependencies have been removed; do not reintroduce a compatibility router.
- `/api/auth/*` is handled by Better Auth through `apps/api/src/lib/auth/handler.ts`.
- `ApiExceptionFilter` handles uncaught API errors; route-specific filters and Zod pipes preserve existing response contracts. Better Auth uses its raw Node handler before business body parsing.
- Frontend route loaders are UX guards only. Backend handlers are the security boundary.
- Existing auth boundary:
  - Global `AccessGuard` requires login unless `@Access('public')` is declared.
  - `@Access('active')` resolves `user` / `activeCultivatorRef` through `SessionService`; it does not hydrate a full cultivator or inject a DB executor.
  - `@Access('admin')` uses `adminAccess.ts` (`ADMIN_USER_IDS` or legacy `ADMIN_EMAILS`); `account-admin` requires configured user ID authorization.
  - `JsonBody` reads raw bytes in its first Pipe after guards, then passes parsed JSON to validation pipes. Keep its parameter factory synchronous: Nest 12 does not await a factory's Promise before the first Pipe. The reader does not inflate content-encoding; the business ceiling is 128 MiB and the webhook's independent limit is 256 KiB. `FirstQuery` reads the original URL without a 1,000-key truncation: query objects keep the first decoded key, named reads prefer a literal key over encoded aliases, and malformed UTF-8 escapes remain intact. Express query parsing is disabled; use `FirstQuery` for business queries. Zod pipes retain the intended 400 versus legacy-unhandled 500 behavior.
- Inspect each admin controller's access metadata; do not assume a filename or frontend loader supplies authorization. Use explicit constructor `@Inject` because the API TypeScript configuration disables implicit design-type metadata. API/shared relative imports name emitted `.js` files; JSON imports use `with { type: 'json' }`. Nest CLI assets copy Markdown prompts; the registry reads them once at module initialization.
- Keep `NotFoundModule` last in `AppModule.imports`: its fallback controllers preserve authorization for unknown paths in previously protected namespaces, after every concrete feature route. Do not broaden these fallbacks to all API or admin paths.
- `/internal/cron/*` uses `Authorization: Bearer ${CRON_SECRET}`, not user sessions. In production, missing `CRON_SECRET` returns 500.

## LLM Security Facts

- Browser API calls use `apiFetch` from `apps/web/src/lib/api/fetch.ts` to add `x-llm-provider`, `x-llm-api-key` and `x-llm-model` headers for `/api/` requests.
- Server LLM calls should use `apps/api/src/utils/aiClient.ts` (`generateAiText`, `streamAiText`, `generateAiObject`, `generateAiArray`) so provider resolution, metrics, structured output, and retry behavior stay in one path.
- Server-side `LLM_PROVIDER` is a route table: `provider[/model][:weight],...`. It covers one or many providers and one or many models. Multiple routes are sticky by user id hash on the full `provider + model`. BYOK request config still wins and does not enter the split. Read/parse in `packages/shared/src/config/llmRouting.ts`; `aiClient.ts` only maps env and picks.
- Server accepts request-level BYOK only when provider, API key, and model pass `packages/shared/src/config/llm.ts`; partial or invalid configuration returns 400 without falling back to the server key.
- Request provider IDs are allowlisted in `packages/shared/src/config/llm.ts`; adapters/endpoints are owned by `apps/api/src/lib/llm/providers.ts`. Do not accept arbitrary request Base URLs.
- LLM metrics use in-memory fallback plus Redis key `admin:llm-metrics:events:v1`; do not add a parallel metrics store.
- Prompt files under `apps/api/src/prompts/*.md` have `id:` headers. New prompt scenes usually also need `LlmSceneId`, caller `sceneId`, and schema/constraint updates.
- Treat LLM output as untrusted input. Numeric state changes need Zod bounds and service/resource-layer guards.

## V6 Authority and Mutation Boundaries

- Start with `apps/api/src/combat` and mode-specific feature modules, `packages/shared/src/contracts/combatV6*.ts`, and `apps/api/src/combat/application`.
- Resolve the actor from `activeCultivatorRef`; derive combat attributes, equipment, manuals and beasts server-side through `CombatV6BuildService.ts`. Client commands do not authorize client-supplied combat units, results or rewards.
- Preserve session ownership/participant checks, `expectedRevision` validation, legal-command queries and Redis CAS. Spectator and replay views must retain their existing visibility checks.
- State changes use the owning service's mutation/occupancy guards, transaction and resource response path (`CommandExecutors.ts`, `ResourceMutationResponse.ts`, `InventoryService.ts`). Check mode-specific exceptions such as dungeon recovery before reusing a blanket combat lock.
- Terminal settlement and replay archival run through `apps/api/src/runtime/messaging/combatV6Messaging.ts` and V6 projectors. Retain retry/idempotency semantics; do not introduce direct route settlement alongside consumers.
- `/api/battle-records/*` is a 410 retirement endpoint; do not restore V5 battle handlers for new V6 history features.

## External Service Facts

- Redis access must go through `apps/api/src/lib/redis`; do not instantiate `new Redis()` in feature code.
- Production requires `REDIS_URL`; readiness fails unless Redis is up. Non-production may omit Redis for limited tooling, but must not report game readiness.
- NATS access uses `apps/api/src/lib/nats`; Nest `RuntimeService` owns shared messaging startup and shutdown. Drain handlers and pending publications before closing database/Redis. Health checks include Redis, NATS and message infrastructure.
- Native WS upgrades bypass Express: `RealtimeAdapter` owns API admission, response headers and pending-handshake tracking; feature services own identity and connection quotas. Preserve individual Set-Cookie headers on both successful and rejected handshakes.
- SMTP mail uses `apps/api/src/lib/admin/smtp.ts`; required env includes `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and `MAIL_FROM`.

## Workflow

1. Classify the endpoint: public, logged-in, active-cultivator, admin, or internal cron.
2. Reuse the existing guards and `SessionService`. Do not hand-roll session parsing.
3. Add or reuse Zod schemas for request bodies and query strings.
4. Register controllers in feature modules imported by `apps/api/src/app.module.ts`; internal jobs belong to the runtime module and shared job services. Keep repositories and pure domain logic independent of Nest.
5. If the route changes shared request/response shape, update `packages/shared/src/contracts` or `packages/shared/src/types`.
6. If the route calls LLM or consumes LLM output, check prompt/schema bounds and service-layer guards.
7. If adding a prompt scene, update prompt id, `LlmSceneId`, caller `sceneId`, and schema/constraint together.
8. Verify server behavior with lint/build, code inspection, and focused manual/runtime checks; do not add route/service/provider tests.

## Do Not

- Do not rely on React loaders for authorization.
- Do not bypass `apps/api/src/lib/auth/handler.ts` for login, signup, reset, OTP, or ALTCHA-protected flows.
- Do not add admin files under `/api/admin` without explicit admin authorization.
- Use the validated `llmConfig` from request context / framework-independent AsyncLocalStorage and configured provider adapters; do not bypass the provider allowlist or introduce a client Base URL. Singleton services must not store request identity or BYOK credentials in fields.
- Do not make public list/ranking/community endpoints private without checking frontend/product usage.
- Do not assume `packages/shared/src/api` exists; shared contracts live under `packages/shared/src/contracts`.
- Do not bypass `aiClient.ts` for LLM calls.
- Do not create feature-local Redis clients or SMTP transports.

## Verify

- Route/middleware changes: run lint/build and inspect middleware registration and responses manually.
- Auth changes: run lint/build and manually check cookie/header behavior when relevant.
- LLM provider changes: run lint/build and inspect allowlist/validation behavior without provider tests.
- Cron changes: verify secret behavior for production and non-production assumptions with focused runtime checks.
