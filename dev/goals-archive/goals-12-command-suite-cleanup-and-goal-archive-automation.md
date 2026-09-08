# Archived plan — GOALS 12: Command Suite Cleanup & Goal-Archive Automation

> Status: completed. Archived from root `GOALS.md` on 2026-09-07.
> This body is a historical snapshot; keep it immutable and add future active work to root `GOALS.md`.

---

<a id="goals-12-command-suite-cleanup-and-goal-archive-automation-base_project-feature"></a>
## GOALS 12 — Command Suite Cleanup & Goal-Archive Automation (base_project feature)

Two independent, bounded changes to base_project's own command suite, written from a live
conversation rather than through a formal `/newgoal` research pass — the investigation (file
coupling for Area A, gap analysis for Area B) already happened inline in that conversation;
this section makes it executable per this project's own "plan ≠ execute" rule instead of
having been implemented ad hoc mid-discussion.

Suggested: sonnet · high — Area A is wide (many files) but mechanical; Area B adds real new
logic to `/execgoals` across 4 platform files. Neither is irreversible (everything is
git-tracked, nothing touches data outside this repo) — `opus`/`xhigh` is not warranted.

```mermaid
flowchart TD
    A1[A: delete newproject\ncommand/skill files] --> A2[A: strip references\nin docs + CI]
    A2 --> A3[A: simplify newgoal's\n"two ways this runs"]
    A3 --> A4[A: clean up repertoire's\nnewproject mention]
    B1[B: define archive trigger\nin execgoals] --> B2[B: wire into 4\nplatform files]
    B2 --> B3[B: refactor test's hardcoded\narchivedPlans list]
    A4 --> Verify[Tests: npm test/lint clean,\ngrep newproject = 0 hits\noutside history/archive]
    B3 --> Verify
    Verify --> Reg[Registration:\ndev/ROADMAP.md entry]
```

### Design rationale

- **Area A — remove `/newproject` from scope.** User doesn't use it; always calls `/newgoal`
  directly, which already self-serves the same starter questions when invoked standalone (its
  own step 1). Confirmed via live grep this touches far more than the command files themselves:
  `/newgoal` (all 3 non-codex platforms) describes "two ways this runs" — direct/narrated vs.
  silently dispatched by `/newproject` in the background — and `/repertoire` (all 3) has a
  one-line "if `/newproject`/`/newgoal` already established a project" context-reuse check.
  Removing `/newproject` without touching these leaves dangling references to a command that no
  longer exists — **not a strip-the-word fix**: `/newgoal`'s two-mode framing collapses to one
  mode (always direct/narrated, since nothing dispatches it silently anymore), and
  `/repertoire`'s check drops the `/newproject/` prefix, keeping the `/newgoal` half (it alone
  can still establish that context). `source/codex/skills/newgoal/SKILL.md` doesn't mention
  `/newproject` at all — no change needed there. Out of scope: `dev/ROADMAP.md`'s existing
  historical entries about `/newproject` (items 14, 24, 32) — append-only decision log, never
  rewritten; add one new dated entry recording the removal instead.
- **Area B — auto-archive completed `GOALS N` sections in `/execgoals`.** The
  `dev/goals-archive/` mechanism (checksum-tracked index, root `GOALS.md` holding only active
  plans) already exists — built once, by hand, in commit `ebb61e6`. Nothing currently repeats
  that automatically: `/execgoals` checks items `[x]` but never moves a fully-`[x]` section out
  of the root file. Without this, `GOALS.md` regrows over time and the token-economy goal of
  the archive mechanism erodes. **Found during investigation, worth fixing in the same pass**:
  `dev/tests/validate-goals-structure.test.js`'s `archivedPlans` array is a hand-maintained,
  hardcoded list of `[number, filename]` pairs — every future auto-archive write silently
  desyncs this test from the real `dev/goals-archive/README.md` unless the test itself is
  refactored to derive its expected list from that file's own table instead of a static array.
  Building B without B.3 just moves the manual-maintenance burden from "archive the section" to
  "remember to also update the test," which defeats the point.

### Implementation — Area A (remove `/newproject`)

- [x] **A.1 Delete the command/skill files** (`coder`) — `source/claude/commands/newproject.md`,
  `source/opencode/command/newproject.md`, `source/opencode/command-lite/newproject.md`,
  `source/codex/skills/newproject/` (whole directory). Verified deleted, staged as `D` in git.
