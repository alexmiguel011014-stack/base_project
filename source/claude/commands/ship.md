---
# base_project:managed
description: Commit and push the current project's changes. Checks readiness first — clean state, no secrets, lint/test passing, remote configured — and gives a step-by-step guide for whichever check fails instead of a raw git error. Never force-pushes, never resolves conflicts automatically.
---

Ship the current project's changes: verify it's actually ready, then commit and push —
guiding through any blocker instead of failing silently or working around it.

1. Read-only inventory first — build the full picture before touching anything:
   - `git rev-parse --is-inside-work-tree` to confirm this is a git repo.
   - `git status --porcelain=v2 --branch` for branch, ahead/behind counts, staged/unstaged/
     untracked files, and merge/rebase state.
   - `git remote -v` for configured remotes.
   - `git log -1` to check whether there's any commit yet.

2. If `$ARGUMENTS` isn't empty, treat it as a commit message override, or a scope hint
   (e.g. "only the src/ changes") if it doesn't read like a message — otherwise draft the
   message yourself in step 6 and stage everything relevant.

3. Stop-and-guide checks — run these BEFORE staging or committing anything. Each has a
   specific guide, not a raw error dump:

   **Not a git repository**: offer to run `git init` (safe, fully reversible — undoing it
   is just deleting `.git/`). Ask first since it's a real decision for the whole project;
   on yes, continue to step 4 onward, this will be the initial commit.

   **Detached HEAD**: stop. Explain what it means and that a commit made here can get
   stranded once another branch is checked out. Ask the user to `git checkout -b <name>`
   first, or explicitly confirm they want to commit detached anyway.

   **Merge/rebase/cherry-pick in progress** (`.git/MERGE_HEAD`, `.git/rebase-merge`, or
   `git status` reporting unmerged paths): stop immediately, report the state verbatim,
   touch nothing — resolving this is the user's call, never automatic.

   **`.git/index.lock` exists**: do not delete it. Tell the user another git process may
   be running (or crashed) and to check before removing it manually.

   **Nothing to commit and nothing to push** (clean tree, 0 ahead): report "up to date,
   nothing to ship" and stop.

   **Nothing to commit but commits ahead of remote** (clean tree, N ahead): skip straight
   to step 7 (push) — no need to commit first.

4. Staging and safety scan (only if there's something to commit):
   - List untracked + modified files. Flag anything that looks like a secret before
     staging it — `.env` (not `.env.example`), `*.pem`, `*_rsa`/`*_ed25519`,
     `credentials.json`, `*.key`, or anything matching a pattern already in `.gitignore`
     but present anyway. Exclude flagged files from staging and tell the user exactly
     which ones and why — never stage them silently, even if `$ARGUMENTS` implies
     "everything".
   - Flag any file over ~50MB (GitHub's soft limit) before staging — ask whether it
     belongs in git at all, needs Git LFS, or should be added to `.gitignore` instead.
   - Stage by explicit name (`git add <file> <file> ...`) — never a blanket `git add -A`
     or `git add .`, so nothing unexpected rides along.

5. Quality gate before committing — detect and run the project's own lint/typecheck/test
   commands from its manifest (same detection the `reviewer` subagent already does). If
   something fails:
   - Report the failure plainly and stop before committing.
   - Ask whether to proceed anyway (sometimes a checkpoint commit of known-WIP is
     intentional) or fix first — point at `/fixproject` rather than fixing inline here,
     this command's job is shipping, not fixing.
   If everything passes, or the project has no lint/test tooling configured, continue.

6. Commit:
   - Draft a Conventional Commits message (`feat:`/`fix:`/`refactor:`/`chore:`/etc.) from
     the actual staged diff — same convention the `reviewer` subagent uses. If
     `$ARGUMENTS` supplied a message, use that instead of drafting one.
   - Show the message and the staged file list, then commit. Never skip hooks
     (`--no-verify`) — if a pre-commit hook fails, report it and stop; investigate the
     real cause instead of bypassing it.
   - If a hook rewrites files (formatter/linter autofix), re-stage and create a new
     commit rather than amending.

7. Push readiness — check divergence against the upstream before pushing:

   **No remote configured**: stop and guide, never invent one:
   1. If `gh` is installed and authenticated (`gh auth status`), offer `gh repo create`
      (ask visibility: public/private) — it also sets the remote.
   2. Otherwise guide manually: create the repo on github.com, then
      `git remote add origin <url>`.
   3. Never guess a remote URL or push to one not explicitly confirmed by the user.

   **No upstream tracking branch yet** (first push of this branch): use
   `git push -u origin <branch>`, not a plain `git push`.

   **Behind remote, fast-forward possible**: pull first (`git pull`, plain — no
   `--rebase`/`--force`), then push. If the pull produces a conflict, stop and report it
   verbatim — never resolve automatically.

   **Diverged (both ahead and behind)**: stop. Explain the situation, show a short
   `git log` for both sides, and let the user choose merge vs. rebase — never pick for
   them, never force-push to resolve it.

   **Push rejected for any other reason** (auth failure, protected branch, etc.): report
   the exact error. For auth failures, suggest checking `gh auth status` or SSH key setup
   — never enter credentials or tokens on the user's behalf.

   **Never force-push** in this command, regardless of phrasing or argument — an explicit
   force-push request is a separate, explicit action outside `/ship`, not something this
   command does even if asked to "make it work".

8. After pushing, verify the remote actually moved — compare local `git log --oneline -1`
   against the remote tip (`git ls-remote` or `git log origin/<branch> -1` after a fetch)
   rather than trusting a zero exit code alone.

9. If `gh` is available and the current branch isn't `main`/`master`, mention that
   `gh pr create` is available as a next step — do not run it unless asked; this
   command's scope is shipping the branch, not opening the PR.

10. Report: what was committed (message + file count), what was pushed (branch → remote,
    commit range), and anything skipped with the reason (secrets excluded, lint failures,
    files left for manual review).

$ARGUMENTS
