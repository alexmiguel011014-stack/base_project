# base_project:managed

Goal type: **Process** — an organizational/compliance change to a project that already works:
licensing, CI, community governance, distribution. Produces readiness, not new functionality.

## When this type applies

"Get this ready to publish/release/audit" — when the goals are things like `LICENSE`,
`SECURITY.md`, a CI platform matrix, issue templates, or repository configuration. If the ask
involves writing a new capability, that's `build.md` or `feature.md`, not this.

## Default owner

Mixed, and this needs to be explicit per item — that's the real difference from the other
types:

- `coder`: items that are a file/config (`LICENSE`, `SECURITY.md`, a CI workflow change).
- `(manual)`: items that only exist outside the repository — GitHub UI configuration,
  creating an annotated tag that represents a release decision, confirming a copyright
  holder's name. Tag these with `(manual)` at the end of the line so `/execgoals` knows it
  cannot just run it — it has to stop and ask for confirmation.

## Areas

Legal (`LICENSE`, copyright), Hygiene (stray files, duplication), CI (platform matrix,
install/artifact assertions), Community (`SECURITY.md`/`CONTRIBUTING.md`/
`CODE_OF_CONDUCT.md`/issue templates), Cross-platform (actually run, not "should work"),
Distribution (repo description/topics, version tag), Final verification (re-check old audit
findings against current state directly, don't trust the old report).

## Done-when convention

For `(manual)` items: an explicit user confirmation recorded on the item, never inferred. For
automatable items: often "exists and is correct" rather than a test command — e.g. `LICENSE`
is done when the file exists with the right name/year, not via a command.

## Ordering rule

Legal and Hygiene first (they block nothing, but taint an audit if left last). CI before
Cross-platform (can't verify cross-platform without the matrix existing first). Distribution
always last — a version tag only after everything else is verified.

## Worked example (drawn from this project's own history)

- [x] Create `LICENSE` (MIT, copyright holder confirmed with the user) (manual) — done when:
  the file exists at root with the correct name/year.
- [x] Set the GitHub repository description + topics (manual) — done when: `gh repo view`
  shows both set, checked directly, not assumed from the command's exit code.
- [x] Extend `install-test` assertions to cover all shipped commands — done when: CI fails if
  any command is missing from the freshly-installed test `$HOME`.
