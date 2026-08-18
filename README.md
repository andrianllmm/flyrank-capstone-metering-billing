# Usage Metering & Billing Engine

Meters usage, enforces plan quotas, prices AI-token usage (cached input, reasoning tokens included), and syncs subscription state with Stripe via signature-verified, deduplicated webhooks.

## Architecture

**Metering + quota + cost**

```mermaid
flowchart LR
    Client -->|POST /generate| Meter[MeterService.record]
    Meter --> Quota[QuotaService]
    Quota -->|ok| Cost[CostService] --> DB[(Postgres)]
    Quota -->|over limit| Reject["429 / 402"]
```

**Usage rollup**

```mermaid
flowchart LR
    Client -->|GET /usage| Usage[usage route] --> DB[(Postgres)]
```

**Stripe checkout + webhooks**

```mermaid
flowchart LR
    Client -->|POST /billing/checkout| Checkout[billing route]
    Checkout --> StripeCheckout[Stripe Checkout]
    Checkout -->|persist customer id| DB[(Postgres)]

    Stripe -->|webhook event| Webhook[webhooks/stripe]
    Webhook -->|verify + dedupe| DB
```

## Setup

Prerequisites: Node.js 22+, pnpm, Docker.

```bash
pnpm install
cp .env.example .env
# fill in DATABASE_URL, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_ID_PRO
```

`STRIPE_PRICE_ID_PRO` needs a real test-mode Price from your Stripe dashboard, and the account needs a business name set before Checkout will work.

## Run

```bash
pnpm dev
```

## Seed

```bash
pnpm seed
```

Seeds 5 tenants, each with a plaintext API key you use as the bearer token:

| Tenant          | API key                    | State                             |
| --------------- | -------------------------- | --------------------------------- |
| Free Fresh      | `seed-free-fresh-key`      | Free plan, no usage yet           |
| Free Near Limit | `seed-free-near-limit-key` | Free plan, 999/1,000 calls used   |
| Free Over Limit | `seed-free-over-limit-key` | Free plan, 1,000/1,000 calls used |
| Pro             | `seed-pro-key`             | Pro plan, some usage              |
| Lapsed          | `seed-lapsed-key`          | Subscription canceled             |

## Try it

```bash
# make a billable call
curl -X POST http://localhost:3000/generate \
  -H "Authorization: Bearer seed-free-fresh-key" \
  -H "Idempotency-Key: try-1" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "hello"}'

# check usage/cost
curl http://localhost:3000/usage -H "Authorization: Bearer seed-free-fresh-key"

# push a near-limit tenant over the boundary -> 429
curl -X POST http://localhost:3000/generate \
  -H "Authorization: Bearer seed-free-near-limit-key" \
  -H "Idempotency-Key: try-2" \
  -d '{"prompt": "hello"}'

# lapsed subscription -> 402
curl -X POST http://localhost:3000/generate \
  -H "Authorization: Bearer seed-lapsed-key" \
  -H "Idempotency-Key: try-3" \
  -d '{"prompt": "hello"}'

# retry the same idempotency key -> same response, no new usage event
curl -X POST http://localhost:3000/generate \
  -H "Authorization: Bearer seed-free-fresh-key" \
  -H "Idempotency-Key: try-1" \
  -d '{"prompt": "hello"}'
```

## API docs

Interactive API docs are served at `/docs` once the server is running.

![API docs page](docs/images/api-docs-page.png)

## Test

```bash
pnpm test
```

## Lint & format

```bash
pnpm lint
pnpm format:check
```

## Limitations

- `MeterService.record` isn't safe under real concurrency: two simultaneous requests with the same idempotency key could both slip past the duplicate check before either writes. Sequential retries work fine, just not true concurrent ones.
- No invoicing, proration, or overage billing.
- AI token counts are simulated, no real model is called.
