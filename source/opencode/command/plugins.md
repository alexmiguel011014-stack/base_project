---
# base_project:managed
description: Recommend and install optional plugins from the base_project catalog.
---

Analyze the current project and help the user pick optional plugins from the base_project catalog.

1. Read the catalog at `~/.config/opencode/base_project/plugins.json`. If it's missing, tell the user to
   run the base_project installer (`install.ps1` / `install.sh`) once, then stop.

2. Inspect the current project (package.json, requirements.txt, pyproject.toml, .env, folder structure,
   any `supabase/` folder, `*.sqlite`/`*.db` files, etc.) and evaluate each catalog entry's
   `recommend_if` condition against what you actually find — don't recommend blindly.

3. Present a short summary: which entries are recommended for this specific project and why, and which
   others exist in the catalog but weren't recommended. Then ask the user which ones to install — offer
   "just the recommended ones", "recommended + pick more from the list", or "none".

4. IMPORTANT — opencode has no per-project MCP scoping (unlike Claude Code's `--scope local`). State this
   explicitly before adding anything: any `mcp` entry the user accepts is added to the GLOBAL
   `~/.config/opencode/mcp.json` and becomes available in EVERY opencode project from then on, not just
   this one. Let the user decline if they don't want that.
   - `mcp` entries: read `~/.config/opencode/mcp.json`, add the entry under `mcpServers` using the
     catalog's `opencode` block as-is (command, args, and `env` if present — this is a full JSON merge,
     so nothing needs reconstructing) — ask for `requires_input` values first (e.g. Supabase's
     project-ref and access token) and substitute them into the args/env before writing, then save the
     file back.
   - `cli` entries: run the entry's `install` command once, globally on the machine.
   - `skill` entries without `manual: true`: run the entry's `opencode` install command.
   - If an entry has `"manual": true` or no `opencode` block, it isn't something to auto-execute here —
     say so and point the user at the entry's `source` link instead of guessing an action.
   - If an entry is `claude_only: true`, say it isn't available for opencode and skip it.

5. If an entry's install block has a `note` field, treat it as a required extra step (e.g. a follow-up
   copy/registration action), not optional color — carry it out too.

6. Never write any file inside the current project's repository.

7. Report only: what was installed (and, for MCP entries, that it's now global), what was skipped, and
   any follow-up needed (e.g. setting an access token).

$ARGUMENTS
