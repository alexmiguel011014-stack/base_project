## base_project — Global Operating Rules

These rules apply in every project unless a project-local `AGENTS.md` overrides them.

### Token Economy
- Never fully read `external/`, `node_modules/`, `.venv/`, or other vendored/dependency directories.
- Before scanning an unfamiliar codebase, check for `graphify-out/`; if missing, run `/bootstrap` first.
- When editing, show only the changed lines with minimal surrounding context — never rewrite whole files unless asked.
- Optimize correctness per token: preserve the context and reasoning depth needed for a reliable result; reduce rework and redundant tool calls before reducing effort.

### Quality-per-token profiles
- Routine, short, well-scoped work may use low/medium effort.
- Complex changes, cross-file work, or ambiguous failures keep high effort; use `xhigh`/`max` only when the value of deeper reasoning is clear.
- Research and unrelated tasks should be isolated when practical; use `/clear` between unrelated tasks, `/compact` at natural breaks, and `/rewind` when abandoning a path.
- Never impose a universal low-effort, output, turn, or context cap before comparing correctness and rework against the baseline.

### Batching and stopping
- Batch independent reads and checks, reuse evidence already gathered, and validate once at each area boundary. Stop after the scoped work is verified complete or a real blocker requires user input; do not speculate, retry blindly, or continue into unrelated work. Never use batching or stopping to bypass plan, safety, or diary boundaries.

### Security
- Never commit or hardcode real API keys, tokens, or credentials in a project repo.
- Read runtime secrets from the project's own `.env` (gitignored). MCP server credentials live in the global
  `~/.config/opencode/mcp.json` — never inside a project repo.

### Workflow
1. **Plan** — use `@architect` (read-only) before non-trivial changes.
2. **Implement** — use `@coder` for surgical, scoped edits.
3. **Review** — use `@reviewer` to run lint/typecheck/tests and prepare commits. It does not commit unless
   explicitly asked to.
4. **Plan ≠ execute** — a command whose whole job is to produce a plan or analysis (e.g.
   `/newgoal`, `/repertoire`) never implements it in the same turn, no matter how complete the
   request already sounds or how firmly it was agreed earlier in the conversation. Producing
   the plan is the deliverable; running it is a separate step (`/execgoals`, or an explicit new
   ask) — never bundled into the planning command itself.
5. **Tiered autonomy** — classify every action before taking it: **auto-approved** for routine,
   reversible work inside the current repository; **notify-and-proceed** for an in-scope,
   reversible change whose visible effect should be stated before continuing; and
   **human-in-the-loop** for an irreversible or hard-to-recover action, a material scope choice,
   data/state outside base_project's own repository, sensitive data, credentials, or external
   publication. Decide from reversibility, scope of affected state, and data sensitivity — not
   from whether the action merely looks technically easy. The ERP database compatibility test is
   the model case for human-in-the-loop: even a copied test database was external sensitive data,
   so it required explicit approval first.

### Multi-agent branching & worktrees
- Non-trivial work happens on its own `<agent-id>/<slug>` branch, never directly on `main` (or
  the repository's actual default branch — resolve it the way `/ship` already does, never
  assume it). `<agent-id>` is a short lowercase identifier for whichever AI is doing the work
  (`claude`, `codex`, `opencode`, or another explicit identifier); `<slug>` is a short
  kebab-case description of the task.
- opencode has no native worktree tool, so create one manually before editing:
  `git worktree add ../<repo>-<agent-id>-<slug> -b <agent-id>/<slug>`, then work inside that
  directory — this keeps a concurrent AI (or a human) from editing the same working directory
  or branch at once.
- `main` only receives reviewed, merged work through `/pr`; no AI pushes work-in-progress
  directly to it. Once a branch merges, remove its worktree and branch (`git worktree remove`,
  delete the branch) instead of leaving it to accumulate.
- Why this exists: more than one AI editing the same project without this isolation is exactly
  how a real incident (an ERP project) ended with colliding changes.

### Autonomy & Confirmations
- Once the user has authorized a task, perform ordinary, reversible, in-scope implementation
  and verification steps without repeatedly asking permission.
- Ask only when a choice would materially change scope, an action is destructive or hard to
  recover, credentials/external publication are involved, or a command defines its own explicit
  safety gate (for example `/council`, `/pr`, `/uninstall`, and destructive tiers of `/undo`).
- A sandbox or host permission prompt is an environment requirement, not a reason to ask the
  same question again in chat.

