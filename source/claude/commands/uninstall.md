---
# base_project:managed
description: Cleanly remove everything base_project installed globally. Tiered confirmation — asks separately for things with a bigger blast radius (global hooks, global MCP servers) before touching them.
---

Remove base_project's installed files and registrations from `~/.claude` and
`~/.config/opencode`. **This never deletes the base_project git repository itself** —
only the global side-effects the installer created. If the user meant "delete the repo
I'm running this from," stop and clarify instead of assuming.

Confirmation is tiered by blast radius, not a single yes/no — ask about each tier
separately, and only touch a tier the user explicitly confirms. Skip a tier cleanly if
declined; still process the others.

## Step 1: Inventory (read-only, do this first)

Build the real list before asking anything — don't guess from memory of what the
installer usually does, actually check what's present on this machine right now:

- Files under `~/.claude/agents/`, `~/.claude/commands/`, `~/.config/opencode/agent/`,
  `~/.config/opencode/command/` that contain the `base_project:managed` marker.
- `~/.claude/base_project/` (hooks, scripts, references, plugins.json) and
  `~/.config/opencode/base_project/` (references, plugins.json) — everything under
  these two directories is base_project's own namespace.
- The delimited block (`<!-- base_project:start -->` … `<!-- base_project:end -->`) in
  `~/.claude/CLAUDE.md`, if present.
- `~/.base_project/` (state dir — `repo-path.txt`).
- Hook entries in `~/.claude/settings.json` whose `command` contains
  `base_project/hooks/` (loop-detect, post-edit-format, session-start-git-context).
- The `instructions` and `mcp.file` keys in `~/.config/opencode/opencode.jsonc`, if they
  point at this base_project repo's files.
- `~/.config/opencode/mcp.json`, only if it has `"_managed_by": "base_project"` at the
  root (if it doesn't, the user or something else edited it — leave it alone).
- MCP servers registered with Claude Code via `claude mcp add --scope user` matching the
  server names in the base_project catalog (`context7`, `filesystem`, `git`, `github` —
  confirm the exact list by reading `source/opencode/mcp.json`'s `mcpServers` keys from
  the repo located via `~/.base_project/repo-path.txt`, don't hardcode the 4 names as
  gospel in case the catalog changed).

Report the full inventory to the user, grouped into the 3 tiers below, before asking
anything.

## Step 2: Tiered confirmation

**Tier A — base_project's own files (safe, 100% reversible by re-running the installer,
no effect on anything outside base_project's own namespace):**
managed `.md` files (agents/commands/references, both engines), `plugins.json` copies,
`~/.claude/base_project/hooks/*.js` + `scan-skill.js`, the managed block in `CLAUDE.md`,
`~/.base_project/` state dir.
Ask once: "Remove all of Tier A? (y/n)".

**Tier B — changes what fires on every future session, not just base_project's own
scope (still reversible by reinstalling, but has real effect until then):**
the 3 hook registrations in `settings.json`, the `instructions`/`mcp.file` keys in
`opencode.jsonc`.
Ask separately: "Also remove the hook registrations and opencode instructions link?
This means loop-detect/post-edit-format/session-start-git-context stop running, and
opencode loses the global instructions block, in EVERY project, not just this one.
(y/n)".

**Tier C — global MCP server registrations, the widest blast radius (every Claude Code
project on this machine loses these tools, not just ones using base_project):**
the `claude mcp remove <name> --scope user` calls, and `~/.config/opencode/mcp.json` if
it's fully base_project-owned.
Ask separately, naming the exact servers found in step 1: "Also unregister these N MCP
servers globally: <list>? This affects every Claude Code/opencode project on this
machine. (y/n)".

## Step 3: Execute only what was confirmed

- Never touch a file without the `base_project:managed` marker (or, for
  `plugins.json`/`mcp.json`, without `_managed_by`) — if something expected is missing
  that marker, skip it and report why, same as the installer's own "not ours" rule.
- For `CLAUDE.md`, remove only the delimited block; leave any content outside it
  untouched.
- For `settings.json`/`opencode.jsonc`, remove only the specific keys/entries that
  match base_project's markers — never replace the whole file.
- If a step fails partway (e.g. `claude` CLI not on PATH so `mcp remove` can't run),
  report exactly what succeeded and what didn't — don't claim full success.

## Step 4: Report

List what was actually removed per tier, what was skipped (with reason), and remind the
user that re-running the installer (`dev/scripts/install.ps1`/`.sh` in the base_project
repo — still on disk, untouched) fully restores everything removed in Tiers A and B.

$ARGUMENTS
