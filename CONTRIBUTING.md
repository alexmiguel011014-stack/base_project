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

Both installer scripts accept overrides so you never have to risk your own
`~/.claude`/`~/.config/opencode`:

```bash
# PowerShell
powershell -File dev/scripts/install.ps1 -ClaudeHome C:\temp\fake-claude -OpencodeHome C:\temp\fake-opencode

# bash
CLAUDE_HOME=/tmp/fake-claude OPENCODE_HOME=/tmp/fake-opencode bash dev/scripts/install.sh
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

For non-trivial changes to `source/claude/commands/*.md` / `source/opencode/command/*.md`,
this project holds itself to the same workflow it ships to users: plan with `architect`
(read-only), implement with `coder` (scoped edits), verify with `reviewer` (runs the checks
above, drafts a Conventional Commit message). You don't have to use these subagents yourself,
but a PR description that shows the same discipline — what changed, why, how it was verified —
gets reviewed faster.

## Commit style

[Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`,
`refactor:`, `chore:`) — matches what `reviewer` already drafts for changes made through
Claude Code/opencode.

## Reporting bugs vs. security issues

Regular bugs: [GitHub Issues](https://github.com/alexmiguel011014-stack/base_project/issues).
Security vulnerabilities: see [SECURITY.md](SECURITY.md) — please don't file those as public
issues.
