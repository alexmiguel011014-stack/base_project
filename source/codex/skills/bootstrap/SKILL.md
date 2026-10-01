---
# base_project:managed
name: bootstrap
description: Synchronize the current project with its remote and map it with graphify and repomix. Use for $bootstrap or when a project needs its initial machine-readable map.
---

Prepare an unfamiliar project for efficient work without discarding local changes.

1. Inspect git state, branch, remote, upstream, and ahead/behind counts. If behind with no divergence, offer or perform only a fast-forward pull consistent with the user's request. Never auto-resolve conflicts, reset, or overwrite local work.
2. Run repomix using the project's existing configuration when available, excluding dependencies, generated artifacts, secrets, binaries, and vendored trees.
3. Run graphify for the current repository. If a required CLI is absent, give the exact installation or recovery step instead of failing opaquely.
4. Verify that `graphify-out/` and the expected repomix output exist and are substantive. Add generated outputs to `.gitignore` only when the user authorizes a project edit or the repository already defines that convention.
5. Open the generated HTML only when a browser/preview tool is available and doing so helps; otherwise report its absolute path.
6. Report sync state, generated artifacts, and any manual recovery step.

