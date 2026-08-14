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
   recommend blindly. This is the catalog pass — cheap, zero risk, already vetted. Note which needs (if
   any) nothing in the catalog covers; that's the input to step 3b.

3b. Live discovery — only for needs the catalog pass didn't cover. This is new and deliberately generous:
   the goal is surfacing everything plausibly relevant, not pre-filtering to what looks best. The decision
   of what's worth installing belongs to the user, not to you.
   - Search in this order, stopping as soon as a step finds something usable: (a) the Claude Code plugin
     marketplace (vetted distribution — even in opencode sessions, this is worth checking first since it's
     the most curated source available); (b) open web search (GitHub, npm, official docs) if the
     marketplace has nothing.
   - Apply a minimum quality bar before including a web-discovered result — real signal (stars, recent
     activity, an actual README, a license), not zero filter and not your own taste about whether it's
     "worth mentioning." The bar is "plausibly legitimate," not "the one you'd personally pick."
   - Do not silently drop a plausible result because it seems redundant or unnecessary to you — that
     judgment belongs to the user in step 4. Under-showing defeats the point of this step.
   - Anything found this way is *not yet in `plugins.json`* and has no pre-tested install command — flag
     this clearly when presenting it (see step 4). Do not treat a web-discovered result as equivalent in
     confidence to a catalog entry.

4. Present a summary covering both passes: which catalog entries are recommended and why, which catalog
   entries exist but weren't recommended, and — separately labeled — anything found via step 3b, marked as
   "not yet validated, install command inferred, not tested." Then ask the user which ones to install —
   offer "just the recommended ones", "recommended + pick more from the list", "a named profile instead
   (list the ones from `profiles`)", or "none". Never present step 3b results as if they had the same
   confidence as catalog entries.

4b. IMPORTANT — opencode has no per-project MCP scoping (unlike Claude Code's `--scope local`). State this
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

4c. For each step-3b (live discovery) result the user accepts — no pre-tested `opencode` block exists for
   these, so treat with more caution than a catalog entry:
   - Work out the install command from what the source actually documents — never guess a command that
     isn't stated somewhere. If no documented install step exists, say so and skip it.
   - Show the exact command/config change before applying it and get an explicit go-ahead — same "new
     class of action" reasoning as catalog `mcp` entries above: since opencode has no local scope, an MCP
     from live discovery becomes global too, which makes the explicit confirmation more important, not
     less.
   - This is scoped to today's decision only — it is not written back into `plugins.json` as a permanent
     entry. Turning a good discovery into a real catalog entry (with a tested `opencode` block) is future
     work, not part of this command today. Say so if asked whether it'll be remembered next time.

5. If an entry's install block has a `note` field, treat it as a required extra step (e.g. a follow-up
   copy/registration action), not optional color — carry it out too.

6. Never write any file inside the current project's repository.

7. Pre-trust scan before first use — required, not advisory-only, for anything from step 3b (live
   discovery) regardless of kind, since none of it is a pre-vetted package the way catalog `mcp`/`cli`
   entries are. For catalog entries, scope stays as before: third-party `skill`-kind only. If
   `~/.claude/base_project/scripts/scan-skill.js` exists and the install downloaded files locally (e.g.
   `npx skills add` clones into `~/.agents/skills/<name>/` or `~/.config/opencode/skills/<name>/`, or a
   step-3b MCP/CLI was cloned/downloaded to run), run `node ~/.claude/base_project/scripts/scan-skill.js
   <downloaded-path>` against the resulting directory right after install, before telling the user it's
   ready to use. Findings are advisory (a handful of high-signal patterns, not a full audit) even where
   running the scan is mandatory: show findings verbatim and let the user decide; never auto-delete
   anything. If the script is missing, skip silently — but say so for step 3b items specifically, since
   that's the one case where skipping the scan is a real gap, not a formality.

8. Report only: what was installed — split clearly into "from the catalog" (and, for MCP entries, that
   it's now global) and "from live discovery, unvalidated" — what was skipped, any scan findings from step
   7, and any follow-up needed (e.g. setting an access token).

$ARGUMENTS
