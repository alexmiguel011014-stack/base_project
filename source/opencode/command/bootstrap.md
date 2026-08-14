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

   **graphify fails with "fail-closed" warning only (no API key error)**: this is a stale-index
   warning, not a fatal error. Proceed normally — the graph was still updated.
4. If `graphify .` succeeded and `graphify-out/graph.html` exists, open it in the default browser:
   - Windows: `Start-Process graphify-out/graph.html`
   - macOS: `open graphify-out/graph.html`
   - Linux: `xdg-open graphify-out/graph.html`
5. Report only: which artifacts were generated (`repomix-output.xml`, `graphify-out/`) and their status.

$ARGUMENTS
