---
# base_project:managed
description: Show the base_project version and a plain name-only list of everything currently active on this machine (agents, commands, hooks, plugins). No explanations.
---

Report the base_project version and everything currently active, as a bare list of
names — no descriptions, no explanations of what each thing does.

1. **Version**: find the base_project repo path via `~/.base_project/repo-path.txt`,
   then run `git -C <repo> describe --tags --always` in it, and read `version` from
   that repo's `package.json`. Show both, e.g. `base_project v1.0.0 (git: v1.0.0)` — if
   the git tag and package.json version match, just show one.

2. **Active agents**: list the `.md` filenames (without extension) present in
   `~/.config/opencode/agent/` that contain the `base_project:managed` marker.

3. **Active commands**: list the `.md` filenames (without extension) present in
   `~/.config/opencode/command/` that contain the `base_project:managed` marker.

4. **Active hooks**: read `~/.claude/settings.json` (base_project's Claude Code hooks —
   opencode itself doesn't have an equivalent hook-registration file for these), walk
   every hook event and list the base filename of each command that points into
   `base_project/hooks/`.

5. **Installed plugins** (from the base_project catalog specifically): read
   `~/.config/opencode/base_project/plugins.json` and `~/.config/opencode/mcp.json` —
   list catalog entries whose `id` appears as a key under `mcpServers` in `mcp.json`
   (opencode's MCP registration is file-based, unlike Claude Code's CLI-based one, so
   this is the reliable signal here). For `skill`/`cli` kind entries with no reliable
   detection signal, note "catalog entry, install status unknown".

6. Output format: plain grouped lists, one name per line, no bullet-point explanations,
   no prose paragraphs — just:

```
base_project vX.Y.Z

Agents: architect, coder, reviewer

Commands: newproject, goals, scanproject, cleanproject, fixproject, bootstrap, audit, plugins, council, wpp, status, reviewusage

Hooks: loop-detect, post-edit-format, session-start-git-context, usage-log

Plugins: <installed ones only>
```

7. If a category is empty, still show its label with nothing after it (e.g.
   `Plugins: (none detected)`) rather than omitting the line — the point is a complete
   snapshot, not just the good news.

$ARGUMENTS
