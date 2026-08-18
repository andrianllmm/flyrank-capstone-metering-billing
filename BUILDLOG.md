# Build Log

An honest record of where AI helped, where it was wrong, and what got changed as a result.

Per the brief's ground rules (§3): "The AI wrote it" is not an answer at the demo,
so this log has to be specific enough to explain any 2-3 lines an evaluator points at.

## 2026-08-18 - Project scaffold

**AI helped:** Set up the Node.js + TypeScript + pnpm project (`package.json`,
`tsconfig.json`, layered folder structure), matching the brief's §10 stack.

**AI was wrong:** `pulled in a new version of TypeScript by
default, which `typescript-eslint` doesn't support yet.

**Changed:** Pinned `typescript`.

## 2026-08-18 - Design doc

**AI helped:** drafted `architecture.md` (Phase 1 design doc).

**Changed:** refined data model and simplified auth.

## 2026-08-18 - Health check endpoints

**AI helped:** Added `GET /health` (liveness) and `GET /health/db`
(readiness).

**AI was wrong:**

1. First wired the Prisma client by importing straight out of
   `node_modules`. Caught it before committing and moved the generator output to `src/generated/prisma` convention Prisma 7 actually documents.
2. Assumed `new PrismaClient()` would work with just `DATABASE_URL`
   in `.env`. Prisma 7 requires an explicit driver adapter now.

**Changed:** Generator output path, the Prisma client import, and the driver adapter dependency.

## 2026-08-18 - Prisma schema

**AI helped:** Drafted `prisma/schema.prisma` directly from the ERD already.

**AI was wrong:** First wrote `url = env("DATABASE_URL")` which is the Prisma 6 pattern.

**Changed:** Removed `url` from the `datasource` block.
