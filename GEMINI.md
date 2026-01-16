# WanJieDaoYou Project Context

## Project Overview

**万界道友 (daoyou.org)** is an open-source, AIGC-driven, text-based cultivation game framework. It aims to provide a "cultivation universe skeleton" that allows for high-freedom gameplay combined with strict numerical and battle models.

- **Type:** Web Application (Next.js)
- **Core Concept:** Text-based interface (`Ink` style), AI-generated content (stories, battles), and a rigorous cultivation system.
- **Goal:** To create a platform where players can shape characters via text and AI provides immersive feedback, all grounded in a balanced game engine.

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS + PostCSS
- **Database:** PostgreSQL (Supabase)
- **ORM:** Drizzle ORM
- **Cache/Queue:** Upstash Redis
- **AI Integration:** `@ai-sdk/deepseek`, `@ai-sdk/openai`, `ai` (Vercel AI SDK)
- **Testing:** Jest

## Project Structure & Architecture

### Key Directories

- **`app/`**: Next.js App Router structure. Contains pages, layouts, and API routes.
  - `(auth)/`, `(main)/`, `(info)/`: Route groups for different layouts.
  - `api/`: Backend API endpoints.
- **`components/`**: UI components.
  - `ui/`: Reusable basic UI elements.
  - `cultivator/`, `dungeon/`, `battle/`: Feature-specific components.
- **`engine/`**: Core game logic (Independent of UI).
  - `battle/`: Battle engine implementation.
  - `cultivation/`: Cultivation mechanics.
  - `creation/`: Character creation logic.
- **`lib/`**: Utilities and infrastructure.
  - `drizzle/`: Database connection (`db.ts`) and schema definition (`schema.ts`).
  - `services/`: Business logic services.
  - `utils/`: General helper functions.
- **`drizzle/`**: Database migration files.
- **`.qoder/`**: Project documentation and knowledge base.

### Architecture Patterns

- **Separation of Concerns:**
  - **Engine:** Pure logic, handles complex calculations (battles, breakthroughs).
  - **Service:** Connects API/UI to Engine and Data layers.
  - **Repository (inferred):** Data access layer (Drizzle queries).
- **AI Integration:** Used for generating dynamic content (stories, battle logs) but constrained by game rules.

## Development Workflow

### Key Commands

- **Start Development Server:** `npm run dev`
- **Build for Production:** `npm run build`
- **Start Production Server:** `npm run start`
- **Run Tests:** `npm test`
- **Lint Code:** `npm run lint`
- **Format Code:** `npm run format` (Prettier)
- **Database Schema Push:** `npx drizzle-kit push` (Updates DB schema)

### Environment Setup

Requires a `.env.local` file with configuration for:
- OpenAI / DeepSeek API keys.
- Supabase (PostgreSQL) URL and Anon Key.
- Upstash Redis credentials.
*Refer to `ENV_SETUP.md` for details.*

## Development Conventions

- **Path Aliases:** Use `@/` to refer to the project root (e.g., `@/lib/utils`).
- **Styling:** Use Tailwind CSS utility classes. Follow the existing "Ink" (water-ink) aesthetic.
- **Database:**
  - Define schema in `lib/drizzle/schema.ts`.
  - Tables are prefixed with `wanjiedaoyou_` (configured in `drizzle.config.ts`).
  - Use Drizzle Kit for migrations.
- **AI Usage:** AI is used to enhance the narrative, not to determine game mechanics (combat results are calculated by the engine).
- **Language:** The codebase uses English for variable names/comments but the game content and UI are in Simplified Chinese.

## Documentation

Detailed internal documentation is located in `.qoder/repowiki`, covering:
- Battle System
- Character System
- Database Schema
- API Design
