---
# base_project:managed
name: pr
description: Draft and open a pull request from the current branch after explicit confirmation. Use for $pr or a direct request to create a PR; never merge it.
---

1. Confirm a git repository, current branch, clean tree, pushed commits, GitHub CLI availability/authentication, and whether a PR already exists. If changes or commits are unshipped, stop and direct the user to `$ship`; never chain it automatically.
2. Determine the real default/base branch from `gh repo view --json defaultBranchRef` or remote metadata. A PR cannot originate from that same branch.
3. Draft from `git log <base>..HEAD` and `git diff <base>...HEAD --stat`, not conversation memory. Use one commit's subject when appropriate; otherwise summarize the series. Include a short Summary and only a concrete Test plan.
4. Show title, body, base branch, and draft/ready choice. Even when arguments provide overrides, wait for explicit confirmation.
5. Create with `gh pr create`, adding only fields the user requested. Never add reviewers, labels, or assignees by assumption.
6. Report URL, draft/ready state, and base. Never merge under this skill.

