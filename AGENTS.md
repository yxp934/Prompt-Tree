# Repository Guidelines

This repository contains the product, technical, API, and roadmap docs for an AI chat client that models conversations as a node-based DAG (tree + branches) with an explicit “Context Box”.

## Project Structure & Module Organization

- `需求文档.md`: Product requirements and UX/interaction principles.
- `TECHNICAL_DESIGN.md`: Architecture, data model, and implementation approach.
- `API_DESIGN.md`: Store/services/component API contracts (TypeScript).
- `ROADMAP.md`: Phased delivery plan and acceptance criteria.
- `原型图.jpg`: UI prototype reference.

App code lives in `ai-chat-client/` and should follow this layout:
- `ai-chat-client/src/app/`: Next.js App Router entrypoints.
- `ai-chat-client/src/components/`: UI components (`tree/`, `chat/`, `context/`, `layout/`).
- `ai-chat-client/src/lib/`: Services and hooks (`services/`, `db/`, `hooks/`).
- `ai-chat-client/src/store/`: Zustand store and slices.
- `ai-chat-client/src/types/`: Shared TypeScript types (Node/Tree/Context).
- `ai-chat-client/src/__tests__/` (or `ai-chat-client/tests/`): Unit/integration tests.

## Build, Test, and Development Commands

Run commands from `ai-chat-client/`:
- `npm run dev`: Run locally (default: http://localhost:3000).
- `npm run build`: Production build (uses Webpack via `next build --webpack`).
- `npm run start`: Run the production server after build.
- `npm run test`: Run unit/integration tests (Vitest).
- `npm run test:coverage`: Run tests with coverage (thresholds enforced in `ai-chat-client/vitest.config.ts`).
- `npm run lint`: Lint checks (ESLint).
- `npm run format`: Format with Prettier.
- `npm run typecheck`: TypeScript typecheck.

## Coding Style & Naming Conventions

- Language: TypeScript (strict mode); avoid `any` (prefer `unknown`).
- Indentation: 2 spaces; prefer single responsibility modules under `src/lib/services/`.
- Naming:
  - Components: `PascalCase` (e.g., `ContextPanel.tsx`).
  - Hooks: `useXxx` (e.g., `useTree.ts`).
  - Services: `XxxService.ts` (e.g., `compressionService.ts`).

## Testing Guidelines

- Target: >80% coverage for core services (DB wrapper, node/tree/context services).
- Naming: `*.test.ts` / `*.test.tsx` placed in `src/__tests__/` (or alongside the module).

## Commit & Pull Request Guidelines

- Commit messages follow Conventional Commits:
  - `feat: ...`, `fix: ...`, `docs: ...`, `refactor: ...`, `test: ...`, `chore: ...`
- PRs should include:
  - Clear description + linked issue (if any)
  - Screenshots/GIFs for UI changes (tree/canvas/context dock)
  - Notes on storage/schema changes (IndexedDB versioning/migrations)

## Security & Configuration Tips

- Never commit API keys; store locally (env var or browser storage per implementation).
- Treat exported conversation data as sensitive; avoid logging raw content in production.
