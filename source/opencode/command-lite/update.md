---
# base_project:managed
description: Check for base_project updates and apply them if confirmed (lite). Only touches base_project's own repo, never the current project.
---

Check base_project's own source repo for updates and apply them if the user confirms. Never touches the current project.

STEP 1 — Read `~/.base_project/repo-path.txt` for the repo path. If it doesn't exist, tell the user to run the installer once from a clone of the repo, then stop.

STEP 2 — Run `git -C <repo> status --porcelain`. If it shows any uncommitted changes, stop. Tell the user to commit or stash their base_project changes first, then run `/update` again. Never stash, reset, or pull over uncommitted work.

STEP 3 — Run `git -C <repo> fetch origin`. Compare the current branch against its upstream (`git -C <repo> rev-list --left-right --count HEAD...@{u}`).
- Up to date → report the current version (`package.json` version + `git describe --tags --always`) and stop.
- Behind → show what's new: `git -C <repo> log HEAD..@{u} --oneline`.

STEP 4 — If there are updates, ask the user to confirm before doing anything. This changes real files in `~/.claude`/`~/.config/opencode`.

STEP 5 — On confirmation: run `git -C <repo> pull` (plain, no `--rebase`, no `--force`). If it fails or conflicts, stop and show the error exactly — never resolve it yourself. Then re-run the installer for this OS: `powershell -File <repo>\dev\scripts\install.ps1` on Windows, `bash <repo>/dev/scripts/install.sh` on Mac/Linux. Report the version before → after and what changed.

STEP 6 — Never push, force-push, or modify the remote. This command only pulls.

$ARGUMENTS
