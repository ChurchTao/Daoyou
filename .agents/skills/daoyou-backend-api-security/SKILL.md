---
name: daoyou-backend-api-security
description: Daoyou NestJS 请求边界、认证授权和 LLM 安全。修改控制器、中间件、请求解析、认证入口、管理权限、内部任务、实时握手或 LLM 提供方时使用。普通页面样式与导航不触发。
---

# Daoyou Backend API Security

Follow the affected controller or transport entrypoint through its guard, parser and owning application service. Paths below are relative to `apps/api/src` unless specified. Read the relevant section below and the shared API and verification rules in [AGENTS.md](../../../AGENTS.md).

## HTTP, identity and authorization

- `auth/access.guard.ts` defaults to `user`. Choose `@Access('public' | 'user' | 'active' | 'admin' | 'account-admin')` based on the endpoint. `active` supplies only an `activeCultivatorRef` in addition to the user. Check ownership where a service reads or mutates a resource. `admin` accepts `ADMIN_USER_IDS` or legacy `ADMIN_EMAILS`, while `account-admin` requires `ADMIN_USER_IDS`.
- Keep login, signup, password reset, OTP and ALTCHA flows in `lib/auth/handler.ts`. Run Better Auth's raw Node handler before business body parsing. Preserve individual `Set-Cookie` headers in HTTP guards and both accepted and rejected native WebSocket handshakes. `realtime/realtime.adapter.ts` owns upgrade admission and pending handshakes. Feature services own identity and connection quotas.
- Use `http/json-body.ts` for business JSON. Keep its parameter factory synchronous because Nest passes a factory's return value to the first pipe without awaiting it. Read raw bytes in that pipe after guards. The reader leaves content encoding untouched. Business bodies have a 128 MiB limit and the webhook has a separate 256 KiB limit.
- Use `http/first-query.ts` for business queries. It reads the original URL with Express query parsing disabled, avoiding Express's 1,000-key cap. Query objects keep the first decoded key, named reads prefer a literal key over encoded aliases, and malformed UTF-8 escapes are preserved. Preserve each route's existing parse and validation error contract.
- Keep `NotFoundModule` last in `AppModule.imports` so concrete routes win. Keep authorization fallbacks limited to their existing namespaces.
- Internal HTTP jobs use `@Access('public')` with `InternalCronGuard`, which checks the Bearer secret when configured. Missing `CRON_SECRET` fails production startup validation. Non-production without a configured secret allows the request.

## LLM requests and jobs

- The Web `apps/web/src/lib/api/fetch.ts` attaches stored BYOK headers only to the configured API. `http/configure-http.ts` validates all three values with the provider allowlist in `@daoyou/contracts/llm/config`. Reject partial or invalid BYOK with 400 before provider selection. Keep credentials request-scoped and endpoints owned by `lib/llm/providers.ts`. Reject arbitrary client Base URLs.
- Use `utils/aiClient.ts` for generation, streaming and structured output. Keep metrics in `lib/llm/metricsStore.ts`. Valid BYOK takes precedence over server routing. Server selection uses `lib/llm/tiers.ts` for scene grouping and `@daoyou/contracts/llm/routing` for both route tables. An unset advanced table falls back to the basic table. See [development configuration](../../../docs/development.md#ai-能力) for settings.
- Define prompt templates in `apps/api/src/prompts/*.md`, render through `lib/prompts`, and keep scene orchestration in the owning feature. When adding a prompt scene, check its `id` header, `LlmSceneId`, caller and output schema together.
- Treat model output as untrusted. Bound state-changing numbers in the schema and guard them at the service or resource boundary. Route unattended generation through `isBackgroundLlmEnabled()` and follow the explicit-run requirement in [AGENTS.md](../../../AGENTS.md).

## Combat and runtime boundaries

- Build combat units server-side from the authenticated actor through `combat/application/CombatV6BuildService.ts`. Preserve participant checks, visibility rules, legal commands, `expectedRevision` and Redis CAS. Use the owning mutation flow and check mode-specific exceptions such as dungeon recovery before reusing an occupancy lock.
- Keep terminal settlement and replay archival in `runtime/messaging/combatV6Messaging.ts` and the projectors. Preserve retry and idempotency semantics across delivery.
- Use `lib/redis`, `lib/nats` and `lib/admin/smtp.ts` for shared infrastructure. Runtime drains request and messaging work before closing database and Redis connections. Production requires `REDIS_URL`. Readiness requires an active Redis connection, including in non-production.

## Verify the changed boundary

Run lint and build, then follow [the local verification procedure](../../../docs/testing.md) for affected behavior. Check auth cookies or WS admission when changing session handling, valid and invalid BYOK when changing provider validation, and configured and unconfigured secret behavior when changing cron access. For request adapters and mutations, submit the complete client payload through the local route and check committed values and subsequent resource reads.
