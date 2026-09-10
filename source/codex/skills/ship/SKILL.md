---
# base_project:managed
name: ship
description: Validate, commit, and push the current project's changes safely. Use only when the user invokes $ship or explicitly asks to commit and push.
---

Ship the current changes without force-pushing, hiding blockers, or staging surprises.

### Batching and stopping
- Batch independent reads and checks, reuse evidence already gathered, and validate once at each area boundary. Stop after the scoped work is verified complete or a real blocker requires user input; do not speculate, retry blindly, or continue into unrelated work. Never use batching or stopping to bypass plan, safety, or diary boundaries.

1. Inventory first: confirm a git work tree; read porcelain-v2 status with branch/ahead/behind; inspect remotes, upstream, last commit, and merge/rebase/cherry-pick state.
2. Treat invocation arguments as a commit-message override when they read like one, otherwise as a scope hint. Never expand a scoped request silently.
3. Stop and guide on detached HEAD, unmerged state, active operation, index lock, missing repository, or ambiguous divergence. Never delete locks, resolve conflicts, invent remotes, or rewrite history.
4. If the tree is clean and nothing is ahead, report nothing to ship. If clean but ahead, skip directly to push readiness.
5. Before staging, list exact files. Exclude secret-shaped files, scan staged content with gitleaks when available or high-signal credential patterns otherwise, and flag files around or above 50 MB. Stage explicit paths only—never blanket `git add .` or `git add -A`.
6. Detect and run the project's own relevant lint, typecheck, tests, and build. On failure, stop before committing and ask whether the user wants a known-WIP checkpoint or a separate `$fixproject`; do not fix inline.
7. Draft a Conventional Commit message from the staged diff unless overridden. Show the message and staged files, then commit. Never use `--no-verify`. If hooks rewrite files, re-stage and create another commit rather than amending.
8. For push: require a confirmed remote; use `git push -u origin <branch>` for first upstream; plain pull only when safely fast-forwardable; stop on divergence, conflicts, authentication errors, or protected branches. Never force-push under this skill.
9. Verify the remote tip after pushing.
10. Determine the actual default branch from GitHub or the remote. If the pushed branch is not default, prominently explain that the repository homepage will not show it until merged and point to `$pr`; never create the PR automatically. Pushing the default branch directly from an agent session is exactly the case `AGENTS.md`'s "Multi-Agent Branching and Worktrees" rule exists to avoid — mention it, but still ship whatever branch was asked; this skill does not block the push.
11. Report commit message and file count, pushed branch/remote/range, default-branch status, exclusions, and blockers.
