---
# base_project:managed
name: uninstall
description: Remove base_project's installed global files and registrations with separate confirmations by blast radius. Use only for $uninstall or an explicit full removal request.
---

Remove installed side effects, never the base_project git repository. Inventory first and do not guess.

Check all engines actually present:

- managed skills in `~/.agents/skills/*/SKILL.md`, Codex agents in `~/.codex/agents/`, Claude agents/commands, and opencode agents/commands;
- base_project namespaces under `~/.codex/`, `~/.claude/`, and `~/.config/opencode/`;
- managed blocks in Codex `AGENTS.md`, Claude `CLAUDE.md`, and any other installer-managed instruction file;
- base_project hook entries in `~/.codex/hooks.json` and `~/.claude/settings.json`;
- opencode instruction/MCP links and fully base_project-owned JSON files;
- state under `~/.base_project/`;
- MCP server names derived from the installed catalog/config, never a hardcoded list.

Report the inventory and confirm each tier separately:

1. **Tier A — owned files:** managed skills/agents/commands/references/scripts/catalog copies, delimited instruction blocks, and state. Reinstalling restores these.
2. **Tier B — automatic behavior:** hook registrations and global instruction links. Explain that future sessions lose loop detection, formatting, git context, and usage logging as applicable.
3. **Tier C — MCP registrations:** exact detected global/project servers. Explain scope and impact for every affected engine.

Execute only confirmed tiers. Remove only files carrying `base_project:managed`, owned namespaces, `_managed_by: base_project` JSON, exact delimited blocks, or hook/MCP entries matching base_project markers. Preserve all neighboring user configuration. If a marker is missing, skip and report why. Verify final state and list removed, skipped, and failed items per tier.

