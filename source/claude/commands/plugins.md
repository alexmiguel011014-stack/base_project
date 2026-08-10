---
# base_project:managed
description: Recommend and install optional plugins from the base_project catalog for THIS project.
---

Analyze the current project and help the user pick optional plugins from the base_project catalog.

1. Read the catalog at `~/.claude/base_project/plugins.json`. If it's missing, tell the user to run the
   base_project installer (`install.ps1` / `install.sh`) once, then stop.

2. Inspect the current project (package.json, requirements.txt, pyproject.toml, .env, folder structure,
   any `supabase/` folder, `*.sqlite`/`*.db` files, etc.) and evaluate each catalog entry's
   `recommend_if` condition against what you actually find — don't recommend blindly.

3. Present a short summary: which entries are recommended for this specific project and why, and which
   others exist in the catalog but weren't recommended. Then ask the user which ones to install — offer
   "just the recommended ones", "recommended + pick more from the list", or "none".

4. For each plugin the user accepts, install it according to its `kind` and flags:
   - If the entry has `"manual": true` (e.g. skill-ui), it can't be run as a shell command — its
     `claude.instruction` is something the user has to type themselves inside an active Claude Code
     session (like a `/plugin install ...` slash command). Print that instruction verbatim and tell the
     user to run it themselves; do not attempt to execute it via Bash.
   - `mcp` entries: run `claude mcp add --scope local <id> --env KEY=VALUE ... -- <command> <args...>`
     from the entry's `claude` block (`command`/`args`), adding one `--env KEY=VALUE` flag per key in the
     entry's `env` object if present, placed before the `--`. `--scope local` registers the server for
     THIS PROJECT ONLY (stored in `~/.claude.json` keyed by project path) — nothing is written into the
     project's own repository. If `requires_input` is set (e.g. Supabase needs a project-ref and an
     access token), ask the user for those values first and substitute them into the args/env before
     running the command.
   - `cli` entries: run the entry's `install` command once, globally on the machine — these are host
     tools, not project-scoped, matching how `gh`/`graphify`/etc. are already installed.
   - `skill` entries without `manual: true`: run the entry's `claude` install command as-is.
   - If an entry is `claude_only: true` but has no usable action for this engine, or is otherwise not
     applicable, say so and skip it.

5. If an entry's install block has a `note` field, treat it as a required extra step (e.g. a follow-up
   copy/registration action), not optional color — carry it out too.

6. Never write any file inside the current project's repository. If something truly requires local
   project config, stop and ask the user explicitly first, explaining the trade-off.

7. Report only: what was installed, what was skipped, and any follow-up the user needs to do (e.g. "set
   SUPABASE_ACCESS_TOKEN — get it from your Supabase dashboard").

$ARGUMENTS
