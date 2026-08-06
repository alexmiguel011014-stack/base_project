# OPERATIONAL RULES & SYSTEM DIRECTIVES (DUAL-ENGINE SYSTEM)

## Token Economy
- **Reading:** NEVER read `external/` or `node_modules/` fully.
- **Context:** ALWAYS use `graphify-out/` or `repomix-output.xml` for codebase mapping before scanning files.
- **Edits:** Provide ONLY modified code blocks (Caveman mode). NEVER rewrite entire files.
- **Language:** Keep system directives in English for ~30% token savings.

## Security
- **Secrets:** NEVER commit or hardcode real API keys, tokens, or private credentials.
- **Environment:** Read runtime variables from `.env` and map placeholders in `.env.example`.

## Global Environment
- **Dependencies:** Relies on global CLI tools: `gh`, `graphify`, `repomix`, `biome`.
- **Initialization Check:** If `graphify-out/` or `repomix-output.xml` are missing, run `/bootstrap` or `.\bootstrap.ps1`.
- **Enforced Workflows:**
  - Code formatting MUST use global Biome (`biome check --write .`).
  - Codebase analysis MUST read `graphify-out/` before full-file scans.
  - Git management MUST use GitHub CLI (`gh pr create`).

## Workflow
1. **Plan:** Analyze with `graphify-out/`, formulate 3-to-5 step plan with `@architect` (Read-Only).
2. **Code:** Apply precise surgical edits with `@coder` (Write mode).
3. **Review:** Validate, run linter/tests, format, prepare commits with `@reviewer`.

## Self-Correction
- After any code modification, run project test/typecheck commands (`npx tsc`, `biome check`, etc.).
- Parse terminal outputs automatically and fix failures before delivering the final response.
