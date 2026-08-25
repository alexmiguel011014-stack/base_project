---
# base_project:managed
description: Guided rollback of the most recent batch of change (lite). Tiered confirmation by risk.
---

Undo the most recent batch of change in the current project. Risk is tiered by what's actually being undone — confirm each tier separately, never bundle them, never touch a tier the user didn't confirm.

STEP 1 — Look, do not touch yet.
- `git rev-parse --is-inside-work-tree` — if this isn't a git repo, say so and stop.
- `git status --porcelain=v2 --branch` — staged/unstaged/untracked files, branch, ahead/behind.
- `git log -1 --oneline` — the most recent commit, if any.
- Whether that commit was pushed: compare `HEAD` against `@{u}`. At or behind the upstream tip = pushed. Ahead of it = not pushed.

STEP 2 — Decide the target, in this order, unless `$ARGUMENTS` names one specifically (a commit hash, "the last commit", "uncommitted changes"):
- Uncommitted changes exist → that's the target.
- No uncommitted changes, last commit unpushed → that's the target.
- No uncommitted changes, last commit already pushed → that's the target, highest-risk tier (Tier 3).
- Nothing to undo → say so and stop.

STEP 3 — Tier 1, uncommitted tracked-file changes. Show `git diff` (`--stat` first if large). Ask before restoring. On yes: `git restore <files>` (add `--staged` too if staged) for exactly the files shown — never a bare `git restore .`.

STEP 4 — Tier 1b, uncommitted untracked new files. List them by path. Ask separately: "Also delete these N untracked files? This can't be undone. (y/n)". On yes: `git clean` targeted at exactly those paths — never a bare `git clean -fd`.

STEP 5 — Tier 2, last commit not yet pushed. Show `git show --stat HEAD`. Default offer: `git reset --soft HEAD~1` (keeps the change staged, nothing lost). Only offer `--mixed` or `--hard` if the user explicitly asks. For `--hard`, require a second explicit confirmation naming exactly what will be discarded.

STEP 6 — Tier 3, last commit already pushed. Never offer `git reset` here — this project never force-pushes, in any command. The only safe undo is `git revert HEAD`. Show `git show --stat HEAD` first, explain that reset isn't an option because it would need a force-push over a commit others may already have pulled, then confirm before running `git revert HEAD --no-edit` (or without `--no-edit` if the user wants their own message).

STEP 7 — Never chain tiers automatically. If both uncommitted changes and an unpushed commit exist, handle only the one selected in step 2, then stop and mention the other exists.

STEP 8 — After acting, verify directly (`git status`, `git log -1`) rather than trusting the exit code. Report exactly what changed and the repo's state now.

STEP 9 — The tiered confirmation in steps 3-6 always applies, even if `$ARGUMENTS` implies confidence ("undo everything", "just do it") — one instruction doesn't pre-authorize every tier at once.

$ARGUMENTS
