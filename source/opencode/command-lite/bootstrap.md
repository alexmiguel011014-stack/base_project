---
# base_project:managed
description: Map the current project into graphify + repomix outputs (lite). Syncs with the remote first.
---

Map the current project for token-efficient AI context.

STEP 1 — Sync the shared canonical `~/.agents/` first, separate from the project's own remote. If `~/.agents/` is a git repo (`test -d ~/.agents/.git`), run `node dev/scripts/sync.js pull` (fast-forward only). If it's not a git repo, skip this step. If `sync status` shows dirty/uncommitted canonical changes, note it and skip pulling — never stash or force.

STEP 2 — Sync this project's own remote (a different repo from step 1):
- Not a git repo, or no remote configured → skip, nothing to sync.
- `git status --porcelain` shows uncommitted changes → skip syncing, note it in the final report. Never stash or pull over dirty work.
- Otherwise `git fetch`, then compare local vs. upstream:
  - Up to date → continue.
  - Behind, fast-forward possible → `git pull` (plain, no `--rebase`/`--force`). If it fails or conflicts, stop and show the error exactly.
  - Ahead of remote, or diverged → don't touch it, note it in the final report.

STEP 3 — Check this project's `.gitignore` for `graphify-out/` and `repomix-output.xml`. Add whichever is missing (create `.gitignore` first if the project has none).

STEP 4 — Run `repomix` and `graphify .` in the current directory.

STEP 5 — If a command fails, use the matching guide below instead of printing the raw error:
- `repomix` not found → tell the user to run the base_project installer once, then re-run `/bootstrap`.
- `graphify` not found → same, run the installer, then re-run.
- `graphify` fails with "no LLM API key found" → the tool needs a key to process docs/images:
  1. Go to https://aistudio.google.com → "Get API key" (free, no credit card).
  2. Copy the key.
  3. Set it as a permanent environment variable in a terminal: PowerShell — `[System.Environment]::SetEnvironmentVariable("GEMINI_API_KEY", "YOUR_KEY_HERE", "User")`; macOS/Linux — add `export GEMINI_API_KEY=YOUR_KEY_HERE` to `~/.zshrc` or `~/.bashrc`.
  4. Open a new terminal.
  5. Re-run `/bootstrap`.
  Never paste the API key in chat — set it only in the terminal.
- Same error persists after the key was set → the running process started before the key existed and can't see it. Check without printing the key (PowerShell, prints only True/False): `[bool][System.Environment]::GetEnvironmentVariable("GEMINI_API_KEY","User"); [bool]$env:GEMINI_API_KEY`. `True` then `False` means restart the session, then re-run `/bootstrap`.
- `graphify` fails with "the 'openai' package is required..." → tell the user to run, in a terminal (an install command, don't run it yourself): `uv tool install "graphifyy[gemini]" --force` (for a `uv tool` install) or `pip install openai` (for pip/venv). Then re-run `/bootstrap`.
- `graphify` fails with a "fail-closed" warning only, no API key error → this is a stale-index warning, not fatal. Proceed normally.

STEP 6 — If `graphify-out/graph.json` exists but `graphify-out/graph.html` does not, run `graphify cluster-only .` to generate `GRAPH_REPORT.md` and `graph.html`.

STEP 7 — If `graphify-out/graph.html` exists, open it in the default browser: Windows — `Start-Process graphify-out/graph.html`; macOS — `open graphify-out/graph.html`; Linux — `xdg-open graphify-out/graph.html`.

STEP 8 — Report: the git sync result from step 2 (pulled N commits / already up to date / skipped-dirty / ahead / diverged), and which artifacts were generated and their status — including, if the graph is partial, how many files are actually in it.

$ARGUMENTS
