# AGENTS.md

We are building an LLM Usage Metering & Billing Service.

See `docs/spec.md` for the spec if you need further clarification.
See `docs/architecture.md` for if you need a high-level overview of the system.

This repo is a an internship capstone.
Per the brief's ground rules (`docs/spec.md` §3, "AI-assisted building is encouraged, and owned"):
AI tools are welcome here, but every session using one has to leave an honest trail.

## Keep BUILDLOG.md current

Whenever an AI agent (you) makes a change to this repo on the user's behalf,
add or update an entry in `BUILDLOG.md` covering:

- **What the AI helped with** - the actual change, plainly stated.
- **Where the AI was wrong** - a bug it introduced, a bad assumption, a fix it had to walk back, or a user manually changing something. If nothing went wrong, say so rather than omitting the section.
- **What changed as a result** — the concrete fix or decision, not a vague "resolved it."

Do this in the same turn as the work, not as a separate cleanup pass later.

## Be honest, not flattering

Don't round errors up to "improvements" or bury a wrong turn in a chore commit.
Log real mistakes as mistakes, including ones only caught after being pointed out.

## Never fabricate evidence

`EVIDENCE.md` gets one pasted proof per Definition-of-Done checkbox (`docs/spec.md` §6):
real test output, a real curl transcript, a real log line.
Do not write evidence for something that wasn't actually run and verified.
