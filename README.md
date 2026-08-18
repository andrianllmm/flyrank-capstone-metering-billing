# Usage Metering & Billing Engine

A backend service that meters usage, enforces plan quotas, calculates costs (including AI-token pricing rules),
and syncs subscription state with Stripe via signature-verified, deduplicated webhooks.

## Setup

Prerequisites: Node.js 22+, pnpm, Docker.

```bash
pnpm install
cp .env.example .env
# fill in DATABASE_URL, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET in .env
```

## Run

```bash
pnpm dev
```

## Seed

```bash
pnpm seed
```

## Test

```bash
pnpm test
```

## Lint & format

```bash
pnpm lint
pnpm format:check
```
