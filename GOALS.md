# GOALS.md — base_project

Two plans live in this file, kept separate rather than merged into one narrative, because
they're different kinds of work with different consumers:

1. [**Design-Review Skill**](#goals-1-design-review-skill-base_project-feature) — the
   original plan, status `done` (below, unchanged from when it was written).
2. [**Public Release Readiness**](#goals-2-public-release-readiness) — new, added
   2026-08-17, on explicit request: get base_project itself from "works great for me" to
   "safe for a stranger to install," researched the same way as plan 1 (real, current
   sources, not assumption).

`dev/ROADMAP.md` remains the living decision log for *everything that happened* in this
project — this file stays what it always was, the format `/execgoals` can execute against:
concrete, checkable items, not prose.

---

<a id="goals-1-design-review-skill-base_project-feature"></a>
## GOALS 1 — Design-Review Skill (base_project feature)

Research-backed build plan for a new base_project command that critiques design quality.
This is a *feature-level* plan, not a whole-project plan; this section is scoped to the
one deliverable described below, written in the format `/execgoals` executes against
without re-researching anything.

## Scope, as decided

Decided via explicit user choice (2026-08-16), not assumed:

- **What it checks**: both entry points — (1) critique an external design the user points to
  (image, mockup, live URL), and (2) act as an optional self-review step Claude can run on a UI
  it just generated, before presenting it. One engine, two invocations.
- **Where it lives**: inside base_project itself, distributed to everyone who installs it — not
  a personal-only skill. This means it needs the same review/registration discipline as every
  other base_project command (marker, both engines, menu/status/ROADMAP entries), not a
  one-off script.
- **Suggested command name**: `/designreview` (mirrors the existing `/code-review` naming
  convention already familiar from this harness). Open to a different name — not yet locked in
  anywhere.

## Methodology — grounded in current research, not invented from scratch

- [x] Baseline rubric skeleton: Nielsen Norman Group's usability heuristics — the durable,
      widely-taught standard, no need to re-derive one from zero.
- [x] Rating dimensions per UICrit (Berkeley, UIST 2024) and CHI 2026 follow-ups: aesthetics,
      efficiency, learnability, usability, and overall design quality, plus whether the design
      matches its stated intent (screenshot-to-description alignment).
- [x] Two-pass structure per Criticmate (CHI 2026): a global pass first (layout, hierarchy,
      first impression), then a local pass (spacing, contrast, copy, component-level detail).
      Stagewise global-then-local was found to align closer with expert feedback than a single
      undifferentiated pass — worth adopting rather than reinventing a review order.
- [x] Actionability requirement per UXBench (2026): a finding that doesn't name a concrete next
      step doesn't count as done. This already matches how this project's own review tooling
      works (`ReportFindings`'s `failure_scenario` field) — reuse that shape, don't invent a
      second one.
- [x] Deterministic pre-check layer before any LLM judgment call: WCAG contrast ratio and
      minimum tap-target size, objective and computable, no judgment needed — implemented as
      `dev/scripts/contrast-check.js`. **Deviation from the original plan**: spacing-scale
      adherence was dropped from this layer during implementation — there is no single
      universal "correct" spacing scale to check without knowing a project's own design
      tokens, so it moved into the local LLM pass instead (judged, not computed).

## Intake paths

- [x] **External image/mockup** — native multimodal vision via the `Read` tool. No new tooling.
- [x] **External live URL** — **deviation from the original plan**: written generically
      ("whatever browser/preview automation tooling is available in this session") instead of
      hardcoding `mcp__Claude_Browser__*`. That tool name is Claude Code-specific and the
      command also ships to opencode, where it wouldn't resolve — matches how `bootstrap.md`
      already handles opening a file in the default browser without naming a specific tool.
- [x] **Claude's own just-generated Artifact/UI** — same generic tooling instruction as above;
      critiques the *rendered* output, not just the source. Source-only review misses overflow,
      broken responsive behavior, and rendered-contrast issues that only show up once painted.

## Command design (packaging, once actually built)

- [x] New files: `source/claude/commands/designreview.md` + `source/opencode/command/`
      mirror — same pattern as every command shipped this session.
- [x] Output contract: reuse the `ReportFindings` shape (severity-ranked, one-sentence summary
      + concrete failure/improvement scenario per finding) instead of inventing a new report
      format.
- [x] Two invocation modes matching the two chosen entry points: `/designreview <url-or-file>`
      for external critique; a documented *optional* self-invoke instruction for Claude to run
      after producing a UI artifact — **not** a hard hook gate. Hooks in this repo
      (`post-edit-format.js`, `usage-log.js`) are deterministic scripts, not LLM calls; forcing
      an LLM critique pass onto every artifact via hook would add real latency/cost to every
      single generation and breaks that existing convention. Self-invocation stays a judgment
      call, same as when `/council` gets suggested elsewhere in this project.
- [x] Registration: `command-menu.md` (both engines + installed copies on this machine),
      `status.md` Commands list, `dev/ROADMAP.md` item 28.

## Testing

- [x] The deterministic pre-check layer (contrast ratio math, tap-target size) is real logic →
      got a real `dev/tests/contrast-check.test.js` file (12 tests), same convention as
      `usage-log.test.js`.
- [x] The LLM judgment layer itself is not unit-testable — same situation as `/council` and
      `/newgoal` today. Validated by `npm test` / `npx tsc` / `npx biome check .` /
      `npm run validate:plugins` staying green, not by asserting on subjective output.

## Explicitly out of scope for this pass

- [x] Hook-enforced automatic gating on every artifact — cost/latency; left as an optional
      self-invoked step instead (see Command design above).
- [x] Figma API integration — no confirmed need yet; image-export intake already covers the
      common case without needing OAuth/API-key setup.
- [x] A trained/fine-tuned scoring model — UICrit and UXBench are research datasets, not
      off-the-shelf APIs; out of reach for a markdown-instruction command, and unnecessary when
      an LLM judgment pass plus a solid rubric already covers the need.

## Sources consulted

- [UICrit: Enhancing Automated Design Evaluation with a UI Critique Dataset](https://dl.acm.org/doi/fullHtml/10.1145/3654777.3676381) — UIST 2024, rubric dimensions.
- [Criticmate: Stagewise Human–AI Co-Critique in Single-Screen UI Evaluation](https://dl.acm.org/doi/full/10.1145/3772318.3790929) — CHI 2026, global-then-local pass ordering.
- [UXBench: Measuring the Actionability of LLM-Generated UX Critiques](https://arxiv.org/pdf/2606.16262) — 2026, actionability as a required quality bar.

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

- [ ] Actually run `install.sh` on a real or CI macOS runner at least once. The script is
      shared between Linux and macOS, but as of this plan macOS has never been exercised in CI
      (matrix is `ubuntu-latest`/`windows-latest` only) — "should work" isn't verified, and this
      project's own standard (`project-standards.md` §5, and every ROADMAP entry) is "validated
      for real, not assumed."

### Area F — GitHub Repository Presentation

- [x] Set the repo description and topics on GitHub via `gh repo edit` (confirmed by the user
      before running, 2026-08-17) — description + topics `claude-code`, `opencode`, `cli`,
      `developer-tools`, `mcp`. Verified after with `gh repo view --json description,
      repositoryTopics`, not assumed from the command's exit code.
- [ ] Once Area G's verification pass is green, tag `v1.1.0` and push it (confirm with the user
      first — pushing a tag is visible/shared state, same discipline `/ship` already applies).
      `v1.0.0` was verified live on the remote on 2026-08-17 — corrects ROADMAP item 16's own
      note that it was "created locally, not pushed."

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
