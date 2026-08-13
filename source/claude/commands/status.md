---
# base_project:managed
description: Show the base_project version and a plain name-only list of everything currently active on this machine (agents, commands, hooks, plugins). No explanations.
---

Report the base_project version and everything currently active, as a bare list of
names — no descriptions, no explanations of what each thing does.

1. **Version**: read `~/.claude/base_project/repo-path.txt`-style tracked repo path if
   available, or fall back to asking `git -C <repo> describe --tags --always` in the
   base_project repository itself (find it via `~/.base_project/repo-path.txt`). Also
   read `version` from that repo's `package.json`. Show both, e.g.
   `base_project v1.0.0 (git: v1.0.0)` — if the git tag and package.json version match,
   just show one.

2. **Active agents**: list the `.md` filenames (without extension) present in
   `~/.claude/agents/` that contain the `base_project:managed` marker.

3. **Active commands**: list the `.md` filenames (without extension) present in
   `~/.claude/commands/` that contain the `base_project:managed` marker.

4. **Active hooks**: read `~/.claude/settings.json`, walk every hook event
   (`PostToolUse`, `SessionStart`, etc.) and list the base filename of each command that
   points into `base_project/hooks/` or `base_project/dashboard/`.

5. **Installed plugins** (from the base_project catalog specifically, not everything
   installed on the machine): read `~/.claude/base_project/plugins.json`, and for each
   catalog entry, check if it's actually installed — same detection base_project already
   uses elsewhere (`claude plugin list --json` for entries with a `pluginName`, or just
   note "catalog entry, install status unknown" if there's no reliable signal for that
   kind). List only the ones detected as installed.

6. Output format: plain grouped lists, one name per line, no bullet-point explanations,
   no prose paragraphs — just:

```
base_project vX.Y.Z

Agents: architect, coder, reviewer

Commands: newproject, scanproject, cleanproject, fixproject, bootstrap, audit, plugins, council, wpp, status

Hooks: loop-detect, post-edit-format, session-start-git-context

Plugins: <installed ones only>
```

7. If a category is empty, still show its label with nothing after it (e.g.
   `Plugins: (none detected)`) rather than omitting the line — the point is a complete
   snapshot, not just the good news.

$ARGUMENTS
