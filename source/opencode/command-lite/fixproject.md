---
# base_project:managed
description: Fix the findings from /scanproject or /cleanproject (lite). Runs the scan if none exists, then applies fixes and re-verifies each one.
---

Fix the issues found by `/scanproject` and/or `/cleanproject`. Verify each fix directly — never assume a patch worked just because it applied.

 ### Batching and stopping
- Batch independent reads and checks, reuse evidence already gathered, and validate once at each area boundary. Stop after the scoped work is verified complete or a real blocker requires user input; do not speculate, retry blindly, or continue into unrelated work. Never use batching or stopping to bypass plan or safety boundaries.


STEP 1 — If $ARGUMENTS names which findings to focus on (e.g. "just the security ones"), use only those. Otherwise fix everything reported.

STEP 2 — Run `/scanproject` and/or `/cleanproject` first, whichever matches. If one already ran in this same conversation and the project hasn't changed since, reuse those findings — otherwise re-run. For a `/cleanproject` finding that moves a file, update every import/reference to the old path in the same pass, not as a follow-up.

STEP 3 — For each finding, ordered critical first:
- Plan the fix. A trivial fix (missing `.gitignore` line, missing `.env.example`) applies directly. Anything bigger, plan then implement.
- Never silently skip a finding. If a fix needs a decision only the user can make, ask instead of guessing.

STEP 4 — After applying fixes, re-check each one directly: re-run the lint/test/audit command, re-read the file. Do not mark a finding resolved from the shape of the edit alone.

STEP 4a — CDP mode. If the current `/fixproject` invocation arguments contain a standalone, case-insensitive token `cdp`, `/cdp`, `$cdp`, or `--cdp`, inspect only those arguments for a match; never scan `GOALS.md` or project files. Say once that CDP mode is on for this invocation, read `~/.config/opencode/base_project/references/cdp-verification.md` in full before verifying the first finding, and apply it to every finding with a browser-reachable UI. Report a finding as fixed only with the CDP evidence that reference defines. For a finding without a browser-reachable UI, say `cdp: not applicable` and verify it as usual. Without a matching token, never start a browser with a debug port.

STEP 5 — Report per finding: fixed / skipped (with reason) / needs user input (with the question). Don't claim the project is clean unless every critical and medium finding is actually resolved and re-verified.

STEP 6 — Never commit automatically. If fixes are ready, offer to prepare a commit message and wait for confirmation.

$ARGUMENTS
