---
# base_project:managed
description: Cleanly remove everything base_project installed globally. Tiered confirmation — asks separately for things with a bigger blast radius (global hooks, global MCP servers), and keeps your own data (usage ledger, diaries, ~/.agents content) unless you explicitly confirm deleting it.
---

Remove base_project's installed files and registrations from every engine it was installed
into — Claude Code (`~/.claude`), opencode (`~/.config/opencode`), Codex (`~/.codex`,
`~/.agents/skills`) and Kimi (`~/.kimi`), whichever are present.
**This never deletes the base_project git repository itself** — only the global side-effects
the installer created. If the user meant "delete the repo I'm running this from," stop and
clarify instead of assuming.

Confirmation is tiered by blast radius, not a single yes/no — ask about each tier
separately, and only touch a tier the user explicitly confirms. Skip a tier cleanly if
declined; still process the others.

## Step 1: Inventory (read-only, do this first)

Build the real list before asking anything — don't guess from memory of what the
installer usually does, actually check what's present on this machine right now:

- Files under `~/.claude/agents/`, `~/.claude/commands/`, `~/.config/opencode/agent/`,
  `~/.config/opencode/command/`, `~/.codex/agents/`, and `~/.agents/skills/*/SKILL.md` that
  contain the `base_project:managed` marker.
- base_project's own namespaces: `~/.claude/base_project/` (hooks, scripts, references,
  plugins.json), `~/.config/opencode/base_project/`, and `~/.codex/base_project/` —
  **except** `~/.claude/base_project/usage/`, which is the user's usage ledger (Tier D).
- The delimited block (`<!-- base_project:start -->` … `<!-- base_project:end -->`) in
  `~/.claude/CLAUDE.md`, `~/.codex/AGENTS.md`, and `~/.kimi/AGENTS.md`, where present.
- `~/.base_project/` state (`repo-path.txt`, `opencode-command-profile.txt`,
  `opencode-managed-mcp.json`, `diary-root.txt`).
- Hook entries whose `command` contains `base_project/hooks/` in `~/.claude/settings.json`
  and `~/.codex/hooks.json` (derive the current set from the installed entries rather than a
  fixed list).
- In `~/.config/opencode/opencode.jsonc`: the `instructions` entry pointing at the
  base_project clone's `source/opencode-instructions.md`, and the `mcp` entries named in
  `~/.base_project/opencode-managed-mcp.json` — only those; every other `mcp` entry is the
  user's. A legacy `~/.config/opencode/mcp.json` counts only if it has
  `"_managed_by": "base_project"` at the root.
- MCP servers registered with Claude Code via `claude mcp add --scope user`, the
  `[mcp_servers.*]` tables after the `# --- base_project managed MCP servers` comment in
  `~/.codex/config.toml`, and `~/.kimi/mcp.json` if it has `"_managed_by": "base_project"` —
  matching the server names declared by the base_project catalog/config. Confirm the exact
  current list from the repo located via `~/.base_project/repo-path.txt`; never hardcode
  server names.
- The user's own data (Tier D): the usage ledger `~/.claude/base_project/usage/`, the diary
  directory named in `~/.base_project/diary-root.txt`, and the unified canonical store
  `~/.agents/` (rules, MCP and config the user may have edited; the managed skills under
  `~/.agents/skills/` belong to Tier A).

Report the full inventory to the user, grouped into the 4 tiers below, before asking
anything.

## Step 2: Tiered confirmation

**Tier A — base_project's own files (safe, 100% reversible by re-running the installer,
no effect on anything outside base_project's own namespace):**
managed `.md`/`.toml`/`SKILL.md` files (agents, commands, skills, references — every engine),
`plugins.json` copies, `~/.claude/base_project/hooks/*.js` and managed helper scripts (such as
`scan-skill.js` and `validate-goals-structure.js`), the managed blocks in `CLAUDE.md`/`AGENTS.md`,
and the `~/.base_project/` state files except `diary-root.txt` (kept with Tier D so the diaries
stay findable). Never the usage ledger.
Ask once: "Remove all of Tier A? (y/n)".

**Tier B — changes what fires on every future session, not just base_project's own
scope (still reversible by reinstalling, but has real effect until then):**
the base_project hook registrations in `~/.claude/settings.json` and `~/.codex/hooks.json`,
and the base_project `instructions` entry in `opencode.jsonc`.
Ask separately: "Also remove the hook registrations and opencode instructions link?
This means loop detection, post-edit formatting, GOALS validation, session-start Git context,
and usage logging stop running, and
opencode loses the global instructions block, in EVERY project, not just this one.
(y/n)".

**Tier C — global MCP server registrations, the widest blast radius (every project on this
machine loses these tools, not just ones using base_project):**
the `claude mcp remove <name> --scope user` calls, base_project's own entries in
`opencode.jsonc`'s `mcp`, the base_project tables in `~/.codex/config.toml`, and
base_project-owned `mcp.json` files (legacy opencode, Kimi).
Ask separately, naming the exact servers found in step 1: "Also unregister these N MCP
servers globally: <list>? This affects every Claude Code/opencode/Codex project on this
machine. (y/n)".

**Tier D — the user's own data (NOT restorable by reinstalling; the default is to keep it):**
the usage ledger `~/.claude/base_project/usage/` (the only source `/diario` has for past
hours and activity), the diary directory from `~/.base_project/diary-root.txt`, and the
canonical store `~/.agents/`. Offer it only after Tiers A–C, say plainly that nothing can
bring it back, and ask: "Also permanently delete your usage history, diaries and ~/.agents
content? This cannot be undone by reinstalling. (y/N)". Anything but an explicit yes keeps it.

## Step 3: Execute only what was confirmed

- Never touch a file without the `base_project:managed` marker (or, for
  `plugins.json`/`mcp.json`, without `_managed_by`) — if something expected is missing
  that marker, skip it and report why, same as the installer's own "not ours" rule.
- For `CLAUDE.md`/`AGENTS.md`, remove only the delimited block; leave any content outside it
  untouched.
- For `settings.json`, `hooks.json`, `opencode.jsonc` and `config.toml`, remove only the
  specific keys/entries that match base_project's markers or recorded names — never replace
  the whole file, and keep the user's own entries and comments.
- If a step fails partway (e.g. `claude` CLI not on PATH so `mcp remove` can't run),
  report exactly what succeeded and what didn't — don't claim full success.

## Step 4: Report

Verify the final state before reporting: confirmed tiers are gone, declined tiers remain,
the repository and neighboring user configuration are intact, and no unmarked item was touched.
List what was actually removed per tier, what was skipped (with reason), and remind the
user that re-running the installer (`dev/scripts/install.ps1`/`.sh` in the base_project
repo — still on disk, untouched) fully restores everything removed in Tiers A, B and C —
never Tier D.

$ARGUMENTS