- [x] **A.2 Strip references in docs + CI** (`coder`) — `README.md`, `ARCHITECTURE.md` (2 table
  rows + §4.1 reframed without `/newproject` as entry point), `.github/workflows/ci.yml` (4 file
  asserts **plus 2 count asserts found live**: Codex skill-count check 21→20, bash and
  PowerShell), `status.md` ×2, `command-menu.md` ×3, `project-standards.md` ×2 — all done.
  **Deliberately not touched**: `goal-types/research.md`'s `/newproject` mention — it's a
  worked example drawn from this project's own real history, not a live reference; editing it
  would rewrite history, same principle as not editing `dev/ROADMAP.md`'s past entries.
- [x] **A.3 Simplify `/newgoal`'s "two ways this runs"** (`coder`) — all 3 platform files
  (claude, opencode, opencode-lite) collapsed to one mode: always direct/narrated. Also cleaned
  the now-stale "direct-mode-only" caveats on the `/council`/`/repertoire` combo steps (4a/4b or
  STEP 5/6 depending on file) that referenced the now-removed background mode. Codex confirmed
  unaffected (no `/newproject` mention).
- [x] **A.4 Clean up `/repertoire`'s `/newproject` mention** (`coder`) —
  `source/claude/commands/repertoire.md:34`, `source/opencode/command/repertoire.md:34`,
  `source/opencode/command-lite/repertoire.md:12` — dropped the `/newproject/` prefix, kept the
  `/newgoal` half. Confirmed at execution: `source/codex/skills/repertoire/SKILL.md` has no
  `/newproject` mention — no change needed.
- [x] **A.5 Record the removal in `dev/ROADMAP.md`** (`coder`) — appended item 46, dated
  2026-09-07, per this project's own decision-log convention; existing history (items 14, 24,
  32) untouched.

### Implementation — Area B (auto-archive in `/execgoals`)

- [x] **B.1 Define the archive trigger** (`architect`) — decided: archive immediately on the
  triggering run, no separate confirmation — this is auto-approved/notify-and-proceed work
  (in-scope, reversible, repo-local), the same tier `/execgoals` already applies to ordinary
  edits.
- [x] **B.2 Wire the mechanism into all 4 `/execgoals` platform files** (`coder`) — done in
  `source/claude/commands/execgoals.md`, `source/opencode/command/execgoals.md`,
  `source/opencode/command-lite/execgoals.md` (confirmed it exists as its own file),
  `source/codex/skills/execgoals/SKILL.md`. **Verified with a live dry run**, not just trusted
  as written: built a scratch `GOALS.md` with one fully-`[x]` module and a stub archive
  `README.md`, then executed exactly the steps this instruction describes — extracted the
  section, wrote it to `goals-99-dry-run-module-test.md`, computed its SHA-256, appended the
  README row, stripped the section and its "Active plans" entry from the root file. Output
  matched the design exactly (see scratch dir under this session's scratchpad).
- [x] **B.3 Refactor `dev/tests/validate-goals-structure.test.js`'s `archivedPlans`** (`coder`)
  — replaced the hardcoded array with `loadArchivedPlans()`, parsing
  `dev/goals-archive/README.md`'s own table.
- [x] **B.4 Refactor the same test file's active-plan-count assertion** (`coder`) — replaced
  the hardcoded `1`/`[8]` with `loadActivePlanNumbers()`, parsing `GOALS.md`'s own "## Active
  plans" list, and asserting it matches the actual `## GOALS N —` headings. **2 more hardcoded
  `21`s found live while re-running tests**, same class of bug, not originally listed here:
  `dev/tests/codex.test.js:75` and `:161` (Codex skill-count parity checks) — fixed to `20`
  alongside this item since they're the same "removed a skill, a hardcoded count didn't know"
  root cause as CI's own 21→20 fix in A.2.

### Tests

- [x] **Area A verification** — `npm run lint`/`npm run typecheck` clean; `grep -ri newproject`
  across the repo returns zero hits outside `dev/ROADMAP.md`'s historical entries,
  `dev/goals-archive/`'s archived bodies, and `goal-types/research.md`'s worked example (all
  untouched by design) plus stale `graphify-out/` (gitignored, regenerates on next
  `/bootstrap`).
- [x] **Area B verification** — live dry run (see B.2) confirmed the mechanism produces correct
  output. **Verification limit, stated honestly**: this is prompt/instruction text, not
  executable code — no unit test can prove a future `/execgoals` run actually follows it end to
  end inside a real session; same class of limit GOALS 8 already named for H.3. What's verified:
  the described steps produce correct output when followed exactly; what's not: an actual live
  `/execgoals` invocation triggering this path unprompted on a real completed module.
- [x] **Full suite** — `npm test`: **107/107** (recovered from the 106/107 B.4 introduced).
  `npm run lint`/`npm run typecheck` clean.

### Registration

- [x] **Update `dev/ROADMAP.md`** (`coder`) — item 46 (see A.5) covers both areas, landed
  together.

