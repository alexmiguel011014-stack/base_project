---
# base_project:managed
description: Recommend and install optional plugins from the base_project catalog.
---

Analyze the current project and help the user pick optional plugins from the base_project catalog.

1. Read the catalog at `~/.config/opencode/base_project/plugins.json`. If it's missing, tell the user to
   run the base_project installer (`install.ps1` / `install.sh`) once, then stop.

2. If `$ARGUMENTS` names a key present in the catalog's top-level `profiles` object (e.g. `minimal`,
   `design`, `full`), skip the recommendation step entirely: the plugin set is just that profile's id
   list resolved against `catalog`. Confirm the resolved list with the user in one line, then go straight
   to step 4. If `$ARGUMENTS` names something that isn't a known profile, say so and fall back to the
   normal interactive flow below instead of guessing.

3. Otherwise (no profile requested): inspect the current project (package.json, requirements.txt,
   pyproject.toml, .env, folder structure, any `supabase/` folder, `*.sqlite`/`*.db` files, etc.) and
   evaluate each catalog entry's `recommend_if` condition against what you actually find — don't
   recommend blindly. Present a short summary: which entries are recommended for this specific project
   and why, and which others exist in the catalog but weren't recommended. Then ask the user which ones
   to install — offer "just the recommended ones", "recommended + pick more from the list", "a named
   profile instead (list the ones from `profiles`)", or "none".

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

7. Lightweight pre-trust scan for third-party `skill`-kind entries only (not `mcp`/`cli`): if
   `~/.claude/base_project/scripts/scan-skill.js` exists and the entry's install command downloads files
   locally (e.g. `npx skills add` clones into `~/.agents/skills/<name>/` or
   `~/.config/opencode/skills/<name>/`), run `node ~/.claude/base_project/scripts/scan-skill.js
   <downloaded-path>` against the resulting directory right after install, before telling the user it's
   ready to use. Advisory only (a handful of high-signal patterns, not a full audit): show findings
   verbatim and let the user decide; never auto-delete anything. If the script is missing, skip silently.

8. Report only: what was installed (and, for MCP entries, that it's now global), what was skipped, any
   scan findings from step 7, and any follow-up needed (e.g. setting an access token).

$ARGUMENTS
