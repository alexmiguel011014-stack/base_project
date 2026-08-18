# base_project:managed

Goal type: **Fix** — a specific, reproducible bad behavior in something that otherwise works,
needs correcting.

## When this type applies

The ask names a concrete symptom: a crash, a wrong output, a command that fails under some
condition. Not: a capability that doesn't exist yet (→ `feature.md`), a full stack that needs
building (→ `build.md`), or something structural/organizational (→ `process.md`). If you
cannot state the current (wrong) behavior and the expected (right) behavior in one sentence
each, the goal isn't scoped enough to be `fix` yet — narrow it first.

## Default owner

`coder`, using the same repro → root cause → fix → regression-test discipline `/fixproject`
already applies to its own findings. Never patch the symptom without identifying why it
happens — a fix item that can't state its root cause is not ready to write.

## Areas

Repro (how to reliably trigger the bad behavior), Root cause (why it happens — the actual
mechanism, not a guess), Fix (the change itself, scoped to the root cause), Regression test
(proves the bug is gone and stays gone).

## Done-when convention

The regression test is the gate, not the fix itself: a test that reproduces the bug must fail
before the fix and pass after. A `fix`-type item without an accompanying regression test is
not done — it's a patch that can silently regress later. This mirrors the real bug found and
fixed in `install.sh` in this project's own history (Area C, GOALS 2): the fix wasn't trusted
until a fresh install was actually run and shown to succeed, twice, with the real dependency
(`jq`) present.

## Ordering rule

Repro and root cause always come before the fix line in the same item — never write "fix X"
without first establishing what X actually is. Independent bugs have no inherent order between
each other unless one fix depends on another (rare) — order by severity/blast-radius instead
when there's no technical dependency.

## Worked example

- [ ] Repro: fresh install (no pre-existing `settings.json`) crashes `install.sh` with
  `cat: ... No such file or directory`. Root cause: `BASE_SETTINGS` computed in memory but
  never written to disk before the next block's blind re-read. Fix: write it to disk
  immediately after computing it. Done when: a fresh install against a scratch `$HOME`
  succeeds and a second run stays idempotent, verified with the real dependency present (not
  a path where `jq` is silently missing and skips the buggy branch).
