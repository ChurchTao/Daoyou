# Repository Guidelines

## Project Structure & Module Organization
- `app/`: Next.js App Router pages, layouts, and route handlers (`app/api/*`).
- `components/`: React components, including the Ink-style UI library under `components/ui/`.
- `engine/`: Core game logic (battle, effects, buff, creation, cultivator). This layer is framework-agnostic.
- `lib/`: Services, repositories, and infrastructure helpers (Drizzle, Supabase, Redis integrations).
- `config/`: System configuration such as buff templates.
- `types/` and `utils/`: Shared types and utility functions.
- `drizzle/`: Migration artifacts; schema lives under `lib/drizzle/`.
- `public/`: Static assets.

## Build, Test, and Development Commands
- `npm run dev`: Start the local Next.js dev server.
- `npm run build`: Production build.
- `npm run start`: Run the production server after build.
- `npm run lint`: ESLint checks.
- `npm run format`: Prettier formatting for code and docs.
- `npm test`: Run Jest tests (Node environment).
- `npx drizzle-kit push`: Push schema changes to the database.

## Coding Style & Naming Conventions
- TypeScript everywhere; prefer explicit, descriptive names.
- Prettier defaults: 2-space indent, single quotes, semicolons, 80-char print width.
- ESLint config is Next.js-based; fix lint warnings before PRs.
- Use `@/` path alias for root imports.
- Code comments and identifiers are English; UI content is Simplified Chinese.

## Testing Guidelines
- Jest is the test runner; tests live alongside modules.
- Naming: `*.test.ts` (examples in `engine/`, `utils/`, `lib/`).
- Add tests for engine logic and utility changes; keep test runtime under the global 10s timeout.

## Commit & Pull Request Guidelines
- Commit history suggests conventional style with optional emoji: `type(scope): summary`.
- Keep subjects short and imperative (e.g., `fix(battle): handle empty log`).
- PRs should include: a clear summary, linked issue (if any), and screenshots for UI changes.
- Note any schema changes and include migration steps when applicable.

## Security & Configuration Tips
- Copy `.env.example` to `.env.local` and populate secrets locally.
- Never commit API keys or database credentials.

## Agent-Specific Instructions
- See `CLAUDE.md` and `GEMINI.md` for deeper architecture and workflow notes.
