## base_project — Global Operating Rules

These rules apply in every project unless a project-local `AGENTS.md` overrides them.

### Token Economy
- Never fully read `external/`, `node_modules/`, `.venv/`, or other vendored/dependency directories.
- Before scanning an unfamiliar codebase, check for `graphify-out/`; if missing, run `/bootstrap` first.
- When editing, show only the changed lines with minimal surrounding context — never rewrite whole files unless asked.

### Security
- Never commit or hardcode real API keys, tokens, or credentials in a project repo.
- Read runtime secrets from the project's own `.env` (gitignored). MCP server credentials live in the global
  `~/.config/opencode/mcp.json` — never inside a project repo.

### Workflow
1. **Plan** — use `@architect` (read-only) before non-trivial changes.
2. **Implement** — use `@coder` for surgical, scoped edits.
3. **Review** — use `@reviewer` to run lint/typecheck/tests and prepare commits. It does not commit unless
   explicitly asked to.

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
