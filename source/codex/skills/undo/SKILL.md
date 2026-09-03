---
# base_project:managed
name: undo
description: Safely roll back the latest uncommitted or committed change with separate confirmation gates by risk. Use only for $undo or an explicit rollback request.
---

Inventory git state, current branch, uncommitted files, last commit, upstream, and whether that commit was pushed. Show the exact target before any action.

Choose one target per run unless arguments name another:

1. Uncommitted tracked changes: show diff/stat, confirm, then `git restore` only the listed paths; handle staged state explicitly.
2. Untracked files: list every path and confirm separately because deletion has no git recovery. Use targeted removal only, never a broad clean sweep.
3. Unpushed last commit: show its stat and offer `git reset --soft HEAD~1` by default. Mixed or hard reset requires an explicit request; hard reset requires a second confirmation naming the discarded diff.
4. Already-pushed last commit: never reset or force-push. Show the commit and confirm a safe `git revert HEAD` that adds history.

Never chain tiers automatically. A blanket “undo everything” does not pre-authorize destructive tiers. After acting, verify with status and log, then report exactly what changed and what remains.

