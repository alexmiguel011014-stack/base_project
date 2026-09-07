---
# base_project:managed
name: status
description: Show the installed base_project version and a terse inventory of active Codex skills, agents, hooks, MCP servers, and catalog capabilities. Use for $status or an explicit installation-status check.
---

Return names only, grouped compactly; do not explain each capability.

1. Resolve the base_project repository through `~/.base_project/repo-path.txt`, read `package.json`, and run `git describe --tags --always` there.
2. Skills: list folders under `~/.agents/skills/` whose `SKILL.md` contains `base_project:managed`.
3. Agents: list TOML files under `~/.codex/agents/` containing the same marker.
4. Hooks: read `~/.codex/hooks.json` and list command basenames pointing into `base_project/hooks/`.
5. MCP servers: read table names under `[mcp_servers.*]` in `~/.codex/config.toml`; list only those present.
6. Plugins: compare `~/.codex/base_project/plugins.json` with capabilities that Codex can actually detect. Mark catalog skill/CLI entries as status unknown when no reliable signal exists.
7. Keep empty categories as `(none detected)`. Derive all names from current files, never a memorized list.

Format:

```text
base_project vX.Y.Z
Skills: ...
Agents: ...
Hooks: ...
MCP: ...
Plugins: ...
```

