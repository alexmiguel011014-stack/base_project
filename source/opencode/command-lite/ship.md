---
# base_project:managed
description: Commit and push the current project's changes (lite). Checks readiness, then commits and pushes step by step.
---

Ship the current project's changes. Follow these steps in order. Do not skip a step.

STEP 1 — Look, do not touch yet.
Run: `git rev-parse --is-inside-work-tree`, `git status --porcelain=v2 --branch`, `git remote -v`, `git log -1`.
Use this to answer: is this a git repo? What branch? Anything staged/unstaged/untracked? Any remote? Any commit yet?

STEP 2 — Read $ARGUMENTS.
If $ARGUMENTS has text that reads like a commit message, save it as OVERRIDE_MESSAGE for step 6.
If $ARGUMENTS has text that reads like a scope hint (e.g. "only src/"), narrow staging to that scope in step 4.
If $ARGUMENTS is empty, ignore this step.

STEP 3 — Stop conditions. Check each one. If any matches, stop and do only what it says — do not go to step 4.
- Not a git repository → offer to run `git init`. Ask the user first. If yes, continue to step 4 (this will be the first commit).
- Detached HEAD → stop. Tell the user a commit here can be lost. Ask them to run `git checkout -b <name>` first, or to confirm they want to commit detached anyway.
- A merge, rebase, or cherry-pick is in progress (`.git/MERGE_HEAD` or `.git/rebase-merge` exists, or `git status` shows unmerged paths) → stop. Show the state. Do not touch anything. This is the user's call.
- `.git/index.lock` exists → stop. Do not delete it. Tell the user another git process may be running or may have crashed.
- Nothing staged/unstaged/untracked, and 0 commits ahead of the remote → report "up to date, nothing to ship" and stop.
- Nothing staged/unstaged/untracked, but N commits ahead of the remote → skip to step 7 (push). Do not commit again.

STEP 4 — Stage safely.
List every untracked and modified file.
Remove from that list, do not stage, and tell the user which and why:
- `.env` (but not `.env.example`), `*.pem`, `*_rsa`, `*_ed25519`, `credentials.json`, `*.key`
- Anything already matched by `.gitignore` but present in the working tree anyway
Then scan the actual content of what is left, not just filenames:
- If `gitleaks` is installed, run `gitleaks protect --staged --no-banner`.
- If not, search the diff for: `AKIA[0-9A-Z]{16}`, `sk-[a-zA-Z0-9]{20,}`, `ghp_[A-Za-z0-9]{36}`, a `-----BEGIN...PRIVATE KEY-----` line.
- Any hit → remove that file too, same as a filename match. Never stage it "just this once."
Flag any file over ~50MB. Ask the user whether it belongs in git, needs Git LFS, or should go in `.gitignore`.
Stage what is left by exact filename: `git add <file> <file> ...`. Never run `git add -A` or `git add .`.

STEP 5 — Quality gate.
Find the project's own lint/typecheck/test commands from its manifest (`package.json`, `pyproject.toml`, `Cargo.toml`, etc.) and run them.
If something fails: report the failure plainly. Ask the user: proceed anyway, or fix first? If they want to fix first, tell them to run `/fixproject` — do not fix it yourself here.
If everything passes, or there is no lint/test tooling configured, continue to step 6.

STEP 6 — Commit.
Write a Conventional Commits message (`feat:`, `fix:`, `refactor:`, `chore:`, etc.) from the staged diff. If OVERRIDE_MESSAGE exists from step 2, use that instead.
Show the message and the staged file list to the user. Then commit.
Never pass `--no-verify`. If the pre-commit hook fails, report it and stop — do not bypass it.
If a hook changes files (formatter/linter autofix), re-stage those files and make a new commit. Do not amend.

STEP 7 — Push.
Check these in order, act on the first one that matches:
- No remote configured → stop. If `gh` is installed and logged in (`gh auth status`), offer `gh repo create` (ask public or private). Otherwise tell the user to create the repo on github.com and run `git remote add origin <url>`. Never invent a remote URL yourself.
- This branch has never been pushed → run `git push -u origin <branch>`.
- Behind the remote, and a fast-forward is possible → run `git pull` (no `--rebase`, no `--force`), then push. If the pull conflicts, stop and show the conflict — do not resolve it yourself.
- Both ahead and behind (diverged) → stop. Show `git log` for both sides. Ask the user to choose merge or rebase. Never force-push to resolve this.
- Push rejected for any other reason → show the exact error. If it looks like an auth problem, suggest `gh auth status` or checking SSH keys. Never enter credentials or tokens for the user.
Never force-push in this command, no matter how the request is phrased.

STEP 8 — Confirm the push really happened.
Compare `git log --oneline -1` locally against the remote tip (`git ls-remote`, or `git log origin/<branch> -1` after a fetch). Do not trust a zero exit code alone.

STEP 9 — Check the default branch.
Find the repo's real default branch: `gh repo view --json defaultBranchRef` if `gh` is available, otherwise `git remote show origin`. Never assume it is `main` or `master`.
If the branch just pushed is NOT the default branch: this needs a clear, visible warning, not a footnote. Tell the user plainly: GitHub's repo homepage shows the default branch, so this push will not show up there until the branch is merged. The push worked — it just is not visible on the main repo page yet.
Mention `/pr` as the way to open that merge. Do not run `/pr` yourself.

STEP 10 — Report.
State plainly:
- What was committed: the message, and how many files.
- What was pushed: branch → remote, and the commit range.
- Whether the pushed branch is the default branch. If not, repeat the step 9 warning here, in full, not as a footnote.
- Anything skipped and why: secrets excluded, lint/test failures, files left out for manual review.

$ARGUMENTS
