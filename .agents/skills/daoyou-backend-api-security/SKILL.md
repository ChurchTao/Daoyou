---
name: daoyou-backend-api-security
description: Daoyou Hono API、认证、授权、Better Auth、ALTCHA、admin、internal cron、LLM header 安全和服务端输入校验指南。Use when adding or modifying src/server routes, middleware, auth, admin endpoints, cron/internal endpoints, shared contracts, LLM provider handling, API validation, or security-relevant frontend auth/admin loaders in this repo. For ordinary admin pages, navigation, and UI state, use daoyou-frontend-routing-state.
---

# Daoyou Backend API Security

## Read First

- `src/server/app.ts`
- `src/server/routes/api/index.ts`
- `src/server/routes/internal/cron.router.ts`
- `src/server/lib/hono/middleware.ts`
- `src/server/lib/auth/auth.ts`
- `src/server/lib/auth/hono.ts`
- `src/server/utils/aiClient.ts`
- `src/shared/config/llm.ts`
- `src/shared/config/llmRouting.ts`
- `src/shared/contracts`

## API Boundary Facts

- API server is Hono.
- `/api/auth/*` is handled by Better Auth through `src/server/lib/auth/hono.ts`.
- `jsonError()` handles Zod errors and uncaught API errors for `/api/*` and `/internal/*`, but auth is registered before that middleware.
- Frontend route loaders are UX guards only. Backend handlers are the security boundary.
- Existing auth middleware:
  - `requireUser()` for logged-in users.
  - `requireActiveCultivator()` for logged-in users with an active cultivator; it sets `user`, `cultivator`, and `executor`.
  - `requireAdmin()` for `ADMIN_EMAILS` allowlist.
  - `validateJson()` and `validateQuery()` for Zod parsing.
- Admin subroutes currently apply `requireAdmin()` explicitly inside handlers.
- `/internal/cron/*` uses `Authorization: Bearer ${CRON_SECRET}`, not user sessions. In production, missing `CRON_SECRET` returns 500.

## LLM Security Facts

- The browser patches `window.fetch` in `src/react-app/main.tsx` to add `x-llm-api-key` and `x-llm-model` headers for `/api/` requests.
- Server LLM calls should use `src/server/utils/aiClient.ts` (`generateAiText`, `streamAiText`, `generateAiObject`, `generateAiArray`) so provider resolution, metrics, structured output, and retry behavior stay in one path.
- Server-side `LLM_PROVIDER` is a route table: `provider[/model][:weight],...`. It covers one or many providers and one or many models. Multiple routes are sticky by user id hash on the full `provider + model`. BYOK request config still wins and does not enter the split. Read/parse in `src/shared/config/llmRouting.ts`; `aiClient.ts` only maps env and picks.
- Server accepts request-level BYOK only when provider, API key, and model pass `src/shared/config/llm.ts`; partial or invalid configuration returns 400 without falling back to the server key.
- DeepSeek calls use the official provider endpoint. Do not accept a request-level provider or Base URL.
- LLM metrics use in-memory fallback plus Redis key `admin:llm-metrics:events:v1`; do not add a parallel metrics store.
- Prompt files under `src/server/prompts/*.md` have `id:` headers. New prompt scenes usually also need `LlmSceneId`, caller `sceneId`, and schema/constraint updates.
- Treat LLM output as untrusted input. Numeric state changes need Zod bounds and service/resource-layer guards.
- `docs/llm-security-defense.md` contains useful historical risk analysis, but parts are stale relative to current code.

## External Service Facts

- Redis access must go through `src/server/lib/redis`; do not instantiate `new Redis()` in feature code.
- Redis is not optional for many runtime paths even though health-check reports `disabled` when `REDIS_URL` is absent.
- SMTP mail uses `src/server/lib/admin/smtp.ts`; required env includes `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and `MAIL_FROM`.

## Workflow

1. Classify the endpoint: public, logged-in, active-cultivator, admin, or internal cron.
2. Reuse the existing middleware. Do not hand-roll session parsing.
3. Add or reuse Zod schemas for request bodies and query strings.
4. Register new API routes in `src/server/routes/api/index.ts`; register internal jobs in `src/server/routes/internal`.
5. If the route changes shared request/response shape, update `src/shared/contracts` or `src/shared/types`.
6. If the route calls LLM or consumes LLM output, check prompt/schema bounds and service-layer guards.
7. If adding a prompt scene, update prompt id, `LlmSceneId`, caller `sceneId`, and schema/constraint together.
8. Verify server behavior with lint/build, code inspection, and focused manual/runtime checks; do not add route/service/provider tests.

## Do Not

- Do not rely on React loaders for authorization.
- Do not bypass `src/server/lib/auth/hono.ts` for login, signup, reset, OTP, or ALTCHA-protected flows.
- Do not add admin files under `/api/admin` without explicit admin authorization.
- Do not add provider or Base URL request headers; use the validated DeepSeek configuration from the Hono context.
- Do not make public list/ranking/community endpoints private without checking frontend/product usage.
- Do not assume `src/shared/api` exists; shared contracts live under `src/shared/contracts`.
- Do not bypass `aiClient.ts` for LLM calls.
- Do not create feature-local Redis clients or SMTP transports.

## Verify

- Route/middleware changes: run lint/build and inspect middleware registration and responses manually.
- Auth changes: run lint/build and manually check cookie/header behavior when relevant.
- LLM provider changes: run lint/build and inspect allowlist/validation behavior without provider tests.
- Cron changes: verify secret behavior for production and non-production assumptions with focused runtime checks.
