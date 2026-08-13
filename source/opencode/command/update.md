---
# base_project:managed
description: Check for base_project updates (git pull in the source repo) and re-run the installer if the user confirms. Never touches an unrelated project.
---

Check whether base_project itself has updates available, and apply them if the user
confirms. This never touches the current project — it operates on base_project's own
source repository, located via `~/.base_project/repo-path.txt`.

1. Read `~/.base_project/repo-path.txt` to find the base_project repo path. If the file
   doesn't exist, tell the user to run the installer once from a clone of the repo
   first, then stop.

2. Run `git -C <repo> status --porcelain` in that repo. If it reports any uncommitted
   changes, **stop and report them** — never `git stash`, `git reset`, or `git pull`
   over uncommitted work. Tell the user to commit or stash their base_project changes
   first, then run `/update` again.

3. Run `git -C <repo> fetch origin` (or the repo's configured remote), then compare the
   current branch against its upstream (`git -C <repo> rev-list --left-right --count
   HEAD...@{u}`, or equivalent).
   - If already up to date: report the current version (read `version` from the repo's
     `package.json`, and `git -C <repo> describe --tags --always`) and stop — nothing
     to do.
   - If behind: show what's new — `git -C <repo> log HEAD..@{u} --oneline` (commit
     count + one-line summaries), and the version that would result (read
     `package.json`'s `version` field from the remote tip if easy to check, otherwise
     just show the commit log).

4. If there are updates, ask the user to confirm before doing anything (pulling and
   re-running the installer changes real files in `~/.claude`/`~/.config/opencode` and
   re-registers hooks/MCP servers — not a silent operation).

5. On confirmation:
   - `git -C <repo> pull` (plain, no `--rebase`/`--force` — if this fails or produces a
     merge conflict, stop and report it verbatim; never resolve conflicts automatically).
   - Re-run the installer for this OS: `powershell -File <repo>\dev\scripts\install.ps1`
     on Windows, `bash <repo>/dev/scripts/install.sh` on Mac/Linux.
   - Report the version before → after, and a short summary of what changed (new
     commands, new hooks, anything notable from the commit log in step 3).

6. Never push, force-push, or modify the remote — this command only ever pulls.

$ARGUMENTS
