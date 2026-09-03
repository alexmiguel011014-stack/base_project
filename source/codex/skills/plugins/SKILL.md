---
# base_project:managed
name: plugins
description: Recommend and, after confirmation, install optional Codex plugins, skills, MCP servers, or CLIs appropriate to the current project. Use for $plugins or an explicit base_project capability request.
---

Help the user choose optional capabilities without guessing or silently changing global configuration.

1. Read `~/.codex/base_project/plugins.json`. If absent, direct the user to rerun the base_project installer.
2. If the invocation names a catalog profile, resolve its ids and confirm the exact list. Otherwise inspect project manifests and structure, then evaluate every catalog `recommend_if` condition against real evidence.
3. For uncovered needs, use Codex's installed plugin-discovery/management capability first, then authoritative web sources. Apply a minimum legitimacy bar: maintained source, real documentation, license, and recent activity. Label discoveries as unvalidated and separate them from catalog entries.
4. Present recommended catalog entries, non-recommended catalog entries, and live discoveries separately. Ask what to install. Never treat a recommendation as installation consent.
5. Use Codex-native installation mechanisms when available:
   - plugins/apps: use the Codex plugin management flow and its permission review;
   - skills: use the Codex skill installer and install to `~/.agents/skills/`;
   - MCP: follow current official Codex configuration, show whether scope is user or project, and preserve unrelated TOML content;
   - CLI: run only the documented install command after confirmation.
6. The catalog still contains Claude/OpenCode installation blocks. Treat those as metadata for those engines, never as commands to run in Codex. If no verified Codex action exists, show the source and skip installation rather than translating a command by guesswork.
7. For a live-discovered item, show the exact documented command/config change and obtain a second explicit confirmation. Prefer the narrowest supported scope.
8. Scan downloaded third-party skill or code directories with `node ~/.claude/base_project/scripts/scan-skill.js <path>` when available. Findings are advisory; show them and never auto-delete.
9. Record each successful install with `node ~/.claude/base_project/hooks/usage-log.js --install <id> --kind <kind> --origin <catalog|discovery>`. Never record declined or failed installs.
10. Never write inside the inspected project unless the chosen Codex mechanism genuinely requires project-local config and the user confirms that scope.
11. Report installed, skipped, scan findings, granted scope, and required follow-up. Never expose secrets.

