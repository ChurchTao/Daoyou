---
name: daoyou-test-quality
description: Daoyou 测试、lint、typecheck、Vitest、ESLint、质量验证与失败排障 companion skill。Use when adding or fixing tests, selecting verification commands, changing Vitest/ESLint/TypeScript config, debugging test failures, or deciding how to validate frontend, backend, shared engine, data, auth, Redis, and build changes after using the owning domain skill.
---

# Daoyou Test Quality

This is a companion skill for choosing and running verification. For code changes, first use the domain skill that owns the code area, then use this skill to select tests and checks.

## Read First

- `package.json`
- `vitest.config.ts`
- `eslint.config.js`
- `tsconfig.json`
- `tsconfig.app.json`
- `tsconfig.node.json`
- The nearest `*.test.ts` / `*.test.tsx` files for the code being changed

## Commands

```bash
bun run lint
bun run test
bun run build
bun run check
```

Targeted Vitest examples:

```bash
bunx vitest run src/server/lib/llm/allowedHosts.test.ts
bunx vitest run src/shared/engine/battle-v5/tests
bunx vitest run src/react-app/lib/router/gameShellRegistry.test.ts
```

## Project Test Facts

- Vitest uses `environment: "node"`, `globals: true`, and `restoreMocks: true`.
- Test include patterns are `src/**/*.test.ts`, `src/**/*.spec.ts`, `src/**/*.test.tsx`, and `src/**/*.spec.tsx`.
- `bun run build` does not run tests; it runs TypeScript project build plus Vite builds.
- ESLint flat config relaxes `no-explicit-any` and `no-unused-vars` for tests and `__mocks__`.
- `tsconfig.app.json` excludes tests; `tsconfig.node.json` includes server, scripts, Vite, and Vitest config.
- There is no jsdom config by default. Prefer pure logic tests unless DOM behavior is truly required.

## Verification Selection

- Shared engine or rules: run the nearest shared tests, then `bun run test` if behavior is broad.
- Hono route or middleware: run the route test plus any service tests it depends on.
- Drizzle schema or persistence: run repository/service tests and consider `bun run build`.
- UI routing/layout: run router/layout tests such as `gameShellRegistry.test.ts`, `routeTitle.test.ts`, `loaders.test.ts`.
- LLM provider security: run `src/server/lib/llm/allowedHosts.test.ts` and any affected prompt/schema tests.
- Build or env config: run `bun run build`.
- Docs/skills only: inspect Markdown and `git diff`; full app tests are usually unnecessary.

## Test Patterns To Reuse

- API route tests should mock `requireUser`, `requireAdmin`, or `requireActiveCultivator` when they need an authenticated context.
- Hono validation should use existing `validateJson`, `validateQuery`, and middleware rather than hand-parsing.
- Shared rules often already have focused tests under `src/shared/engine/**/tests` or `src/shared/lib/*.test.ts`.

## Do Not

- Do not assume GitHub Actions is a quality gate; current workflow only builds and pushes an image.
- Do not add DOM tests without first accounting for the node test environment.
- Do not replace focused tests with only full-suite runs.
- Do not delete or weaken existing tests for unrelated dirty worktree changes.

## Verify

Always report which commands ran and which did not. If tests are skipped because the change is documentation-only, say that explicitly.
