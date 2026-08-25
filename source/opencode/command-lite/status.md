---
# base_project:managed
description: Show the base_project version and everything active on this machine (lite). Plain name list, no explanations.
---

Report the base_project version and everything currently active. Names only, no descriptions.

STEP 1 — Version. Read `~/.base_project/repo-path.txt` for the repo path. Run `git -C <repo> describe --tags --always` in it. Read `version` from that repo's `package.json`. Show both unless they match — then show one.

STEP 2 — Active agents. List `.md` filenames (no extension) in `~/.config/opencode/agent/` that contain the `base_project:managed` marker.

STEP 3 — Active commands. List `.md` filenames (no extension) in `~/.config/opencode/command/` that contain the `base_project:managed` marker.

STEP 4 — Active hooks. Read `~/.claude/settings.json`. Walk every hook event. List the base filename of each command pointing into `base_project/hooks/`.

STEP 5 — Installed plugins. Read `~/.config/opencode/base_project/plugins.json` and `~/.config/opencode/mcp.json`. List catalog entries whose `id` appears as a key under `mcpServers`. For `skill`/`cli` entries with no reliable signal, write "catalog entry, install status unknown".

STEP 6 — Output format. Plain grouped lists, one name per line, no bullets, no prose:
```
base_project vX.Y.Z

Agents: <names>

Commands: <names>

Hooks: <names>

Plugins: <installed ones only>
```
Use exactly what steps 2-5 found — never a remembered or example list.

STEP 7 — If a category is empty, still show its label with nothing after it (e.g. `Plugins: (none detected)`).

$ARGUMENTS
