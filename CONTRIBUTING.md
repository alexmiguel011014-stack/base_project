# Contributing to base_project

Thanks for considering a contribution. base_project has one maintainer and a small,
deliberately narrow scope — read this before opening a PR, it'll save you a round-trip.

## Before you start

For anything beyond a trivial fix (typo, one-line bug), open an issue first describing what
you want to change and why. This project has a documented history of *not* adding things
(`dev/ROADMAP.md`'s "Descartado" section lists real features considered and rejected, with
reasons) — an issue first avoids a PR built on a direction that's already been decided
against.

## Development setup

No install step beyond `npm ci` — this repo's own `package.json` only has dev/validation
tooling (`ajv`, Biome, TypeScript), it isn't published anywhere.

```bash
git clone https://github.com/alexmiguel011014-stack/base_project.git
cd base_project
npm ci
```

## Testing your changes without touching your real config

Both installer scripts accept overrides, and the Codex synchronizer has isolated roots,
so you never have to risk your own `~/.claude`/`~/.codex`/`~/.agents`/`~/.config/opencode`:

```bash
# PowerShell
powershell -File dev/scripts/install.ps1 -ClaudeHome C:\temp\fake-claude -OpencodeHome C:\temp\fake-opencode

# bash
CLAUDE_HOME=/tmp/fake-claude OPENCODE_HOME=/tmp/fake-opencode bash dev/scripts/install.sh

# Native Codex layer only (cross-platform)
mkdir -p /tmp/fake-codex
BASE_PROJECT_CODEX_ROOT=/tmp/fake-codex BASE_PROJECT_AGENTS_ROOT=/tmp/fake-agents node dev/scripts/install-codex.js
```

See [README.md § Testing the Installer](README.md#-testing-the-installer-without-touching-your-real-config)
for more.

## Adding a plugin catalog entry

If you want to add an entry to `source/plugins.json` (the catalog `/plugins` reads), see
[README.md § Adding Your Own Plugins](README.md#adding-your-own-plugins) — no code change
needed elsewhere, `dev/schemas/plugins.schema.json` validates the shape.

## Before opening a PR

Run the same checks CI runs:

```bash
npx biome check .
npx tsc
npm run validate:plugins
npm test
```

For non-trivial changes to `source/claude/commands/*.md`, `source/opencode/command/*.md`,
or `source/codex/skills/*/SKILL.md`,
this project holds itself to the same workflow it ships to users: plan with `architect`
(read-only), implement with `coder` (scoped edits), verify with `reviewer` (runs the checks
above, drafts a Conventional Commit message). You don't have to use these subagents yourself,
but a PR description that shows the same discipline — what changed, why, how it was verified —
gets reviewed faster.

## Rolling out a risky change to a command/agent

If a change to a shipped command/agent is risky enough that you don't want every existing
user to get it on their next `/update` (a rewrite of its instructions, a behavior change with
real failure modes if the new version is wrong), don't ship it as the only version. Follow the
pattern `source/opencode/command-lite/` already established: a parallel opt-in variant,
selected by an explicit installer flag (`--opencode-commands lite` /
`-OpencodeCommands lite`), with the choice persisted (`~/.base_project/opencode-command-profile.txt`)
so a later flag-less re-run keeps whatever was chosen. The existing behavior stays the
default — nobody is opted into the risky version without asking. Promote the new version to
default only after it's been validated, not on a hunch. This is a general pattern, not
something specific to the lite/dense opencode split — reuse it for the next risky command
change instead of inventing a new rollout mechanism each time.

## Commit style

[Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`,
`refactor:`, `chore:`) — matches what `reviewer` already drafts for changes made through
Claude Code/Codex/opencode.

## Reporting bugs vs. security issues

Regular bugs: [GitHub Issues](https://github.com/alexmiguel011014-stack/base_project/issues).
Security vulnerabilities: see [SECURITY.md](SECURITY.md) — please don't file those as public
issues.
