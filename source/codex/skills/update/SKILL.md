---
# base_project:managed
name: update
description: Check and apply updates to the base_project repository and rerun its installer after confirmation. Use only for $update or an explicit base_project update request.
---

Update base_project itself, never the current unrelated project.

1. Resolve the source repository from `~/.base_project/repo-path.txt`. Validate it is the expected git repository and inspect local changes, branch, upstream, ahead/behind, and remote.
2. Fetch and report whether an update exists. If the base_project worktree has local changes, is diverged, or has no safe fast-forward path, stop and explain; never stash, reset, merge, or rebase automatically.
3. Show incoming commits and ask for explicit confirmation before changing anything.
4. On confirmation, fast-forward pull only, then rerun the platform installer from that repository. Installer changes to global Codex/Claude/opencode configuration are part of the confirmed update, but unrelated project files are not.
5. Verify the new revision and installer result. Report updated revision, installed surfaces, and any skipped registration.

