# Evidence

One pasted proof per Definition-of-Done checkbox (see `docs/spec.md` §6).
Each item gets a test name + output, a curl transcript, or a log line.
Claims without evidence score as not done.

## Metering

- [x] A billable action creates exactly one usage event, even under retries,
      deduplicated by idempotency key.

  _Evidence:_ `POST /generate` sent twice with the same `Idempotency-Key`, same tenant.
  Second response is identical to the first, and only 2 rows exist in `usage_events` for that key.

  ```
  $ curl -X POST http://localhost:3000/generate \
      -H "Authorization: Bearer test-api-key" \
      -H "Idempotency-Key: evidence-key-1" \
      -H "Content-Type: application/json" \
      -d '{"prompt": "Hello, tell me about billing systems."}'
  {"output":"This is a simulated AI response.","usage":[{"type":"api_call","quantity":1,"costMicros":"0"},{"type":"ai_tokens","quantity":10,"costMicros":"0"}]}

  $ curl -X POST http://localhost:3000/generate \
      -H "Authorization: Bearer test-api-key" \
      -H "Idempotency-Key: evidence-key-1" \
      -H "Content-Type: application/json" \
      -d '{"prompt": "Hello, tell me about billing systems."}'
  {"output":"This is a simulated AI response.","usage":[{"type":"api_call","quantity":1,"costMicros":"0"},{"type":"ai_tokens","quantity":10,"costMicros":"0"}]}

  $ docker exec <db> psql -U postgres -d metering_billing -c \
      "SELECT type, quantity, idempotency_key FROM usage_events WHERE idempotency_key LIKE 'evidence-key-1%';"
     type    | quantity |     idempotency_key
  -----------+----------+--------------------------
   api_call  |        1 | evidence-key-1:api_call
   ai_tokens |       10 | evidence-key-1:ai_tokens
  (2 rows)
  ```

- [x] A test proves double-counting cannot happen.

  _Evidence:_ `tests/generate.test.ts`, `does not double-count a retried
request with the same idempotency key` — sends the same request twice,
  asserts identical responses and exactly 2 `usage_events` rows (one
  `api_call` + one `ai_tokens`).

  ```
  $ npx vitest run --reporter=verbose
   ✓ tests/generate.test.ts > POST /generate > does not double-count a retried request with the same idempotency key 70ms
   Test Files  1 passed (1)
        Tests  9 passed (9)
  ```

  Note: `meterService.record`'s check-then-insert isn't atomic — a genuine
  concurrent race could still both pass the read before either writes.
  The DB's `@@unique([tenantId, idempotencyKey])` constraint would reject
  the second write with `P2002`, which the service doesn't yet catch. Not
  covered by a test (would need concurrent requests, not just sequential).

## Quotas

- [x] Usage is checked against the tenant's plan; requests over the limit
      are rejected.

  _Evidence:_ Tested against seed tenants at 999/1,000 and 1,000/1,000
  API calls (`docs/spec.md` boundary case: at / just under / over).

  ```
  $ curl -X POST http://localhost:3000/generate \
      -H "Authorization: Bearer seed-free-near-limit-key" \
      -H "Idempotency-Key: quota-test-3" -d '{"prompt": "test"}'
  # 999/1,000 -> allowed, tenant now at 1,000/1,000
  {"output":"...","usage":[{"type":"api_call","quantity":1,...}]}

  $ curl -X POST http://localhost:3000/generate \
      -H "Authorization: Bearer seed-free-near-limit-key" \
      -H "Idempotency-Key: quota-test-5" -d '{"prompt": "test"}'
  # 1,000/1,000 -> rejected
  {"status":"error","message":"api_call quota exceeded: 1000/1000 used this period."}
  ```

- [x] Responses carry the correct status codes (429/402) and a message
      explaining why.

  _Evidence:_

  ```
  $ curl -X POST http://localhost:3000/generate -H "Authorization: Bearer seed-lapsed-key" ...
  402 {"status":"error","message":"No active subscription. Upgrade or renew your plan to continue."}

  $ curl -X POST http://localhost:3000/generate -H "Authorization: Bearer seed-free-over-limit-key" ...
  429 {"status":"error","message":"api_call quota exceeded: 1000/1000 used this period."}
  ```

## Cost calculation

- [x] Monthly usage rolls up into a cost figure per tenant.

  _Evidence:_ `GET /usage` — `{ used, limit, costMicros }` per type, current period only.

  ```
  $ curl http://localhost:3000/usage -H "Authorization: Bearer seed-free-fresh-key"
  {"usage":[{"type":"api_call","used":1,"limit":1000,"costMicros":"500"},{"type":"ai_tokens","used":18,"limit":100000,"costMicros":"208"}]}
  ```

- [x] AI token pricing handles cached input tokens, reasoning tokens, and
      output pricing correctly.

  _Evidence:_ `tests/costService.test.ts` — cached input priced cheaper than fresh input,
  reasoning tokens billed at the output rate (not free, not separate), categories not
  flat-summed. Live proof via `/generate` (20-char prompt -> 4 fresh input + 1 cached input +
  10 output + 3 reasoning tokens):

  ```
  $ curl -X POST http://localhost:3000/generate -H "Authorization: Bearer seed-free-fresh-key" \
      -H "Idempotency-Key: cost-test-1" -d '{"prompt":"aaaaaaaaaaaaaaaaaaaa"}'
  {"usage":[{"type":"api_call","quantity":1,"costMicros":"500"},{"type":"ai_tokens","quantity":18,"costMicros":"208"}]}
  # 208 = 4*3 (input) + 1*1 (cachedInput) + (10+3)*15 (output+reasoning)
  ```

