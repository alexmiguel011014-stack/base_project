## base_project — Global Operating Rules for Codex

These rules apply in every project unless a project-local `AGENTS.md` overrides them.

### Token Economy
- Never fully read `external/`, `node_modules/`, `.venv/`, or other vendored/dependency directories.
- Before scanning an unfamiliar codebase, check for `graphify-out/`; if missing, run `$bootstrap` first.
- When editing, show only changed lines with minimal surrounding context; never rewrite whole files unless asked.
- Optimize correctness per token: preserve the context and reasoning depth needed for a reliable result; reduce rework and redundant tool calls before reducing effort.

### Quality-per-token profiles
- Routine, short, well-scoped work may use low/medium effort.
- Complex changes, cross-file work, or ambiguous failures keep high effort; use `xhigh`/`max` only when the value of deeper reasoning is clear.
- Research and unrelated tasks should be isolated when practical; use `/clear` between unrelated tasks, `/compact` at natural breaks, and `/rewind` when abandoning a path.
- Never impose a universal low-effort, output, turn, or context cap before comparing correctness and rework against the baseline.

### Batching and stopping
- Batch independent reads and checks, reuse evidence already gathered, and validate once at each area boundary. Stop after the scoped work is verified complete or a real blocker requires user input; do not speculate, retry blindly, or continue into unrelated work. Never use batching or stopping to bypass plan, safety, or diary boundaries.

### Security
- Never commit or hardcode real API keys, tokens, or credentials in a project repository.
- Read runtime secrets from the project's own gitignored `.env`. MCP credentials belong in Codex user configuration, never in a project repository.

### Workflow
1. **Plan** — use the read-only `architect` subagent before non-trivial changes.
2. **Implement** — use the `coder` subagent for surgical, scoped edits.
3. **Review** — use the `reviewer` subagent to inspect the diff and run the project's lint, typecheck, and tests. It never commits unless explicitly asked.
4. **Plan is not execution** — a planning or research skill such as `$newgoal` or `$repertoire` never implements its output in the same turn. `$execgoals`, or a separate explicit request, performs execution.
5. **Tiered autonomy** — classify every action before taking it: **auto-approved** for routine, reversible work inside the current repository; **notify-and-proceed** for an in-scope, reversible change whose visible effect should be stated before continuing; and **human-in-the-loop** for an irreversible or hard-to-recover action, a material scope choice, data/state outside base_project's own repository, sensitive data, credentials, or external publication. Decide from reversibility, scope of affected state, and data sensitivity — not from whether the action merely looks technically easy. The ERP database compatibility test is the model case for human-in-the-loop: even a copied test database was external sensitive data, so it required explicit approval first.

### Multi-Agent Branching and Worktrees
- Non-trivial work happens on its own `<agent-id>/<slug>` branch, never directly on `main` (or
  the repository's actual default branch, resolved the same way `$ship` already does, never
  assumed). `<agent-id>` is a short lowercase identifier for whichever AI is doing the work
  (`claude`, `codex`, `opencode`, or another explicit identifier); `<slug>` is a short
  kebab-case task description.
- Codex has no native worktree tool, so create one manually before editing:
  `git worktree add ../<repo>-<agent-id>-<slug> -b <agent-id>/<slug>`, then work inside that
  directory, so a concurrent AI or human never edits the same working directory or branch.
- `main` only receives reviewed, merged work through `$pr`; never push work-in-progress
  directly to it. Once a branch merges, remove its worktree and branch (`git worktree remove`,
  delete the branch) instead of leaving it to accumulate.
- Why this exists: more than one AI editing the same project without this isolation is exactly
  how a real incident (an ERP project) ended with colliding changes.

### Autonomy and Confirmations
- Once the user authorizes a task, perform ordinary, reversible, in-scope implementation and verification without repeatedly asking permission.
- Ask only when a choice materially changes scope, an action is destructive or difficult to recover, credentials or external publication are involved, or a workflow defines its own explicit safety gate such as `$council`, `$pr`, `$uninstall`, or destructive tiers of `$undo`.
- A sandbox or host approval is an environment requirement; do not duplicate that question in chat.

### Plugin Auto-Suggestion
- At the start of substantial project work, check `~/.codex/base_project/plugins.json` once against the project. If a catalog condition clearly matches and the capability is not installed, mention it once without interrupting the task.
- Never install or register a plugin on your own initiative. The user must explicitly invoke `$plugins` or separately request installation.
- Do not repeat a suggestion in the same session after it was mentioned or declined.

### WhatsApp-Style Menu
- Show the menu only at the start of a session when the first request is not already specific, and after completing a substantial task.
- Read `~/.codex/base_project/references/command-menu.md` and render it verbatim. Never reconstruct it from memory.
- Skip the menu whenever the user has already made a direct request.

### Contribution Diary
- After substantial work, mention once that `$diario` can record it. Never write a diary unless asked.
- Diaries remain outside every repository, using the root in `~/.base_project/diary-root.txt`. Never suggest committing them.
- Codex and Claude share the existing ledger under `~/.claude/base_project/usage/` so historical diaries remain continuous.

### Self-Correction
- After code changes, detect and run the project's own test, typecheck, lint, or build commands from its manifest. Fix failures before delivery.

### Task Sizing and Responses
- Answer trivial questions directly. Use the full Plan → Implement → Review workflow for substantial work.
- Be concise by default without weakening exact paths, numbers, code, or safety negations.
- When a deliverable is written to a file, point to the file and summarize it briefly instead of duplicating its full contents in chat.
- Between tool calls, skip prose narration of what you're doing — it costs output tokens on every step. If the task has a known step count, emit at most one short line per batch (e.g. `3/12 steps done`); otherwise emit nothing until the final response, which carries the explanation.

### Scope-Drift Awareness
- When a new message reads as a clearly different topic from the recent thread (not a follow-up or natural next step), say so in one line and suggest `/compact`, `/clear`, or a new session — a new session for a substantial new topic should start with `/bootstrap`. Judgment call, not a classifier; when ambiguous, treat it as a continuation.
