---
# base_project:managed
description: Draft and open a pull request for the current branch (lite). Confirms title/body before creating anything.
---

Open a pull request for the current branch: draft it from real commit history, show it, then create it only after confirmation.

STEP 1 — Look, do not touch yet.
- `git rev-parse --is-inside-work-tree` — confirm this is a git repo.
- `git branch --show-current` — the current branch. If it's the repo's default branch (step 2), stop. Suggest `git checkout -b <name>` first.
- `gh --version` and `gh auth status`. If `gh` isn't installed or not logged in, stop and guide: install from https://cli.github.com, then `gh auth login`.
- `git status --porcelain` and ahead/behind against upstream. If there are uncommitted changes or unpushed commits, stop — tell the user to run `/ship` first. Never commit or push from inside this command.
- `gh pr view --json url,state` for the current branch. If a PR already exists, report its URL and state and stop. Never open a second PR for the same branch.

STEP 2 — Find the base branch: `gh repo view --json defaultBranchRef`, or `git remote show origin` if `gh` can't resolve it. Never assume `main`.

STEP 3 — Draft the PR from real history, not memory:
- `git log <base>..HEAD --oneline` for the commit list.
- `git diff <base>...HEAD --stat` for the file-level shape.
- Title: one commit → use its subject line. Several commits → write one summary line.
- Body: a short "## Summary" (1-3 bullets, from the real commits/diff) and a "## Test plan" only if there's something concrete to check.

STEP 4 — Show the drafted title and body. Confirm the base branch from step 2 is right. Ask draft vs. ready-for-review. Wait for explicit confirmation. If $ARGUMENTS supplies a title/body, use that instead of drafting, but still confirm before creating.

STEP 5 — On confirmation: `gh pr create --title "<title>" --body "<body>" --base <base>` (add `--draft` if asked). Never add reviewers, labels, or assignees unless explicitly asked.

STEP 6 — Report: the PR URL, its state, and its base branch. Never merge it — that's a separate action.

$ARGUMENTS
