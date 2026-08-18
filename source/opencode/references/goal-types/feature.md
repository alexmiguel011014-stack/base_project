# base_project:managed

Goal type: **Feature** — a bounded new capability added to something that already works,
without rebuilding the stack around it.

## When this type applies

The ask is "add X to the existing project" where X is scoped and additive — a new command, a
new endpoint, a new field — not a rewrite and not the first version of the whole system. Not:
the project doesn't exist yet or needs its stack decided (→ `build.md`), something is broken
(→ `fix.md`), or the ask is organizational/non-code (→ `process.md`).

## Default owner

`architect` first if the feature's shape isn't already obvious (how it fits the existing
structure, what it touches) — then `coder` for the scoped implementation once that's settled.
Skip the `architect` pass only when the shape really is a one-line, no-design-decision change.

## Areas

Design rationale (why this shape, what it touches, what it deliberately doesn't do — an
explicit "out of scope" line prevents scope creep mid-implementation), Implementation, Tests
(new behavior needs new coverage, not just "existing tests still pass"), Registration (if this
project ships user-facing commands/hooks: menu entry, status listing, `dev/ROADMAP.md` —
whatever this repo's own convention for "a new thing exists" requires, so the feature is
actually discoverable, not just present in source).

## Done-when convention

The feature is done when it's used the way a user would use it, not just when its code exists
— for a command, that means it's registered everywhere a user would look for it (this
project's own convention: menu, `/status`, both engines), not only present in
`source/*/commands/`.

## Ordering rule

Design rationale before implementation (a feature written before its shape is settled tends to
need rework). Registration items always come last — nothing to register until the thing being
registered actually works.

## Worked example

- [ ] Design: `/designreview` reuses `ReportFindings`'s existing shape instead of inventing a
  new report format — done when: the design decision is written down before any file exists.
- [ ] New files: `source/claude/commands/designreview.md` + `source/opencode/command/`
  mirror — done when: both files exist and both engines can invoke the command.
- [ ] Registration: `command-menu.md` (both engines), `status.md`, `dev/ROADMAP.md` — done
  when: all three actually mention it, checked directly, not assumed from the PR diff.
