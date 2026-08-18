---
# base_project:managed
description: Guided rollback of the most recent batch of uncommitted or automated change (from /execgoals, /fixproject, or manual edits). Tiered confirmation by risk — never git reset --hard or force-push without a separate explicit gate, always shows what would be lost before acting.
---

Undo the most recent batch of change in the current project — the same "guide, never force"
contract `/ship`/`/uninstall`/`/update` already use for every risky git operation in this project.
Risk is tiered by what's actually being undone; confirm each tier separately, never bundle them
under one yes/no, and never touch a tier the user didn't confirm.

1. **Read-only inventory first** — build the real picture before proposing anything:
   - `git rev-parse --is-inside-work-tree` — confirm this is a git repo. If not, there's nothing
     this command can do; say so and stop.
   - `git status --porcelain=v2 --branch` — staged/unstaged/untracked files, branch, ahead/behind.
   - `git log -1 --oneline` — the most recent commit, if any.
   - Whether that commit has been pushed: compare `HEAD` against `@{u}` (upstream). A commit at or
     behind the upstream tip has been pushed; one ahead of it hasn't.

2. **Decide what "the last batch" means**, in this priority order (most recent, most reversible
   first) — unless `$ARGUMENTS` names a specific target ("the last commit", "uncommitted
   changes", a commit hash), in which case use that instead:
   - Uncommitted changes exist (staged or unstaged) → that's the target. This is what
     `/execgoals`/`/fixproject` leave behind before anything gets committed.
   - No uncommitted changes, but the last commit is ahead of the upstream (unpushed) → that's the
     target.
   - No uncommitted changes and the last commit is already pushed → that's the target, but it's
     the highest-risk tier (3c below), since undoing it safely means adding a new commit, not
     rewriting history.
   - Nothing uncommitted and nothing local-only to undo → say so and stop, nothing to do.

3. **Tiered confirmation** — show the concrete diff/commit before asking, never a vague "undo
   everything?":

   **Tier 1 — uncommitted, tracked-file changes** (safest, but still real work that could be
   lost): show `git diff` (or `git diff --stat` first if it's large, full diff on request). Ask
   separately from untracked files (tier 1b) — restoring tracked changes and deleting untracked
   files are different kinds of loss. On confirmation: `git restore <files>` (add `--staged` too
   if staged) for exactly the files shown — never a bare `git restore .` without having shown
   what it covers.

   **Tier 1b — uncommitted, untracked new files** (higher risk than 1a — no commit history to
   recover from, deleting them is permanent): list them explicitly by path. Ask separately:
   "Also delete these N untracked files? This can't be undone the way restoring a tracked file
   can — they were never committed. (y/n)". On confirmation: `git clean` targeted at exactly the
   listed paths, never a bare `git clean -fd` sweep of the whole tree.

   **Tier 2 — last commit, not yet pushed** (reversible, nothing external depends on it yet):
   show `git show --stat HEAD`. Offer `git reset --soft HEAD~1` as the default (keeps the change
   staged, nothing lost — just uncommits it). Only offer `--mixed` (unstaged) or `--hard`
   (discards the diff entirely) if the user explicitly asks for one of those; for `--hard`
   specifically, require a second, explicit confirmation naming exactly what will be discarded —
   the same spirit as `/uninstall`'s tiered gates for its riskiest actions.

   **Tier 3 — last commit, already pushed** (highest risk — rewriting a pushed commit means
   force-pushing, which this project never does, in any command, regardless of phrasing): never
   offer `git reset` here. The only safe undo is `git revert HEAD` — a new commit that undoes the
   change without touching history. Show `git show --stat HEAD` first, explain why reset isn't an
   option (it would require force-pushing over a commit others may already have pulled), then
   confirm before running `git revert HEAD --no-edit` (or without `--no-edit` if the user wants to
   write their own revert message).

4. **Never chain tiers automatically.** If both uncommitted changes and an unpushed commit exist,
   handle only the one `$ARGUMENTS` or step 2's priority order selected, then stop and mention the
   other exists rather than resolving both in one pass.

5. **After acting, verify directly** (`git status`, `git log -1`) rather than trusting the
   command's exit code alone, and report exactly what changed: what was restored, deleted, reset,
   or reverted, and the repository's state now.

6. **The tiered gate in step 3 always applies**, even if `$ARGUMENTS` seems to imply confidence
   ("undo everything", "yes just do it") — a single blanket instruction doesn't pre-authorize
   every tier at once.

$ARGUMENTS
