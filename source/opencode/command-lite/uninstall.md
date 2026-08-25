---
# base_project:managed
description: Cleanly remove everything base_project installed globally (lite). Tiered confirmation by blast radius.
---

Remove base_project's installed files and registrations from `~/.claude` and `~/.config/opencode`. This never deletes the base_project git repository itself — only the global side-effects the installer created. If the user meant "delete the repo I'm running this from," stop and ask instead of assuming.

Confirmation is tiered by blast radius — ask about each tier separately, only touch a tier the user explicitly confirms, skip a declined tier cleanly and still process the others.

STEP 1 — Inventory, read-only. Check what's actually present, don't guess:
- Files under `~/.claude/agents/`, `~/.claude/commands/`, `~/.config/opencode/agent/`, `~/.config/opencode/command/` containing the `base_project:managed` marker.
- `~/.claude/base_project/` and `~/.config/opencode/base_project/` — base_project's own namespace.
- The delimited block (`<!-- base_project:start -->` … `<!-- base_project:end -->`) in `~/.claude/CLAUDE.md`, if present.
- `~/.base_project/` (state dir).
- Hook entries in `~/.claude/settings.json` whose `command` contains `base_project/hooks/`.
- The `instructions` and `mcp.file` keys in `~/.config/opencode/opencode.jsonc`, if they point at this repo's files.
- `~/.config/opencode/mcp.json`, only if it has `"_managed_by": "base_project"` at the root.
- MCP servers registered via `claude mcp add --scope user` matching the catalog's server names (read the exact list from `source/opencode/mcp.json`'s `mcpServers` keys in the repo found via `~/.base_project/repo-path.txt` — don't hardcode names).
Report the full inventory, grouped into the 3 tiers below, before asking anything.

STEP 2 — Tier A confirmation. Tier A = base_project's own files: managed `.md` files (both engines), `plugins.json` copies, `~/.claude/base_project/hooks/*.js` + `scan-skill.js`, the managed block in `CLAUDE.md`, `~/.base_project/`. Safe, 100% reversible by reinstalling. Ask once: "Remove all of Tier A? (y/n)".

STEP 3 — Tier B confirmation. Tier B = the 3 hook registrations in `settings.json`, the `instructions`/`mcp.file` keys in `opencode.jsonc`. Ask separately: "Also remove the hook registrations and opencode instructions link? This means loop-detect/post-edit-format/session-start-git-context stop running, and opencode loses its global instructions block, in every project. (y/n)".

STEP 4 — Tier C confirmation. Tier C = global MCP registrations — the `claude mcp remove <name> --scope user` calls, and `~/.config/opencode/mcp.json` if fully base_project-owned. Ask separately, naming the exact servers found in step 1: "Also unregister these N MCP servers globally: <list>? This affects every Claude Code/opencode project on this machine. (y/n)".

STEP 5 — Execute only what was confirmed:
- Never touch a file without the `base_project:managed` marker (or `_managed_by` for `plugins.json`/`mcp.json`) — skip it and report why if the marker is missing.
- For `CLAUDE.md`, remove only the delimited block.
- For `settings.json`/`opencode.jsonc`, remove only the matching keys/entries — never replace the whole file.
- If a step fails partway (e.g. `claude` CLI not on PATH), report exactly what succeeded and what didn't.

STEP 6 — Report: what was removed per tier, what was skipped and why, and that re-running the installer (`dev/scripts/install.ps1`/`.sh`, still on disk) fully restores Tiers A and B.

$ARGUMENTS
