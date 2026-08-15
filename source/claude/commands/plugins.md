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
   recommend blindly. This is the catalog pass — cheap, zero risk, already vetted. Note which needs (if
   any) nothing in the catalog covers; that's the input to step 3b.

3b. Live discovery — only for needs the catalog pass didn't cover. This is new and deliberately generous:
   the goal is surfacing everything plausibly relevant, not pre-filtering to what looks best. The decision
   of what's worth installing belongs to the user, not to you.
   - Search in this order, stopping as soon as a step finds something usable: (a) the Claude Code plugin
     marketplace (`/plugin marketplace` sources the user has, or well-known marketplaces if none are
     configured) — this is vetted distribution, prefer it; (b) open web search (GitHub, npm, official docs)
     for an MCP server, CLI, or skill that addresses the need, if the marketplace has nothing.
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

5. For each catalog plugin the user accepts, install it according to its `kind` and flags:
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

5b. For each step-3b (live discovery) result the user accepts — this has no pre-tested `claude` block, so
   treat it with more caution than a catalog entry:
   - Work out the install command from what the source actually documents (its README, its marketplace
     listing) — never guess a command that isn't stated somewhere. If you can't find a documented install
     step, say so and skip it rather than inventing one.
   - Show the user the exact command before running it and get an explicit go-ahead — this is a new class
     of action for this command (unvetted source), so the standing "user already asked for this" permission
     from step 4 doesn't cover the specific command; confirm it separately, in the moment.
   - Prefer `--scope local` (or the equivalent project-only scope) exactly like catalog `mcp` entries, for
     the same reason: nothing installed this way should leak into every other project by default.
   - This is scoped to a single project run, not persisted to `plugins.json` yet — turning a good
     discovery into a permanent catalog entry (with a real tested `claude`/`opencode` block) is future work,
     not part of this command today. Say so if the user asks whether it'll remember this next time.

6. If an entry's install block has a `note` field, treat it as a required extra step (e.g. a follow-up
   copy/registration action), not optional color — carry it out too.

7. Never write any file inside the current project's repository. If something truly requires local
   project config, stop and ask the user explicitly first, explaining the trade-off.

8. Pre-trust scan before first use — required, not advisory-only, for anything from step 3b (live
   discovery) regardless of kind, since none of it is a pre-vetted package the way catalog `mcp`/`cli`
   entries are. For catalog entries, scope stays as before: third-party `skill`-kind only (`mcp`/`cli` from
   the catalog are scoped official packages, already trusted). If `~/.claude/base_project/scripts/scan-skill.js`
   exists and the install downloaded files locally (e.g. `npx skills add` clones into
   `~/.claude/skills/<name>/` or `~/.agents/skills/<name>/`, or a step-3b MCP/CLI was cloned/downloaded to
   run), run `node ~/.claude/base_project/scripts/scan-skill.js <downloaded-path>` against the resulting
   directory right after install, before telling the user it's ready to use. This is advisory in its
   findings (a handful of high-signal patterns — remote-exec pipes, obfuscated eval, zero-width Unicode —
   not a full audit) even where running it is mandatory: if it reports findings, show them verbatim and let
   the user decide whether to keep or remove it; never auto-delete anything. If the script is missing
   (older install), skip this step silently — but say so for step 3b items specifically, since that's the
   one case where skipping the scan is a real gap, not a formality.

8b. Record the install in the usage ledger, once per item that actually installed, right after the
   scan and before reporting:
   `node ~/.claude/base_project/hooks/usage-log.js --install <id> --kind <kind> --origin <catalog|discovery>`
   Use the catalog `id` for catalog entries, and the tool's own name for live-discovery ones. This is
   what makes "installed and never used" answerable by `/reviewusage`: catalog entries can be
   cross-checked against `plugins.json`, but a live-discovery item exists in no catalog, so without
   this line it is invisible exactly when it matters most — pulled from the open web, then never used
   again. Never record an install that didn't happen (a failed or user-declined one). If the script is
   missing (older install), skip silently; it is a ledger entry, never a gate on the install itself.

9. Report only: what was installed — split clearly into "from the catalog" and "from live discovery,
   unvalidated" — what was skipped, any scan findings from step 8, and any follow-up the user needs to do
   (e.g. "set SUPABASE_ACCESS_TOKEN — get it from your Supabase dashboard").

$ARGUMENTS
