# base_project:managed

Goal type: **Build** — a 0-to-100% stack plan for a project (new or existing) whose
deliverable is working software.

## When this type applies

The ask is "build/finish this project" — there's a stack (or one needs choosing), and the
result is running code: backend, frontend, database, deploy. Not: one broken behavior that
needs fixing (→ `fix.md`), a bounded addition to something that already works (→
`feature.md`), a non-code process/compliance goal (→ `process.md`), or a goal whose
deliverable is a document (→ `research.md`).

## Default owner

`coder` for every implementation item. `architect` only when an item is itself a sub-design
decision that needs its own plan before it can be written as checkable items (e.g. "choose
the auth strategy" is architect work; "implement `POST /auth/login`" is coder work once that
choice is made).

## Areas (skip whatever doesn't apply to this project's kind)

Skip what genuinely doesn't apply (a CLI tool has no frontend section) rather than padding
with boilerplate:

- **Backend**: language/framework choice and why, service structure, API design/style.
- **Frontend**: framework choice and why, state management, component/page structure.
- **Connectivity**: how frontend/backend/external services talk to each other —
  REST/GraphQL/RPC, third-party APIs the project will depend on, webhooks, real-time needs.
- **Database**: engine choice and why, schema shape at a high level, migration strategy.
- **Auth**: approach (session/token/OAuth/third-party), where it lives in the stack.
- **Deployment/infra**: where this runs, how it ships, environment/config strategy.
- **Testing**: what layers need coverage and with what tooling, given the stack chosen.
- **Security**: the basics from `project-standards.md` §8, plus anything stack-specific.

## Done-when convention

A command that passes or a behavior that's actually observed — never "the file exists" alone
unless the item's whole purpose is a static artifact (a config file, a `.gitignore` line).
Testing-area items are done only when the specific suite/assertion passes, not when a test
file has been written.

## Ordering rule

Real technical dependency: schema before the endpoint that reads/writes it, endpoint before
the frontend component that calls it, auth before any route it protects. `/newgoal` orders
items this way when writing `GOALS.md` — `/execgoals` doesn't re-derive it.

## Worked example

- [ ] Create `users` table schema (`id`, `email` unique, `password_hash`) — done when: migration
  runs clean against an empty database and the unique constraint is confirmed.
- [ ] `POST /auth/login` validates credentials against `users` — done when: correct
  credentials return 200 + token, incorrect return 401 (both asserted by a real test run).
