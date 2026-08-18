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

- [ ] A test proves double-counting cannot happen.

  _Evidence:_ Proven manually above (curl transcript), but not yet as an
  automated test. `meterService.record` checks `findByIdempotencyKey`
  before inserting, backed by the DB's `@@unique([tenantId,
idempotencyKey])` constraint as the real enforcement mechanism — but
  there's no Vitest/Supertest test asserting this yet, and the check-then-
  insert isn't atomic (a genuine concurrent race could still both pass the
  read before either writes; the DB unique constraint would reject the
  second write with `P2002`, which the service doesn't yet catch). Pending
  the metering test slice.

## Quotas

- [ ] Usage is checked against the tenant's plan; requests over the limit
      are rejected.

  _Evidence:_ TODO

- [ ] Responses carry the correct status codes (429/402) and a message
      explaining why.

  _Evidence:_ TODO

## Cost calculation

- [ ] Monthly usage rolls up into a cost figure per tenant.

  _Evidence:_ TODO

- [ ] AI token pricing handles cached input tokens, reasoning tokens, and
      output pricing correctly.

  _Evidence:_ TODO

- [ ] Pricing constants are pinned and covered by tests.

  _Evidence:_ TODO

## Stripe integration

- [ ] Subscription checkout works end-to-end in Stripe test mode.

  _Evidence:_ TODO

- [ ] Webhooks verify signatures, ignore duplicate events, and update
      tenant plan/status.

  _Evidence:_ TODO

## Data model, tests & documentation

- [ ] Database includes tenants, plans, subscriptions, and usage events;
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

  Every `usage_events` and `subscriptions` row carries `tenant_id` FK; not
  yet checked off pending a test that proves cross-tenant isolation at the
  query layer.

- [ ] Tests cover: duplicate usage prevention, quota boundary cases (at /
      just under / over), cost calculations, invalid-webhook rejection,
      duplicate-webhook handling.

  _Evidence:_ TODO

- [ ] README + architecture diagram + setup instructions; submission-pack
      files from §11 present.

  _Evidence:_ TODO
