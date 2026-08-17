# Evidence

One pasted proof per Definition-of-Done checkbox (see `docs/spec.md` §6).
Each item gets a test name + output, a curl transcript, or a log line.
Claims without evidence score as not done.

## Metering

- [ ] A billable action creates exactly one usage event, even under retries,
      deduplicated by idempotency key.

  _Evidence:_ TODO

- [ ] A test proves double-counting cannot happen.

  _Evidence:_ TODO

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

  _Evidence:_ TODO

- [ ] Tests cover: duplicate usage prevention, quota boundary cases (at /
      just under / over), cost calculations, invalid-webhook rejection,
      duplicate-webhook handling.

  _Evidence:_ TODO

- [ ] README + architecture diagram + setup instructions; submission-pack
      files from §11 present.

  _Evidence:_ TODO