### Plugin auto-suggestion (suggest only, never auto-install)
- When starting substantial work in a project (the same moment the `graphify-out/` bootstrap
  check above applies — not on every trivial turn), check the base_project plugin catalog
  (`~/.config/opencode/base_project/plugins.json`) once against what's actually in the
  project. If a catalog entry's `recommend_if` condition clearly matches and it isn't
  installed yet, mention it once, briefly, without interrupting the main task — e.g. "this
  project has a `supabase/` folder; the Supabase MCP is available via `/plugins` if you want
  it."
- Never run `/plugins`, install, or register anything on your own initiative — the mention is
  the entire auto-activation; the user still explicitly triggers the install. This keeps the
  suggestion low-friction while preserving the project's zero-surprise-side-effect rule.
- Don't repeat the same suggestion again within one session once it's been mentioned or declined.

### "What do you want to do now?" menu (WhatsApp-style)
- Show this menu in two moments only: (1) at the very start of a session, right after
  any git-context hook output, before doing anything else — unless the user's first
  message already states a clear, specific request (in that case just do the work, no
  menu); (2) right after closing out a substantial task (one that used multiple tool
  calls, subagents, or multiple file edits) — not after every reply, and never after a
  small Q&A exchange.
- Render it by reading `~/.config/opencode/base_project/references/command-menu.md`
  verbatim — do not redigit the list from memory, so it never drifts from the real
  command set.
- If the user's next message is already a direct request, skip the menu that turn — it
  exists to lower friction for someone unsure what to do next, not to gate every turn.

### Contribution diary (suggest only, never write unasked)
- After closing a substantial task (the same threshold the menu rule below uses: multiple
  file edits, subagents, or TodoWrite involved), mention once — briefly, without derailing —
  that `/diario` can record it in this project's contribution diary. Then drop it.
- Never write or update a diary without being asked. The recording that happens automatically
  is the `usage-log` hook's raw ledger, not narrative entries; nothing is lost by the user
  saying no, since `/diario` can synthesize any past date range later from that same ledger.
  Note that this ledger is written by a Claude Code hook — work done in opencode is not in it,
  so a diary built here relies on git history for anything opencode-only.
- Diaries live in one central directory outside every repository, resolved from
  `~/.base_project/diary-root.txt`. Never create one inside a project repo, and never suggest
  committing one anywhere — that content is deliberately kept out of version control.
- Don't repeat the suggestion again in the same session once mentioned or declined.

### Self-Correction
- After any code change, detect and run the project's own test/typecheck/lint commands from its manifest
  (`package.json`, `pyproject.toml`, `Cargo.toml`, etc.) — do not assume a specific stack or toolchain.
- Fix failures before delivering the final response.

### Task Sizing & Response Discipline
- Gauge task size before reaching for heavier tooling. A trivial ask ("how do you say X",
  a one-line lookup, a yes/no question) gets a direct answer — do not invoke subagents, write
  plans, or produce multi-section reports for it. A large ask (build a feature, migrate a
  system, fix a cross-file bug) justifies the full workflow above (Plan → Implement → Review).
  This is a judgment call made inline, not a separate step or tool — do not build a
  classifier for it.
- Keep responses terse by default: drop filler phrases, hedging, and restating the question
  back before answering. Preserve — never compress or approximate — code, numbers, file
  paths, and negations ("do not", "never") exactly as needed for correctness. When more detail
  is warranted (the user asked for depth, or the task is genuinely complex), give it — terseness
  is a default, not a hard ceiling.
- When a deliverable is written to a file (a report, GOALS.md, a command's own output, an
  artifact), don't also restate its full content in chat afterward — the file is the
  artifact, not the chat. Give a short pointer instead: path + one-line summary of what's
  in it. Repeating file content in chat is pure duplication — say what's in it, not what it
  says.
- Between tool calls, do not narrate what you're doing or why in prose — that narration is
  billed output tokens like any other text, and it repeats every single step of a multi-step
  task. When a task has a known step count (a numbered plan, a checklist, a todo list), emit
  at most one short mechanical progress line per batch of tool calls — e.g. `3/12 steps done`
  — instead of a sentence explaining the step. When there's no known total, skip the
  in-progress line entirely and let the tool calls speak for themselves. Reserve prose
  explanation (what was found, what changed, why) for the final response once the work is
  done — never spend it mid-task.

### Scope-drift awareness
- Watch each new user message against the recent thread, not just the immediate request.
  When it reads as a clearly different topic from what the conversation has been doing — not
  a follow-up, a correction, or a natural next step in the same task — say so in one line and
  suggest `/compact`, `/clear`, or a new session, before answering it. A genuinely new session
  should start with `/bootstrap` (see that command) if the new topic is its own project or a
  substantial new thread of work.
- This is a judgment call from the shape of the conversation, not a topic classifier — don't
  build one. When it's ambiguous whether the new message is a pivot or a continuation, treat
  it as a continuation and just answer; false positives here are more annoying than a missed
  one.
