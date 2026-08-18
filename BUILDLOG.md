# Build Log

An honest record of where AI helped, where it was wrong, and what got changed as a result.

Per the brief's ground rules (§3): "The AI wrote it" is not an answer at the demo,
so this log has to be specific enough to explain any 2-3 lines an evaluator points at.

## 2026-08-18 - Project scaffold

**AI helped:** Set up the Node.js + TypeScript + pnpm project (`package.json`,
`tsconfig.json`, layered folder structure), matching the brief's §10 stack.

**AI was wrong:** Pulled in a new version of TypeScript by
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

## 2026-08-18 - Metering: `/generate` route, idempotency

**AI helped:** Scaffolded the repository, service, and route.
Wrote the `hashApiKey` helper.

**AI was wrong:**

1. It did not use explicit types.
2. It only recorded `ai_tokens` usage, not `api_call` usage.
3. It did not take a dynamic input like `prompt` into account for dynamic token counts.

**Changed:** Used types from Prisma client and defined our own. Recorded `api_call` usage.
Added `prompt` to the input, and used it to calculate token counts with a simple heuristic.

## 2026-08-18 - Seed script

**AI helped:** Wrote `prisma/seed.ts` Wired it up via `prisma.config.ts`'s `migrations.seed`
and a `pnpm seed` script.

**AI was wrong:** First draft redefined `hashApiKey` locally in the seed
script instead of importing the existing helper.

**Changed:** Imported the existing `hashApiKey` helper instead of
duplicating it.

## 2026-08-18 - Quota enforcement

**AI helped:** Scaffolded the repository, service, and route.
Wired quota checks into `/generate` before metering.

**AI was wrong:** Some stylistic issues, but nothing critical.

## 2026-08-18 - API docs + Zod schemas

**AI helped:** Added OpenAPI docs (`zod-to-openapi` + Scalar) at `/docs`,
backed by real Zod schemas for `/generate` in `src/schemas/`.

**AI was wrong:** Docs first covered unimplemented endpoints too.
No Zod at first, so docs and validation could drift.
Schemas colocated in `routes/` instead of their own layer.
Server URL was hardcoded to `localhost`, then "fixed" to still hardcode `localhost` with just the port from env.

**Changed:** Docs scoped to `/generate` only.
Route and docs share one Zod schema.
Schemas moved to `src/schemas/`.
Server URL now reads `BASE_URL` from env.

## 2026-08-18 - Test setup + /generate coverage

**AI helped:** Set up Vitest + Supertest against the real app and Docker Postgres, with fixtures
that create and clean up their own tenant/plan/subscription rows. Covered `/generate`: validation,
idempotency, quota boundaries, lapsed subscription.

**AI was wrong:** Nothing to report this pass.

**Changed:** 9 tests passing.
