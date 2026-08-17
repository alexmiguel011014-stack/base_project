# Security Policy

## Scope

base_project is an installer: `dev/scripts/install.ps1`/`install.sh` write to your global
config (`~/.claude/`, `~/.config/opencode/`), register hook scripts that run on every
`PostToolUse`/`SessionStart` event, and register MCP servers. That write access to your
machine's global config is the real attack surface — a vulnerability here isn't "a bug in
a web app," it's something that could affect every project you open afterward. Report:

- Anything in `dev/scripts/install.ps1`/`install.sh` that could write outside the intended
  `~/.claude/`/`~/.config/opencode/` directories, or overwrite a file it doesn't own.
- Anything in `source/hooks/*.js` (`loop-detect.js`, `post-edit-format.js`,
  `session-start-git-context.js`, `usage-log.js`) that could execute untrusted input, leak
  data beyond its stated purpose, or run with more effect than documented.
- Anything in `dev/scripts/scan-skill.js` that could be bypassed by an actually-malicious
  skill it's meant to catch.
- Supply-chain issues in this repo's own dependencies (`ajv`, `ajv-formats`, `@biomejs/biome`,
  `typescript`).

**Out of scope**: vulnerabilities in third-party tools base_project merely *recommends*
(entries in `source/plugins.json`) — report those to the tool's own repository instead.

## Reporting a Vulnerability

**Please do not open a public GitHub issue for a security vulnerability.** Public disclosure
before a fix exists is exactly the risk this policy is meant to avoid.

Use [GitHub's private vulnerability reporting](https://github.com/alexmiguel011014-stack/base_project/security/advisories/new)
for this repository. It creates a private advisory only the maintainer can see until a fix is
ready.

## What to Expect

- **Acknowledgment within 72 hours** of a report being filed.
- An honest assessment of severity and scope, communicated directly — not a form response.
- Coordinated disclosure: the report stays private until a fix is released, then credit is
  given to the reporter (unless anonymity is requested).

This is a project with a single maintainer, not a security team — response time is a
commitment made in good faith, not a contractual SLA.
