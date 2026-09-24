---
# base_project:managed
description: Cleanly remove everything base_project installed globally (lite). Tiered confirmation by blast radius; keeps your own data unless you explicitly confirm deleting it.
---

Remove base_project's installed files and registrations from every engine it was installed into — Claude Code (`~/.claude`), opencode (`~/.config/opencode`), Codex (`~/.codex`, `~/.agents/skills`) and Kimi (`~/.kimi`), whichever are present. This never deletes the base_project git repository itself — only the global side-effects the installer created. If the user meant "delete the repo I'm running this from," stop and ask instead of assuming.

Confirmation is tiered by blast radius — ask about each tier separately, only touch a tier the user explicitly confirms, skip a declined tier cleanly and still process the others.

STEP 1 — Inventory, read-only. Check what's actually present, don't guess:
- Files under `~/.claude/agents/`, `~/.claude/commands/`, `~/.config/opencode/agent/`, `~/.config/opencode/command/`, `~/.codex/agents/`, and `~/.agents/skills/*/SKILL.md` containing the `base_project:managed` marker.
- `~/.claude/base_project/`, `~/.config/opencode/base_project/`, `~/.codex/base_project/` — base_project's own namespaces, EXCEPT `~/.claude/base_project/usage/` (the user's usage ledger, Tier D).
- The delimited block (`<!-- base_project:start -->` … `<!-- base_project:end -->`) in `~/.claude/CLAUDE.md`, `~/.codex/AGENTS.md`, `~/.kimi/AGENTS.md`, where present.
- `~/.base_project/` state (`repo-path.txt`, `opencode-command-profile.txt`, `opencode-managed-mcp.json`, `diary-root.txt`).
- Hook entries whose `command` contains `base_project/hooks/` in `~/.claude/settings.json` and `~/.codex/hooks.json`.
- In `~/.config/opencode/opencode.jsonc`: the `instructions` entry pointing at the base_project clone's `source/opencode-instructions.md`, and only the `mcp` entries named in `~/.base_project/opencode-managed-mcp.json` (every other `mcp` entry is the user's). A legacy `~/.config/opencode/mcp.json` counts only if it has `"_managed_by": "base_project"` at the root.
- MCP servers registered via `claude mcp add --scope user`, the `[mcp_servers.*]` tables after the `# --- base_project managed MCP servers` comment in `~/.codex/config.toml`, and `~/.kimi/mcp.json` if it has `"_managed_by": "base_project"` — matching the catalog's server names (read the exact list from `source/opencode/mcp.json`'s `mcpServers` keys in the repo found via `~/.base_project/repo-path.txt` — don't hardcode names), plus names in that repo's `source/opencode/mcp-previous.json` (servers earlier versions registered) only while the entry still matches a definition listed there.
- The user's own data (Tier D): the usage ledger `~/.claude/base_project/usage/`, the diary directory named in `~/.base_project/diary-root.txt`, and the canonical store `~/.agents/` (the managed skills under `~/.agents/skills/` are Tier A).
Report the full inventory, grouped into the 4 tiers below, before asking anything.

STEP 2 — Tier A confirmation. Tier A = base_project's own files: managed `.md`/`.toml`/`SKILL.md` files (every engine), `plugins.json` copies, `~/.claude/base_project/hooks/*.js` and managed helper scripts (such as `scan-skill.js` and `validate-goals-structure.js`), the managed blocks in `CLAUDE.md`/`AGENTS.md`, and the `~/.base_project/` state files except `diary-root.txt`. Never the usage ledger. Safe, 100% reversible by reinstalling. Ask once: "Remove all of Tier A? (y/n)".

STEP 3 — Tier B confirmation. Tier B = the base_project hook registrations in `~/.claude/settings.json` and `~/.codex/hooks.json`, and the base_project `instructions` entry in `opencode.jsonc`. Ask separately: "Also remove the hook registrations and opencode instructions link? This means loop detection, post-edit formatting, GOALS validation, session-start Git context, and usage logging stop running, and opencode loses its global instructions block, in every project. (y/n)".

STEP 4 — Tier C confirmation. Tier C = global MCP registrations — the `claude mcp remove <name> --scope user` calls, base_project's own entries in `opencode.jsonc`'s `mcp`, the base_project tables in `~/.codex/config.toml`, and base_project-owned `mcp.json` files (legacy opencode, Kimi). Ask separately, naming the exact servers found in step 1: "Also unregister these N MCP servers globally: <list>? This affects every Claude Code/opencode/Codex project on this machine. (y/n)".

STEP 5 — Tier D confirmation, only after Tiers A–C. Tier D = the user's own data: the usage ledger (the only source `/diario` has for past hours), the diaries, and `~/.agents/`. It is NOT restorable by reinstalling, and the default is to keep it. Ask: "Also permanently delete your usage history, diaries and ~/.agents content? This cannot be undone by reinstalling. (y/N)". Anything but an explicit yes keeps it.

STEP 6 — Execute only what was confirmed:
- Never touch a file without the `base_project:managed` marker (or `_managed_by` for `plugins.json`/`mcp.json`) — skip it and report why if the marker is missing.
- For `CLAUDE.md`/`AGENTS.md`, remove only the delimited block.
- For `settings.json`, `hooks.json`, `opencode.jsonc` and `config.toml`, remove only the matching keys/entries — never replace the whole file, and keep the user's own entries and comments.
- If a step fails partway (e.g. `claude` CLI not on PATH), report exactly what succeeded and what didn't.

STEP 7 — Verify the final state: confirmed tiers are gone, declined tiers remain, the repository and neighboring user configuration are intact, and no unmarked item was touched.
Then report what was removed per tier, what was skipped and why, and that re-running the installer (`dev/scripts/install.ps1`/`.sh`, still on disk) fully restores Tiers A, B and C — never Tier D.

$ARGUMENTS
