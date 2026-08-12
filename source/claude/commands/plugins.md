---
# base_project:managed
description: Recommend and install optional plugins from the base_project catalog for THIS project.
---

Analyze the current project and help the user pick optional plugins from the base_project catalog.

1. Read the catalog at `~/.claude/base_project/plugins.json`. If it's missing, tell the user to run the
   base_project installer (`install.ps1` / `install.sh`) once, then stop.

2. If `$ARGUMENTS` names a key present in the catalog's top-level `profiles` object (e.g. `minimal`,
   `design`, `full`), skip the recommendation step entirely: the plugin set is just that profile's id
   list resolved against `catalog`. Confirm the resolved list with the user in one line (e.g. "profile
   'design' = skill-ui, emil-design-eng, impeccable, taste-skill — installing all 4"), then go straight
   to step 4. If `$ARGUMENTS` names something that isn't a known profile, say so and fall back to the
   normal interactive flow below instead of guessing.

3. Otherwise (no profile requested): inspect the current project (package.json, requirements.txt,
   pyproject.toml, .env, folder structure, any `supabase/` folder, `*.sqlite`/`*.db` files, etc.) and
   evaluate each catalog entry's `recommend_if` condition against what you actually find — don't
   recommend blindly. Present a short summary: which entries are recommended for this specific project
   and why, and which others exist in the catalog but weren't recommended. Then ask the user which ones
   to install — offer "just the recommended ones", "recommended + pick more from the list", "a named
   profile instead (list the ones from `profiles`)", or "none".

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

7. Lightweight pre-trust scan for third-party `skill`-kind entries only (not `mcp`/`cli`, which are
   scoped official packages, not arbitrary skill content): if `~/.claude/base_project/scripts/scan-skill.js`
   exists and the entry's install command downloads files locally (e.g. `npx skills add` clones into
   `~/.claude/skills/<name>/` or `~/.agents/skills/<name>/`), run
   `node ~/.claude/base_project/scripts/scan-skill.js <downloaded-path>` against the resulting directory
   right after install, before telling the user it's ready to use. This is advisory only (a handful of
   high-signal patterns — remote-exec pipes, obfuscated eval, zero-width Unicode — not a full audit): if
   it reports findings, show them verbatim and let the user decide whether to keep or remove the skill;
   never auto-delete anything. If the script is missing (older install), skip this step silently.

8. Report only: what was installed, what was skipped, any scan findings from step 7, and any follow-up
   the user needs to do (e.g. "set SUPABASE_ACCESS_TOKEN — get it from your Supabase dashboard").

$ARGUMENTS
