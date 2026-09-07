# Archived plan — GOALS 2: Public Release Readiness

> Status: completed. Archived from root `GOALS.md` on 2026-09-03.
> This body is a historical snapshot; keep it immutable and add future active work to root `GOALS.md`.

---

<a id="goals-2-public-release-readiness"></a>
## GOALS 2 — Public Release Readiness

Plan to take base_project from "works well for its own maintainer" to "safe and legible
for a stranger to install," triggered by an explicit ask: *"vamos criar um /newgoal para
entender e melhorar esse projeto ao ponto de eu publicar ele."* Researched the same way as
GOALS 1 — real sources, checked against this repo's actual current state (not the stale
`audit-report.md`/`fix-report.md`/`organization-audit.md` already at root, which were
generated on a different machine and are one of this plan's own findings — see Area B).

### Scope, as decided

This is **not** a build-from-zero plan — base_project already exists, works, and has 46
passing tests, clean typecheck, 0 `npm audit` vulnerabilities, and a CI pipeline. The areas
`/newgoal`'s template normally covers for an application — backend framework, frontend
framework, database, auth, deployment/infra — **do not apply** and are skipped outright:
base_project is a CLI installer with no service, no database, and no runtime to deploy. What
applies instead is the actual gap between "correct" and "safe for strangers to run," found by
directly verifying this repo's state (not assuming from the stale reports at its root):

| Area | Applies? | Why |
|---|---|---|
| Backend / Frontend / Database / Auth / Deployment | No | Not that kind of project — installer only, nothing served, nothing stored. |
| Connectivity | No | The only "connectivity" is git remotes and MCP registration, both already covered by `/ship`/`/bootstrap`/the installer itself. |
| Legal / Licensing | **Yes** | README claims MIT and links to a `LICENSE` file that does not exist — verified via direct file search, not assumed. |
| Testing | Partially | Unit-test coverage is already strong (46/46); the real gap is CI *artifact coverage*, not test logic — see Area C. |
| Security | **Yes** | No `SECURITY.md`; the project registers hooks and MCP servers on the installer's own machine, which is exactly the kind of surface a disclosure policy exists for. |
| Repository hygiene / structure | **Yes** | Session-report files from a different machine are committed at root — see Area B. |
| Community readiness | **Yes** | README already promises Issues/Discussions but nothing scaffolds them. |

### Area A — Legal & Licensing (blocking; do this first)

- [x] Create `LICENSE` at repo root — MIT, "Copyright (c) 2026 Allu" (confirmed by the user,
      2026-08-17).
- [x] Add `"license": "MIT"` to `package.json` (was absent entirely).
- [x] Confirmed the README's `[LICENSE](LICENSE)` link resolves — `LICENSE` now exists at repo
      root, same directory as `README.md`.

### Area B — Repository Hygiene

- [x] Decided (user, 2026-08-17): removed `audit-report.md`, `fix-report.md`,
      `organization-audit.md` from the tracked tree (`git rm`) — confirmed they were one-off
      output from a different machine's session, findings already folded into this plan and
      `dev/ROADMAP.md`.
- [x] `assets/` documented in `ARCHITECTURE.md`'s directory map — Windows Explorer folder icon,
      purely cosmetic, applied by `install.ps1`, not distributed to anyone.
- [x] Root re-checked directly (`ls` + `git status`) after the above — clean: only expected
      files remain, no other dead/misplaced content found.

### Area C — CI Coverage Completeness

- [x] Extended `install-test`'s artifact assertions in `.github/workflows/ci.yml` to cover all
      17 commands, on both Linux/macOS and Windows steps, both engines (Claude Code +
      opencode) — `bootstrap.md`, `audit.md`, `council.md`, `plugins.md`, `ship.md`,
      `newgoal.md`, `execgoals.md`, `designreview.md`, `reviewusage.md` were the 9 missing.
- [x] Added `contrast-check.js`/`usage-log.js` to the same assertion list.
- [x] Added `macos-latest` to the `install-test` matrix, and widened the Linux-only
      `if: runner.os == 'Linux'` steps to `if: runner.os != 'Windows'` so they actually run on
      macOS too (they wouldn't have otherwise — `runner.os` on a macOS runner is `macOS`, not
      `Linux`) — `jq` install branches on `$RUNNER_OS` (`apt-get` vs. `brew`).
- [x] **Validated for real, not just edited**: ran `dev/scripts/install.sh` against a scratch
      `CLAUDE_HOME`/`OPENCODE_HOME` in this session (not CI) and confirmed all 17 new assertion
      paths — the 11 new Claude Code ones and the 6 spot-checked opencode ones — actually exist
      after a real install, then re-ran the installer a second time to confirm idempotency
      (no error). Full CI run (which also covers the actual macOS runner) still pending on next
      push — see Area E.
- [x] **Real, pre-existing bug found and fixed, unrelated to this plan's own additions**: the
      first real CI run after pushing Areas A-D revealed `install-test (ubuntu-latest)` has been
      failing since at least the 2026-08-16 commit — `install.sh`'s settings.json section
      computes `BASE_SETTINGS` correctly for a missing/fresh file, but never writes it to disk
      before the next block's blind `cat "$SETTINGS_PATH"` — so a genuinely fresh install (no
      pre-existing `settings.json`, e.g. a brand-new user's first run, or CI's throwaway HOME)
      crashes with `cat: ... No such file or directory`. `install.ps1` doesn't have this bug —
      it builds one in-memory object and writes once at the end; `install.sh` round-trips
      through disk on every block instead. Fix: write `$BASE_SETTINGS` to disk immediately after
      computing it, before the first re-read. **Caught because `jq` isn't installed in this
      session's shell, which silently skipped the buggy code path on the first "validated
      locally" pass above** — re-verified after downloading a real `jq` binary specifically to
      exercise this path: fresh install now creates a valid `settings.json` with all 3 hook
      events, and a second run stays idempotent. This is exactly the kind of finding a
      first-time user would have hit; more consequential than any single item this plan
      originally listed.

