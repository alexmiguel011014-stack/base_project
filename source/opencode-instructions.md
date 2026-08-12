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
