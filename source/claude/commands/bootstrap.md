---
# base_project:managed
description: Map the current project into graphify + repomix outputs.
---

Map the current project for token-efficient AI context:

1. Check this project's `.gitignore` for `graphify-out/` and `repomix-output.xml`. If either is missing, append
   it (create `.gitignore` if the project doesn't have one yet) — these are generated artifacts and must never
   be committed.
2. Run `repomix` and `graphify .` in the current directory.
3. If a command fails, follow these specific guides — do not just print the raw error:

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

   **graphify still says "no LLM API key found" after the key was set**: environment variables
   are read once, when a process starts — a key set after this session began is invisible to it,
   and re-running `/bootstrap` will never pick it up. Confirm that's the cause without ever
   printing the key itself (PowerShell — prints only True/False):
   `[bool][System.Environment]::GetEnvironmentVariable("GEMINI_API_KEY","User"); [bool]$env:GEMINI_API_KEY`
   First `True` + second `False` means the key is set correctly and only the process is stale:
   restart Claude Code, then re-run `/bootstrap`.

   **graphify fails with "the 'openai' package is required for this backend but is not installed"**
   (surfaces as `all semantic chunks failed for backend 'gemini'`): graphify is installed and the
   key works, but it was installed without the backend extra. Tell the user to run this in a
   terminal — it is an install command, so let them run it, do not run it yourself:
   `uv tool install "graphifyy[gemini]" --force`
   That is the fix for a `uv tool` install (confirm with `uv tool list`); for a pip/venv install
   it's `pip install openai` instead. Then re-run `/bootstrap`.

   **graphify fails with "fail-closed" warning only (no API key error)**: this is a stale-index
   warning, not a fatal error. Proceed normally — the graph was still updated.

   **Fallback when nothing above unblocks it**: `graphify . --code-only` builds the graph from the
   code files alone — local AST, no key, no backend package. Offer it, and state the cost plainly:
   every `.md` stays out of the graph and the communities keep placeholder names. In a docs-heavy
   repo that can mean losing most of the content, so it's a stopgap, not a substitute.
4. If `graphify-out/graph.json` exists but `graphify-out/graph.html` does not, run
   `graphify cluster-only .` — it generates `GRAPH_REPORT.md` and `graph.html` from the graph that
   already exists. `graphify .` alone does not always write the HTML.
5. If `graphify-out/graph.html` exists, open it in the default browser:
   - Windows: `Start-Process graphify-out/graph.html`
   - macOS: `open graphify-out/graph.html`
   - Linux: `xdg-open graphify-out/graph.html`
6. Report only: which artifacts were generated (`repomix-output.xml`, `graphify-out/`) and their
   status — including, when the graph is partial, how many files are actually in it.

$ARGUMENTS
