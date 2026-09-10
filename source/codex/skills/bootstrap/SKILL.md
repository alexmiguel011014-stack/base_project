---
# base_project:managed
name: bootstrap
description: Synchronize and map the current project with base_project, graphify, and repomix. Use for $bootstrap or when a project needs its initial machine-readable map.
---

Prepare an unfamiliar project for efficient work without discarding local changes.

1. Inspect git state, branch, remote, upstream, and ahead/behind counts. If behind with no divergence, offer or perform only a fast-forward pull consistent with the user's request. Never auto-resolve conflicts, reset, or overwrite local work. If the current branch is this repo's default branch and non-trivial work is about to start, follow `AGENTS.md`'s "Multi-Agent Branching and Worktrees" rule (create an `<agent-id>/<slug>` branch/worktree) before editing.
2. Resolve the base_project repository from `~/.base_project/repo-path.txt`. If the unified store exists, run its read-only doctor/drift checks first. For drift, distinguish `status: drift` from `status: missing`; only drift is a discrepancy.
3. If the project itself is the canonical unified store or has configured sync behavior, use the repository's documented `sync pull`, `sync push`, or PR flow. Never guess a remote or publish changes without confirmation.
4. Run repomix using the project's existing configuration when available, excluding dependencies, generated artifacts, secrets, binaries, and vendored trees.
5. Run graphify for the current repository. If a required CLI is absent, give the exact installation or recovery step instead of failing opaquely.
6. Verify that `graphify-out/` and the expected repomix output exist and are substantive. Add generated outputs to `.gitignore` only when the user authorizes a project edit or the repository already defines that convention.
7. Open the generated HTML only when a browser/preview tool is available and doing so helps; otherwise report its absolute path.
8. Report sync state, generated artifacts, drift findings, and any manual recovery step.

