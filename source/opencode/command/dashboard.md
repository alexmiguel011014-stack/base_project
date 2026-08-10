---
# base_project:managed
description: Open the local live dashboard of plugin/MCP usage across all your projects.
---

Start (if not already running) and open the base_project usage dashboard:

1. Run `node "~/.config/opencode/base_project/dashboard/launch.js"` (resolve `~` to the
   real home directory for this OS before running).
2. If the log file `~/.base_project/usage.jsonl` doesn't exist yet or is empty, tell the
   user it will populate as they use tools in any project — nothing to fix, just no data yet.
3. If `node` isn't found, tell the user to install Node.js first.
4. Report only the URL it opened (`http://127.0.0.1:4317/` unless overridden by
   `BASE_PROJECT_DASHBOARD_PORT`).

$ARGUMENTS
