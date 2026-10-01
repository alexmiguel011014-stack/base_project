---
# base_project:managed
name: uninstall
description: Remove base_project's installed global files and registrations with separate confirmations by blast radius. Use only for $uninstall or an explicit full removal request.
---

Remove installed side effects, never the base_project git repository. Inventory first and do not guess.

Check all engines actually present:

- managed skills in `~/.agents/skills/*/SKILL.md`, Codex agents in `~/.codex/agents/`, Claude agents/commands, and opencode agents/commands;
- base_project namespaces under `~/.codex/`, `~/.claude/`, and `~/.config/opencode/` — except the usage ledger `~/.claude/base_project/usage/`, which is user data (Tier D);
- managed blocks in Codex `AGENTS.md`, Claude `CLAUDE.md`, and any other installer-managed instruction file;
- base_project hook entries in `~/.codex/hooks.json` and `~/.claude/settings.json`;
- in `~/.config/opencode/opencode.jsonc`, the `instructions` entry pointing at the clone's `source/opencode-instructions.md` and only the `mcp` entries named in `~/.base_project/opencode-managed-mcp.json`; fully base_project-owned JSON files;
- state under `~/.base_project/`;
- MCP server names derived from the installed catalog/config, never a hardcoded list, plus names in the repo's `source/opencode/mcp-previous.json` (servers earlier versions registered) only while the entry still matches a definition listed there;
- user data: the usage ledger, the diary directory named in `~/.base_project/diary-root.txt`, and the canonical store `~/.agents/` outside its managed skills.

Report the inventory and confirm each tier separately:

1. **Tier A — owned files:** managed skills/agents/commands/references/scripts/catalog copies, delimited instruction blocks, and state except `diary-root.txt`. Never the usage ledger. Reinstalling restores these.
2. **Tier B — automatic behavior:** hook registrations and global instruction links. Explain that future sessions lose loop detection, post-edit formatting, GOALS structure validation, Git context, and usage logging as applicable.
3. **Tier C — MCP registrations:** exact detected global/project servers. Explain scope and impact for every affected engine.
4. **Tier D — user data (not restorable by reinstalling; default keep):** the usage ledger (the only source `$diario` has for past hours), the diaries, and `~/.agents/` content. Offer it only after Tiers A–C, say plainly it cannot be undone by reinstalling, and keep it unless the user answers an explicit yes.

Execute only confirmed tiers; declining Tier D is the default. Remove only files carrying `base_project:managed`, owned namespaces, `_managed_by: base_project` JSON, exact delimited blocks, or hook/MCP entries matching base_project markers. Preserve all neighboring user configuration. If a marker is missing, skip and report why. Verify final state and list removed, skipped, and failed items per tier.
