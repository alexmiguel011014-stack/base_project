---
# base_project:managed
description: Draft and open a pull request for the current branch, from the real commit range against its base branch. Confirms the title/body before creating anything — the step /ship's own step 9 points at but never runs itself.
---

Open a pull request for the current branch: draft the title/body from the real commit history,
show it before doing anything, then create it only on confirmation — the same "guide, never
force" contract `/ship` already uses for every git operation in this project.

1. **Read-only inventory first** — build the full picture before touching anything:
   - `git rev-parse --is-inside-work-tree` to confirm this is a git repo.
   - `git branch --show-current` — the current branch. If it's the repo's default branch (see
     step 2), stop: a PR needs a branch distinct from the base. Suggest `git checkout -b <name>`
     first.
   - `gh --version` and `gh auth status` — if `gh` isn't installed or not authenticated, stop and
     guide (install from https://cli.github.com, then `gh auth login`) rather than trying to open
     a PR through the GitHub web UI on the user's behalf.
   - `git status --porcelain` and the branch's ahead/behind against its upstream. If there are
     uncommitted changes or unpushed commits, this isn't a "create PR" situation yet — it's a
     "run `/ship` first" situation. Say so and stop; never chain into committing/pushing from
     inside this command. That stays `/ship`'s job, the same separation `/fixproject` keeps from
     `/scanproject`.
   - `gh pr view --json url,state` for the current branch — if a PR already exists (open or
     merged), report its URL and state and stop. Never open a second PR for the same branch.

2. **Determine the base branch** from the repo itself, not assumed to be `main`: `gh repo view
   --json defaultBranchRef`, or `git remote show origin` if `gh` doesn't resolve it.

3. **Draft the PR from the real commit range**, not from conversation memory:
   - `git log <base>..HEAD --oneline` for the commit list.
   - `git diff <base>...HEAD --stat` for the file-level shape of the change.
   - Title: if there's exactly one commit, use its subject line (same Conventional Commits
     convention `/ship` already drafts with). If there are several, summarize the overall change
     in one line rather than arbitrarily picking one commit's subject.
   - Body: a short "## Summary" (1-3 bullets, what changed and why, drawn from the actual
     commits/diff) and a "## Test plan" section only if there's something concrete to check —
     omit it rather than inventing filler.

4. **Show the drafted title and body**, confirm the base branch guessed in step 2 is right, and
   ask draft vs. ready-for-review — then wait for explicit confirmation before creating anything.
   If `$ARGUMENTS` supplies a title/body override, use that instead of drafting, but still confirm
   before creating.

5. **On confirmation**: `gh pr create --title "<title>" --body "<body>" --base <base>` (add
   `--draft` if asked for a draft). Never add reviewers, labels, or assignees unless the user
   explicitly asked for them.

6. **Report**: the PR URL, its state (draft/ready), and the base it targets. Never merge it —
   that's a separate, explicit action outside this command's scope, the same boundary `/ship`
   already draws around running `gh pr create` itself.

$ARGUMENTS
