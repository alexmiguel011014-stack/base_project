---
# base_project:managed
description: Map the current project into graphify + repomix outputs. Syncs with the remote first (fast-forward pull only) so the map isn't built from a stale local state.
---

Map the current project for token-efficient AI context:

1. Sync with the remote first, so the map reflects the latest code, not a stale local
   state — this project's own remote, not base_project's (that's `/update`'s job, a
   different repo entirely):
   - If this isn't a git repo, or has no remote configured, skip this step — nothing to
     sync.
   - `git status --porcelain` — if there are uncommitted changes, skip syncing (never
     stash or pull over dirty work) and just note it in the final report.
   - Otherwise `git fetch`, then compare local vs. upstream:
     - Up to date: continue silently.
     - Behind, fast-forward possible: pull automatically (`git pull`, plain — no
       `--rebase`/`--force`). Bootstrap's whole point is accurate context, so a clean
       fast-forward doesn't need a confirmation prompt the way pushing would. If the pull
       fails or conflicts, stop and report it verbatim — never resolve automatically.
     - Ahead of remote, or diverged: don't touch it — that decision belongs to `/ship` (or
       the user's own merge/rebase). Just note it in the final report.
2. Check this project's `.gitignore` for `graphify-out/` and `repomix-output.xml`. If either is missing, append
   it (create `.gitignore` if the project doesn't have one yet) — these are generated artifacts and must never
   be committed.
3. Run `repomix` and `graphify .` in the current directory.
4. If a command fails, follow these specific guides — do not just print the raw error:

   **repomix not found**: tell the user to run the base_project installer (`install.ps1` /
   `install.sh`) once, then re-run `/bootstrap`.

   **graphify not found**: same — run the installer, then re-run `/bootstrap`.

   **graphify fails with "no LLM API key found"**: the tool is installed but needs a key to
   process documentation files (`.md`, images, etc.). Guide the user step by step:
   1. Go to https://aistudio.google.com → "Get API key" in the left menu (free, no credit card).
   2. Copy the key shown on screen.
   3. Set it as a permanent environment variable — run this in a terminal (PowerShell on Windows):
      `[System.Environment]::SetEnvironmentVariable("GEMINI_API_KEY", "YOUR_KEY_HERE", "User")`
      Or on macOS/Linux: add `export GEMINI_API_KEY=YOUR_KEY_HERE` to `~/.zshrc` or `~/.bashrc`.
   4. Open a new terminal (existing ones won't see the new variable).
   5. Re-run `/bootstrap`.
   ⚠️ Never paste the API key in this chat — set it only in the terminal yourself.

   **graphify fails with "fail-closed" warning only (no API key error)**: this is a stale-index
   warning, not a fatal error. Proceed normally — the graph was still updated.
5. If `graphify .` succeeded and `graphify-out/graph.html` exists, open it in the default browser:
   - Windows: `Start-Process graphify-out/graph.html`
   - macOS: `open graphify-out/graph.html`
   - Linux: `xdg-open graphify-out/graph.html`
6. Report: the git sync result from step 1 (pulled N commits / already up to date /
   skipped — dirty tree / ahead of remote / diverged), then which artifacts were
   generated (`repomix-output.xml`, `graphify-out/`) and their status.

$ARGUMENTS