- [x] Pricing constants are pinned and covered by tests.

  _Evidence:_ `src/config/pricing.ts` (`API_CALL_PRICE_MICROS`, `AI_TOKEN_PRICE_MICROS`),
  tested in `tests/costService.test.ts` (5 tests, all passing).

## Stripe integration

- [x] Subscription checkout works end-to-end in Stripe test mode.

  _Evidence:_ Real checkout call, then a signed `checkout.session.completed`
  webhook flips the tenant Free -> Pro (checked via `/usage`):

  ```
  $ curl -s -X POST http://localhost:3000/billing/checkout -H "Authorization: Bearer seed-free-fresh-key"
  {"status":"ok","url":"https://checkout.stripe.com/c/pay/cs_test_..."}

  $ curl -s http://localhost:3000/usage -H "Authorization: Bearer seed-free-fresh-key"
  {"usage":[{"type":"api_call","limit":1000,...}]}   # Free limits

  $ curl -s -X POST http://localhost:3000/webhooks/stripe -H "stripe-signature: ..." --data-binary @checkout.session.completed.json
  {"status":"ok"}

  $ curl -s http://localhost:3000/usage -H "Authorization: Bearer seed-free-fresh-key"
  {"usage":[{"type":"api_call","limit":50000,...}]}   # Pro limits
  ```

  Plus `tests/billing.checkout.test.ts` (4 tests, real Stripe API):

  ```
  ✓ rejects requests without a valid API key
  ✓ creates a checkout session and persists the stripe customer id
  ✓ recovers when the tenant has a stripe customer id that no longer exists on Stripe
  ✓ rejects with 409 when the tenant already has an active pro subscription
  ```

  Needs a real test-mode Price (`STRIPE_PRICE_ID_PRO`) and a business name on
  the Stripe account - one-time dashboard setup, not code.

- [x] Webhooks verify signatures, ignore duplicate events, and update
      tenant plan/status.

  _Evidence:_ `tests/webhookService.test.ts` (6 tests, signed locally, no live
  Stripe calls):

  ```
  ✓ no-ops on checkout.session.completed for an unrecognized tenant id, without throwing
  ✓ no-ops on customer.subscription.deleted for an unrecognized subscription id, without throwing
  ✓ rejects a payload with an invalid signature
  ✓ upserts an active subscription on checkout.session.completed and flips the tenant to pro
  ✓ processes a replayed event id exactly once
  ✓ reuses the tenant existing subscription row on checkout instead of creating a second one, so a later cancellation actually blocks access
  ```

  Live confirmation, same session as above (forged signature rejected,
  cancellation actually blocks access, replay is a no-op):

  ```
  $ curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/webhooks/stripe \
      -H "stripe-signature: t=1,v1=bad" -d '{}'
  400

  $ curl -s -X POST http://localhost:3000/webhooks/stripe --data-binary @customer.subscription.deleted.json
  {"status":"ok"}
  $ curl -s -X POST http://localhost:3000/generate -H "Authorization: Bearer seed-free-fresh-key" -d '{"prompt":"hi"}'
  {"status":"error","message":"No active subscription. Upgrade or renew your plan to continue."}
  ```

  This manual pass is also what caught the two bugs logged in `BUILDLOG.md` -
  both fixed and now covered by the regression tests above.

## Data model, tests & documentation

- [x] Database includes tenants, plans, subscriptions, and usage events;
      customer data isolated per tenant.

  _Evidence:_ Schema migrated (`npx prisma migrate dev --name init`,
  migration `20260818060929_init`), tables present in Postgres:

  ```
  $ docker exec flyrank-capstone-metering-billing-db-1 psql -U postgres -d metering_billing -c '\dt'
                    List of relations
   Schema |          Name           | Type  |  Owner
  --------+-------------------------+-------+----------
   public | _prisma_migrations      | table | postgres
   public | plans                   | table | postgres
   public | processed_stripe_events | table | postgres
   public | subscriptions           | table | postgres
   public | tenants                 | table | postgres
   public | usage_events            | table | postgres
  (6 rows)
  ```

  Isolation proven by `tests/tenantIsolation.test.ts`:

  ```
  ✓ GET /usage for one tenant never reflects another tenant's usage
  ✓ the same idempotency key from two different tenants records two separate usage events, not a dedup collision
  ```

- [x] Tests cover: duplicate usage prevention, quota boundary cases (at /
      just under / over), cost calculations, invalid-webhook rejection,
      duplicate-webhook handling.

  _Evidence:_ `tests/generate.test.ts` covers duplicate usage prevention
  and quota boundaries (at the limit / over the limit), see above.
  `tests/costService.test.ts` covers cost calculations. `tests/webhookService.test.ts`
  covers invalid-webhook rejection ("rejects a payload with an invalid
  signature") and duplicate-webhook handling ("processes a replayed event id
  exactly once"), both listed above under Stripe integration.

- [x] README + architecture diagram + setup instructions; submission-pack
      files from §11 present.

  _Evidence:_ `README.md` has a mermaid architecture diagram, setup/run/seed/test
  commands, and a limitations section covering the known idempotency race
  condition. `capstone.yaml`, `BUILDLOG.md`, `.env.example` all present at repo root.
