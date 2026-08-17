# base_project:managed

Shared reference checklist for `/newproject`, `/scanproject` and `/fixproject` — what
"a well-formed project" means to base_project. Edit only here; the 3 commands point at
this file instead of each repeating the list its own way, so they can't drift apart.

Each item has: **what to check** and **why it matters**. Not every item applies to every
project (a single standalone script needs no CI) — context judgement is still required,
this is not a rigid ruler.

## 1. Project identity
- A `README.md` (or equivalent) exists, explaining what the project is and how to run it.
- An assistant instruction file (`CLAUDE.md`/`AGENTS.md`) exists if the project has
  conventions that aren't obvious from reading the code alone.

## 2. Version control
- It's a git repository (`git status` works).
- `.gitignore` covers generated artifacts, dependencies (`node_modules/`, `.venv/`,
  `dist/`, `graphify-out/`) and secrets (`.env`).
- No real secret (API key, token, password) committed in the history.

## 3. Secrets and configuration
- Runtime secrets come from `.env` (gitignored), not hardcoded in the source.
- A `.env.example` exists (with no real values) if the project needs config to run.

## 4. Dependencies
- A real manifest exists (`package.json`, `pyproject.toml`, `Cargo.toml`, etc.) with a
  lockfile — not ad-hoc installs with no record.
- No obviously unused dependency (a dead import of significant weight).

## 5. Tests
- At least one test command exists that runs as a single command and exits 0/non-zero
  reliably.
- Coverage doesn't need to be high — what matters is that the critical path (the
  project's core logic, not trivial plumbing) has some automated proof.

## 6. Code quality
- Lint/format configured and running clean (or the existing errors are known and
  intentional, not silence caused by missing configuration).
- Typecheck (where the language supports it) running without errors.

## 7. CI
- A pipeline exists (`.github/workflows/`, `.gitlab-ci.yml`, etc.) running at least lint
  + tests on every push/PR — not depending solely on running on the developer's machine.

## 8. Basic security
- No known critical vulnerability in the dependencies (`npm audit`, `pip-audit`, or the
  equivalent) left untreated.
- No obviously dangerous code pattern (`eval` of untrusted input, shell command
  interpolated without sanitisation, plaintext credentials).

## 9. Structure
- Folder organisation is consistent with the language/framework convention (not an
  arbitrary mix that makes navigation harder).
- No giant file doing everything once the project has grown enough to justify splitting
  it (a judgement of scale, not a fixed size rule).

---

When running `/scanproject`, each item becomes a finding with a **severity** (critical /
medium / low) and **file/line** where applicable — the same format `reviewer.md` already
uses for code review, not a new one.

Report findings to the user in the language they are writing in, even though this
checklist is in English: the checklist is an instruction to be executed, not text to be
echoed verbatim.
