---
# base_project:managed
description: Recommend and install optional plugins from the base_project catalog (lite).
---

Analyze the current project and help the user pick optional plugins from the base_project catalog.

STEP 1 — Read the catalog at `~/.config/opencode/base_project/plugins.json`. If missing, tell the user to run the base_project installer once, then stop.

STEP 2 — If `$ARGUMENTS` names a known profile from the catalog's `profiles` object (e.g. `minimal`, `design`, `full`), skip recommendation entirely: the plugin set is that profile's id list resolved against `catalog`. Confirm the resolved list in one line, then go to step 6. If `$ARGUMENTS` names something that isn't a known profile, say so and fall back to step 3.

STEP 3 — Catalog pass. Inspect the project (`package.json`, `requirements.txt`, `pyproject.toml`, `.env`, folder structure, any `supabase/` folder, `*.sqlite`/`*.db` files, etc.) and check each catalog entry's `recommend_if` condition against what's actually found. Note any need the catalog doesn't cover — that feeds step 4.

STEP 4 — Live discovery, only for needs the catalog pass didn't cover. Be generous: surface everything plausibly relevant, don't pre-filter to your own taste.
- Search in order, stop at the first step that finds something usable: (a) the Claude Code plugin marketplace, (b) open web search (GitHub, npm, official docs).
- Apply a minimum quality bar: real signal (stars, recent activity, a real README, a license) — not "the one you'd personally pick."
- Don't drop a plausible result just because it seems redundant to you — that's the user's call in step 5.
- Anything found this way has no pre-tested install command — flag this clearly, it is not equivalent in confidence to a catalog entry.

STEP 5 — Present a summary: which catalog entries are recommended and why, which exist but weren't recommended, and — separately labeled — anything from step 4, marked "not yet validated, install command inferred, not tested." Ask the user: recommended only, recommended + pick more, a named profile, or none.

STEP 6 — Before installing anything: opencode has no per-project MCP scoping. State this explicitly — any `mcp` entry the user accepts is added to the GLOBAL `~/.config/opencode/mcp.json` and becomes available in every opencode project from then on. Let the user decline if they don't want that.

STEP 7 — Install what was accepted, by kind:
- `mcp` entries: read `~/.config/opencode/mcp.json`, add the entry under `mcpServers` using the catalog's `opencode` block as-is — ask for any `requires_input` values first and substitute them, then save.
- `cli` entries: run the entry's `install` command once, globally.
- `skill` entries without `manual: true`: run the entry's `opencode` install command.
- Entry has `"manual": true` or no `opencode` block: don't auto-execute, point the user at the entry's `source` link.
- Entry is `claude_only: true`: say it isn't available for opencode and skip it.
- If an entry has a `note` field, treat it as a required extra step, not optional color.

STEP 8 — For each step-4 (live discovery) result the user accepts: work out the install command only from what the source actually documents — never guess one. If none is documented, say so and skip it. Show the exact command/config change and get an explicit go-ahead before applying — it becomes global too, same reasoning as step 6. This is scoped to today only — it is not written back into `plugins.json` as a permanent entry.

STEP 9 — Never write any file inside the current project's repository.

STEP 10 — Pre-trust scan before first use — required for anything from step 4 (live discovery), advisory-scope for catalog `skill`-kind entries. If `~/.claude/base_project/scripts/scan-skill.js` exists and the install downloaded files locally, run `node ~/.claude/base_project/scripts/scan-skill.js <downloaded-path>` right after install, before telling the user it's ready. Show findings verbatim, let the user decide, never auto-delete. If the script is missing, skip silently — but say so for step-4 items specifically.

STEP 11 — Record the install, once per item that actually installed, right after the scan and before reporting: `node ~/.claude/base_project/hooks/usage-log.js --install <id> --kind <kind> --origin <catalog|discovery>`. Use the catalog `id` for catalog entries, the tool's own name for discovery ones. Never record an install that didn't happen.

STEP 12 — Report: what was installed — split into "from the catalog" (and, for MCP, that it's now global) and "from live discovery, unvalidated" — what was skipped, any scan findings, and any follow-up needed (e.g. setting an access token).

$ARGUMENTS
