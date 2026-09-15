@AGENTS.md

# Cookwise — working notes for agents

- Read `docs/ARCHITECTURE.md` (contracts, folder ownership, conventions) and `docs/SCREENS.md` (mockup spec) before changing anything. `src/lib/types.ts` is the domain model; the Supabase migration mirrors it.
- Stack: Next.js 16 App Router (Turbopack), React 19, TypeScript strict, Tailwind v4 tokens in `src/app/globals.css`, Zustand + Dexie (local-first), optional Supabase sync, optional Gemini routes under `src/app/api/ai/*`, optional Python service in `ml/`.
- Verify with `npx tsc --noEmit`, `npm run lint`, `npm test` (vitest), and `npm run build`.
- Several `next dev` instances can run side by side: `COOKWISE_DIST_DIR=.next-agent-x npx next dev -p 31xx`.
- Use design tokens (`bg-primary`, `text-text-2`, `bg-green-100`, …), never raw hex, and the primitives in `src/components/ui` (see `docs/UI_KIT.md`).
- Store API and hydration pattern: `docs/DATA_LAYER.md`. Engine formulas: `docs/ENGINES.md`.