### Area D — Community & Security Documentation

- [x] Added `SECURITY.md`: scope named concretely (install scripts + hooks that write to
      global config, `scan-skill.js` bypass, this repo's own dependencies), reporting via
      GitHub private vulnerability reporting (no public issue), 72h acknowledgment commitment.
- [x] Added `CONTRIBUTING.md`: links to README's existing scratch-`$HOME` testing instructions
      and the `plugins.json` catalog-entry guide instead of duplicating them, states the
      `architect`→`coder`→`reviewer` expectation for non-trivial PRs, Conventional Commits.
- [x] Added `CODE_OF_CONDUCT.md` (Contributor Covenant v2.1, standard text, enforcement contact
      routed through the same GitHub private-reporting channel as `SECURITY.md`).
- [x] Added `.github/ISSUE_TEMPLATE/bug_report.md` and `feature_request.md` — bug template
      explicitly redirects security-shaped reports to `SECURITY.md`; feature template points
      at `dev/ROADMAP.md`'s "Descartado" section so requests already decided against aren't
      re-litigated blind.
- [x] Removed the README's "Screenshots" section (three placeholder lines, no real images) —
      also added `SECURITY.md`/`CONTRIBUTING.md` links to the README's Support section while
      touching that area.

### Area E — Cross-Platform Verification

- [x] Ran for real on `macos-latest` via CI (run
      [32071701135](https://github.com/alexmiguel011014-stack/base_project/actions/runs/32071701135),
      2026-08-17) — `install-test (macos-latest)` passed in 30s, same run also confirmed
      `ubuntu-latest`/`windows-latest` green after the settings.json fix above. Also bumped
      `node-version: 20 → 22` in `ci.yml` (both jobs) — cleared a deprecation warning that was
      showing on every run (Node 20 setup being force-upgraded to 24 by the runner).

### Area F — GitHub Repository Presentation

- [x] Set the repo description and topics on GitHub via `gh repo edit` (confirmed by the user
      before running, 2026-08-17) — description + topics `claude-code`, `opencode`, `cli`,
      `developer-tools`, `mcp`. Verified after with `gh repo view --json description,
      repositoryTopics`, not assumed from the command's exit code.
- [x] Tagged `v1.1.0` and pushed (confirmed by the user first, 2026-08-17) — verified live on
      `origin` via `git ls-remote --tags`, not assumed from the push command's exit code.

### Area G — Final Verification Pass

- [x] Re-verified every finding from the deleted `audit-report.md` directly against current
      state (not from memory of the report): `.env.example` exists (was missing); CI exists and
      is now more thorough (the original "no CI found" finding was itself wrong — `ci.yml`
      exists and always did, likely a checkout artifact on the other machine); `npm audit
      --depth=0` → 0 vulnerabilities; `node dev/scripts/scan-skill.js .` → 13 findings, all
      either inside `repomix-output.xml` (gitignored, never committed — confirmed via
      `.gitignore:25`) or a documentation line in `scanproject.md:24` describing the scanner's
      own detection rule, not executable code. **0 real findings in shipped source.**
- [x] Re-ran the full local bar: `npm test` (46/46), `npx tsc --noEmit` (clean), `npx biome
      check .` (1 warning + 12 infos, all pre-existing in `source/hooks/*.js`/
      `dev/scripts/scan-skill.js`, unrelated to this plan's changes), `npm run validate:plugins`
      (catalog valid).

### Explicitly out of scope for this pass

- [x] A formal release/changelog automation pipeline (e.g. `semantic-release`) — this project's
      existing versioning decision (ROADMAP item 16) is deliberately manual (`git tag`, no
      publish flow), and nothing in this plan's trigger asked to revisit that.
- [x] A dedicated documentation site — `README.md`/`ARCHITECTURE.md` already serve that role at
      this project's current scale; revisit only if that stops being enough.
- [x] Rewriting or relicensing away from MIT — out of scope unless the user says otherwise;
      this plan only fills the gap between the license already advertised and one that exists.

### Sources consulted

- [OpenSSF Vulnerability Disclosures Working Group](https://github.com/ossf/wg-vulnerability-disclosures) — disclosure process standards.
- [google/oss-vulnerability-guide](https://github.com/google/oss-vulnerability-guide) — `SECURITY.md` template guidance, response-time norms.
- [GitHub: 6 security settings every maintainer should enable](https://github.blog/security/6-security-settings-every-github-maintainer-should-enable-this-week/) — repo-level security posture, current as of 2026.
- [opensource.guide — security best practices](https://github.com/github/opensource.guide/blob/main/_articles/pl/security-best-practices-for-your-project.md) — general OSS security documentation norms.
- MIT vs. Apache 2.0 comparison sources (license-choice research, 2026) — patent-grant tradeoff, confirming MIT fits a CLI tool's risk profile.
- Open-source pre-launch checklist sources (2026) — CONTRIBUTING/CODE_OF_CONDUCT/issue-template baseline.
