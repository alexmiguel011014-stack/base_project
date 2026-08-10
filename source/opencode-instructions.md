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
