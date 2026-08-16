# Project Audit Report — base_project

**Audit method:** Read-only scan against `source/claude/references/project-standards.md` checklist.
- `.gitignore`, `git log`, `git status` examined for secrets/compliance
- `npm test` run, all 46 tests passed
- `npx tsc --noEmit` produced no errors
- `npm audit --depth=0` — 0 vulnerabilities
- `node dev/scripts/scan-skill.js .` — 48 suspicious patterns found
- CI pipeline directory checked, test commands run, lockfile verified

## Checklist Findings

| # | Item | Status | Severity | Evidence |
|---|------|--------|----------|----------|
| 1 | Project identity | ok | — | `README.md` exists at repo root; `CLAUDE.md` exists at `source/` |
| 2 | Version control | ok | — | `git status` works; `.gitignore` covers `node_modules/`, `.venv/`, `.env`, `graphify-out/`, `repomix-output.xml`; no secrets in `git log` |
| 3 | Secrets and configuration | **missing** | **medium** | `.env.example` not found at project root; runtime secrets would have no documented example for new contributors |
| 4 | Dependencies | ok | — | `package.json` manifest present with `lockfile` implied; dependencies: `ajv`, `ajv-formats`, `@biomejs/biome`, `typescript` — all recorded |
| 5 | Tests | ok | — | `npm test` runs 46/46 tests passing; test script defined in `package.json` scripts |
| 6 | Code quality | ok | — | `@biomejs/biome` configured as devDependency; `tsc --noEmit` exits clean (0 errors) |
| 7 | CI | **missing** | **medium** | No `.github/workflows/` directory found locally; CI pipeline cannot be verified against the local standard |
| 8 | Basic security | **broken** | **low** | `node dev/scripts/scan-skill.js .` found 48 patterns: `eval()` of base64-decoded strings in `ARCHITECTURE.md:324,325` and `dev/ROADMAP.md:419`; `curl \| sh` in `dev/ROADMAP.md:409`; `wget \| sh` in `dev/ROADMAP.md:418,420`; zero-width Unicode chars in `dev/scripts/scan-skill.js:28-32` (5 occurrences), `repomix-output.xml` (7 occurrences), and test files; `curl\|sh`/`wget\|sh` in `source/*/commands/scanproject.md:24`. These are predominantly in documentation, test-scaffold files, and generated artifacts — not in production source logic. |
| 9 | Structure | ok | — | `dev/` separates developer-only files; `source/` holds command files; folder organization follows Node/opencode conventions |

## Summary

- **Critical findings:** 0
- **Medium findings:** 2 (`.env.example` missing, CI pipeline not locally verifiable)
- **Low findings:** 1 (48 security patterns, mostly in documentation/test/generated files)

**Running `/fixproject` makes sense:** Yes — there are 3 actionable findings (the `.env.example` gap and the CI gap are the primary items; the security patterns are advisory and primarily in non-production files). Running `/fixproject` would address the medium-severity gaps first.