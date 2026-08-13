---
# base_project:managed
description: Fix the findings from /scanproject or /cleanproject. Runs the scan if none exists yet, then applies fixes and re-verifies each one.
---

Fix the issues found by `/scanproject` and/or `/cleanproject`, with real before/after
verification — not just applying a patch and assuming it worked.

1. If `$ARGUMENTS` isn't empty, treat it as a description of which findings to focus on
   (e.g. "just the security ones", "just the reorganization"); otherwise fix everything
   reported by whichever of the two commands ran.

2. Run `/scanproject` and/or `/cleanproject` first, whichever matches what the user
   asked to fix (or reuse findings if one of them was a direct continuation of a scan
   just run in this same conversation — do not silently trust a scan from a much earlier
   point in a long conversation; re-run if there's any doubt the project state has
   changed since). For `/cleanproject` findings that involve moving a file, treat the
   move itself as the fix — update every import/reference to the old path in the same
   pass, not as a follow-up.

3. For each finding, ordered critical first:
   - Plan the fix. For anything beyond a trivial one-line change, use `@architect`
     first, then `@coder` to apply it — same workflow as any other non-trivial change.
     Trivial fixes (add a missing `.gitignore` line, create a missing `.env.example`)
     can be applied directly.
   - Never silently skip a finding. If a fix requires a decision only the user can make
     (e.g. "no test framework configured — which one do you want?"), ask instead of
     guessing.

4. After applying fixes, re-check each one directly (re-run the lint/test/audit command,
   re-read the file) — do not mark a finding resolved from the shape of the edit alone.
   This mirrors `@reviewer`'s 4-gate verification (exists / substantive / wired /
   behavioral proof): a fix "exists" as a diff, but isn't done until the same check that
   originally flagged it now passes.

5. Report per finding: fixed / skipped (with reason) / needs user input (with the
   question). Do not claim the project is "clean" unless every critical and medium
   finding is actually resolved and re-verified.

6. Never commit automatically — if fixes are ready, mention that `@reviewer` can prepare
   a commit message, same as any other change, but wait for explicit confirmation.

$ARGUMENTS
