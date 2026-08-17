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
