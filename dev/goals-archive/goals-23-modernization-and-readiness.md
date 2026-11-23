# Archived plan — GOALS 23 — Modernization and Readiness: CI, Docs, Pins, opencode Paths, Plugin Study

> Status: completed; owner items M23.16 and M23.18 and M23.21 continue in root `GOALS.md` `## Owner backlog`. Archived from root `GOALS.md` on 2026-11-22.
> This body is a historical snapshot; keep it immutable and add future active work to root `GOALS.md`.

---

<a id="goals-23-modernization-and-readiness"></a>
## GOALS 23 — Modernization and Readiness: CI, Docs, Pins, opencode Paths, Plugin Study (base_project process)
Format: executor-v1

This plan brings base_project up to date with the November 2026 ecosystem and closes readiness gaps found on 2026-11-20 at commit `227c56f`. It fixes documentation drift, hardens CI and tests newer Node.js lines, pins floating versions, moves opencode files to the folders opencode now documents, and studies native plugin distribution without migrating to it. In every block below, remove the 4-space plan indent; all other leading spaces are part of the text.

### Decisions

- D1 This is a process plan. It adds no command and changes no command behavior except the opencode install folders. Why: the request asked what is outdated and what is missing, not for a new capability.
- D2 Run M23.3, M23.14 and M23.19 after O22.10, and run M23.5 after O22.7. Why: GOALS 22 edits `README.md` and `.github/workflows/ci.yml` first. On 2026-11-20 the four O22.7 anchors were re-grounded from 21 to 20, because GOALS 20 removed `/diario` after GOALS 22 was written. Every other open GOALS 22 anchor matched exactly once. GOALS 22 was archived on 2026-11-22, so the O22.7 and O22.10 dependencies were removed from the after: fields once they were done.
- D3 If `node_modules/` is missing, run `npm ci` once before the first item. Run every check in bash (Git Bash on Windows) unless the item says otherwise. Do not run `dev/scripts/install.sh` or `dev/scripts/install.ps1` locally: installer behavior is proven in CI only. Why: the installer registers MCP servers through the real `claude mcp add --scope user` and may install global CLI tools. Source: `README.md` section "Testing the Installer Without Touching Your Real Config".
- D4 The minimum supported Node.js is 22. Declare it in `package.json` `engines` and in the README. Keep Node 22 in the `validate` and `install-test` jobs and add a `node-compat` job for Node 24 and 26. Why: on 2026-11-20 Node 26 is Active LTS (since 2026-10-28), Node 24 and Node 22 are Maintenance LTS, and Node 22 ends on 2027-04-30; CI tested only Node 22. Raising the minimum is out of scope. Source: https://raw.githubusercontent.com/nodejs/Release/main/schedule.json (accessed 2026-11-20).
- D5 Give the CI token read-only `contents` permission at the top level, and pin each action to a full commit SHA with a version comment. Dependabot already updates the `github-actions` ecosystem weekly, so the pins stay current. Pins: `actions/checkout` v7.0.1 = `3d3c42e5aac5ba805825da76410c181273ba90b1`; `actions/setup-node` v7.1.0 = `949feb2413d6458794dcd2491c4babbbce0c15c1`. Source: https://docs.github.com/en/actions/reference/security/secure-use, `gh api repos/actions/checkout/git/ref/tags/v7.0.1` and `gh api repos/actions/setup-node/git/ref/tags/v7.1.0` (accessed 2026-11-20).
- D6 Install opencode files to `~/.config/opencode/agents/` and `~/.config/opencode/commands/`. Keep the source folders `source/opencode/agent/`, `command/` and `command-lite/` unchanged. The installers delete only files that carry the `base_project:managed` marker from the legacy `agent/` and `command/` folders, then remove a legacy folder only when it is empty. Why: the opencode docs name the plural folders and still discover the singular ones as legacy, so both sets would load the same command names. Source: https://opencode.ai/v2/docs/commands/ and https://opencode.ai/docs/commands (accessed 2026-11-20).
- D7 Pin the always-on Context7 MCP to 4.7.3 and append the 4.1.1 definition to `source/opencode/mcp-previous.json`. Why: `dev/scripts/mcp-servers.js` upgrades an installed entry only while it matches a definition listed there, so existing installs upgrade and edited entries stay the user's. Source: `source/opencode/mcp-previous.json` `_comment`; npm registry `@upstash/context7-mcp` 4.7.3, API key optional, https://www.npmjs.com/package/@upstash/context7-mcp (accessed 2026-11-20).
- D8 Every npm package in `source/plugins.json` names an exact version, and a test rejects `@latest`. Pin `@playwright/mcp@0.0.86`, `@supabase/mcp-server-supabase@0.19.0` and `ruflo@3.79.1`. Do not bump the other pinned catalog entries here: `@toolbox-sdk/server` 1.12.0 (1.17.0 published) and `mcp-server-git` 2026.8.18 (2026.11.18 published) stay for `/updates` and the owner, because R17.24 verified the Toolbox entries against a live database. Source: npm registry and PyPI, accessed 2026-11-20.
- D9 Point `biome.json` `$schema` at `./node_modules/@biomejs/biome/configuration_schema.json`. Why: the URL names 2.5.14 while the lockfile has 2.6.6, Dependabot PR #20 already proposes 2.6.8, and Biome skips the version-mismatch check for a local schema path. Source: https://biomejs.dev/reference/configuration/ and https://polar.sh/biomejs/biome/issues/4147 (accessed 2026-11-20).
- D10 Remove both README references to GitHub Discussions and do not enable Discussions. Why: `gh repo view` reports `hasDiscussionsEnabled: false` on 2026-11-20, so the links lead to a disabled page.
- D11 Repository settings are owner work: private vulnerability reporting, Dependabot alerts and security updates, CodeQL default setup, and the repository description and topics. Why: `SECURITY.md` tells reporters to use private vulnerability reporting, but `gh api repos/alexmiguel011014-stack/base_project/private-vulnerability-reporting` returned `{"enabled":false}` on 2026-11-20. Source: https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting/configuring-private-vulnerability-reporting-for-a-repository (accessed 2026-11-20).
- D12 This plan writes a plugin-distribution study and an owner decision, and migrates nothing. Why: Claude Code ships plugins and marketplaces, and Codex shipped plugins on 2026-03-26; packaging base_project that way touches every component and the zero-footprint promise, so it needs its own plan. Source: https://code.claude.com/docs/en/plugins-reference, https://developers.openai.com/codex/plugins (accessed 2026-11-20).
- D13 Items in executor-v1 sections skip the older Files/Verify contract after M23.1. Until M23.1 lands, each item here repeats its files on `Files:` lines and its proof on a `Verify:` line. Why: `/newgoal` step 5 asks for the `<!-- item-contract: v1 -->` marker, and the validator then reports `missing_files` and `missing_verify` for v1 items.
- D14 This plan cuts no release. The v1.2.0 tag and branch protection stay in R17.27, after M23.21. The study and the ROADMAP entry are Portuguese; README, SECURITY.md and GitHub templates are English. Source: this repository's `CLAUDE.md` section "Idioma".

| Stage | Items | Depends on | Can run in parallel with |
| --- | --- | --- | --- |
| 1 Hygiene | M23.1, M23.2, M23.3, M23.4, M23.7, M23.8 | none; M23.3 needs O22.10 | Stages 3, 4, 5 except items that touch `README.md` |
| 2 CI | M23.5, M23.6 | O22.7 | Stage 1, M23.9, M23.10, M23.12, M23.13, Stages 4 and 5 |
| 3 Cross-platform | M23.9, M23.10, M23.11, M23.12, M23.13, M23.14 | M23.11 needs M23.6, M23.9, M23.10; M23.14 needs M23.3 | Stages 4 and 5 |
| 4 Community | M23.15, M23.16 | none | Stages 1, 2, 3, 5 |
| 5 Distribution | M23.17, M23.18 | M23.18 needs M23.17 | Stages 1, 2, 3, 4 |
| 6 Final verification | M23.19, M23.20, M23.21 | every executor item above | none |
<!-- item-contract: v1 -->

### Hygiene

- [x] **M23.1 Skip the old Files/Verify contract inside executor-v1 sections**
  - proof: check exit 0, structure OK, new validator test passes, 2026-11-20, sonnet
  - tier: standard · medium
  - gate: auto
  - after: none
  - files: `dev/scripts/validate-goals-structure.js` (exists), `dev/tests/validate-goals-structure.test.js` (exists)
    - Files: `dev/scripts/validate-goals-structure.js` (exists). Anchor: Pairs 1 and 2 below. Change: collect the lines of every section that holds `Format: executor-v1`, and open no old-contract item on those lines. Do not touch: `checkExecutorV1` or any other rule.
    - Files: `dev/tests/validate-goals-structure.test.js` (exists). Anchor: the end of the file. Change: append Block 1. Do not touch: existing tests.
    - Verify: `node --test dev/tests/validate-goals-structure.test.js` → exit 0
    - Source: a sample executor-v1 section with the marker returned `missing_files` and `missing_verify` on 2026-11-20; `source/claude/commands/newgoal.md` step 5 asks for the marker.
  - do:
    1. Edit `dev/scripts/validate-goals-structure.js` with Pairs 1 and 2 below.
    2. Append Block 1 to the end of `dev/tests/validate-goals-structure.test.js`.
    3. Run `npx biome check --write dev/scripts/validate-goals-structure.js dev/tests/validate-goals-structure.test.js`.

    File `dev/scripts/validate-goals-structure.js`. Replace each `old` text with its `new` text. Each `old` text occurs exactly once.

    Pair 1, old:
    `````text
      let contractActive = false;
      let open = null;
    `````
    Pair 1, new:
    `````text
      let contractActive = false;
      let open = null;
      // Executor-v1 sections carry their own field rules (checkExecutorV1). The older
      // Files/Verify contract under the item-contract marker does not apply to them.
      const v1Lines = new Set();
      const sectionStarts = [];
      for (const [index, line] of lines.entries()) {
        if (SECTION_HEADING.test(line)) sectionStarts.push(index);
      }
      for (const [position, start] of sectionStarts.entries()) {
        const end = sectionStarts[position + 1] ?? lines.length;
        if (lines.slice(start, end).some((line) => line.trim() === V1_MARKER)) {
          for (let index = start; index < end; index += 1) v1Lines.add(index);
        }
      }
    `````

    Pair 2, old:
    `````text
          if (contractActive && line.includes("[ ]")) {
    `````
    Pair 2, new:
    `````text
          if (contractActive && !v1Lines.has(index) && line.includes("[ ]")) {
    `````

    Block 1:
    `````javascript

    test("validate-goals-structure applies only executor-v1 rules under the item-contract marker", () => {
      assert.deepEqual(
        codesFor(
          [
            "## GOALS 1 — T (x process)",
            "Format: executor-v1",
            "",
            "| Stage | Items | Depends on | Can run in parallel with |",
            "| --- | --- | --- | --- |",
            "| 1 | T1.1, T1.2 | none | none |",
            "<!-- item-contract: v1 -->",
            "",
            v1Item("T1.1", {}),
            v1Item("T1.2", { tier: "user", gate: "ask", after: "T1.1" }),
          ].join("\n"),
        ),
        [],
      );
    });
    `````
  - check: `node --test dev/tests/validate-goals-structure.test.js && node dev/scripts/validate-goals-structure.js GOALS.md` → exit 0 and the last line ends with `structure OK`
  - stop-if: an `old` text occurs zero times or more than once

- [x] **M23.2 Point the Biome schema at the installed package**
  - proof: check exit 0, biome check clean, 2026-11-20, haiku
  - tier: light · low
  - gate: auto
  - after: none
  - files: `biome.json` (exists)
    - Files: `biome.json` (exists). Anchor: Pair 1 below. Change: replace the versioned schema URL with the local package path. Do not touch: `files`, `formatter`, `linter`.
    - Verify: `npx biome check .` → exit 0
    - Source: D9.
  - do:
    1. Edit `biome.json` with Pair 1 below.

    File `biome.json`. Replace each `old` text with its `new` text. Each `old` text occurs exactly once.

    Pair 1, old:
    `````text
      "$schema": "https://biomejs.dev/schemas/2.5.14/schema.json",
    `````
    Pair 1, new:
    `````text
      "$schema": "./node_modules/@biomejs/biome/configuration_schema.json",
    `````
  - check: `node -e "const c=require('./biome.json');process.exit(c['\x24schema']==='./node_modules/@biomejs/biome/configuration_schema.json'&&require('fs').existsSync(c['\x24schema'])?0:1)" && npx biome check .` → exit 0
  - stop-if: an `old` text occurs zero times or more than once

- [x] **M23.3 Fix README drift: prerequisites, Discussions, database entries, /diario**
  - proof: check exit 0, O22.10 check still passes, 2026-11-20, haiku
  - tier: light · low
  - gate: auto
  - after: none
  - files: `README.md` (exists)
    - Files: `README.md` (exists). Anchor: Pairs 1 to 5 below. Change: add a Prerequisites section, correct the Postgres/SQLite paragraph, remove the Discussions references, and record the `/diario` removal. Do not touch: the command table, the "What Gets Installed" table, and lines that GOALS 22 changed.
    - Verify: the check below → exit 0
    - Source: D4, D10; `source/plugins.json` ids `toolbox-postgres` and `toolbox-sqlite`; `dev/scripts/install.sh` line 263 skips the hook merge without `jq`.
  - do:
    1. Edit `README.md` with Pairs 1 to 5 below.

    File `README.md`. Replace each `old` text with its `new` text. Each `old` text occurs exactly once.

    Pair 1, old:
    `````text
    ## 🚀 Quick Start

    ### Installation
    `````
    Pair 1, new:
    `````text
    ## 🚀 Quick Start

    ### Prerequisites

    - **git**, to clone this repository.
    - **Node.js 22 or newer.** The hooks run on Node, and the installer uses it to merge `opencode.jsonc` and to sync the Codex skills. Without Node, the installer skips those steps and warns.
    - **jq** (macOS/Linux only). `install.sh` uses it to merge the hooks into `~/.claude/settings.json`; without it, that step is skipped.
    - **Windows PowerShell 5.1 or PowerShell 7** (Windows only).
    - At least one of **Claude Code**, **Codex**, or **opencode**.

    Optional: `npm`, `pipx` (or `pip`), and `gh`. The installer uses them to install `repomix`, `biome`, `tsc`, `graphify`, and `gh` when they are missing; a failure there only prints a warning.

    ### Installation
    `````

    Pair 2, old:
    `````text
    The Postgres and SQLite MCP entries were removed in GOALS 17: the official reference servers they pointed to are archived with unpatched SQL-injection flaws (the Postgres one bypasses its read-only mode), and the SQLite npm package never existed. Choosing a maintained replacement is an open decision, not a silent swap.
    `````
    Pair 2, new:
    `````text
    The original Postgres and SQLite MCP entries were removed in GOALS 17: the official reference servers they pointed to are archived with unpatched SQL-injection flaws (the Postgres one bypasses its read-only mode), and the SQLite npm package never existed. Their replacement is Google's MCP Toolbox (`toolbox-postgres` and `toolbox-sqlite` in the catalog), pinned to an exact version, with least-privilege setup guidance.
    `````

    Pair 3, old:
    `````text
    - 💡 **Suggest features** or ask questions in Discussions
    `````
    Pair 3, new:
    `````text
    - 💡 **Suggest features** with the feature request template in [GitHub Issues](https://github.com/alexmiguel011014-stack/base_project/issues/new/choose)
    `````

    Pair 4, old:
    `````text
    - **Issues:** https://github.com/alexmiguel011014-stack/base_project/issues
    - **Discussions:** https://github.com/alexmiguel011014-stack/base_project/discussions
    `````
    Pair 4, new:
    `````text
    - **Issues:** https://github.com/alexmiguel011014-stack/base_project/issues
    `````

    Pair 5, old:
    `````text
    `/wpp` brings it back on demand

    ### v1.2.0 (unreleased — tag pending)
    `````
    Pair 5, new:
    `````text
    `/wpp` brings it back on demand
    - `/diario` (contribution diary) was removed; diary files already on disk stay where they are

    ### v1.2.0 (unreleased — tag pending)
    `````
  - check: `node -e "const t=require('fs').readFileSync('README.md','utf8');process.exit(t.includes('### Prerequisites')&&t.includes('Node.js 22 or newer')&&!t.includes('Discussions')&&!t.includes('Choosing a maintained replacement is an open decision')&&t.includes('was removed; diary files already on disk stay where they are')?0:1)"` → exit 0
  - stop-if: an `old` text occurs zero times or more than once

- [x] **M23.4 Bring the SECURITY.md scope up to date**
  - proof: check exit 0, 2026-11-20, haiku
  - tier: light · low
  - gate: auto
  - after: none
  - files: `SECURITY.md` (exists)
    - Files: `SECURITY.md` (exists). Anchor: Pairs 1 to 4 below. Change: list every directory the installer writes, every hook event, every hook file, and every own dependency. Do not touch: "Reporting a Vulnerability" and "What to Expect".
    - Verify: the check below → exit 0
    - Source: `source/hooks/` holds six hooks; `dev/scripts/install.sh` lines 234-235 register `usage-log.js` for `PostToolUse` and `UserPromptSubmit`; `package.json` devDependencies.
  - do:
    1. Edit `SECURITY.md` with Pairs 1 to 4 below.

    File `SECURITY.md`. Replace each `old` text with its `new` text. Each `old` text occurs exactly once.

    Pair 1, old:
    `````text
    config (`~/.claude/`, `~/.config/opencode/`), register hook scripts that run on every
    `PostToolUse`/`SessionStart` event, and register MCP servers.
    `````
    Pair 1, new:
    `````text
    config (`~/.claude/`, `~/.codex/`, `~/.agents/skills/`, `~/.config/opencode/`,
    `~/.base_project/`, and `~/.kimi/` when it exists), register hook scripts that run on
    `PostToolUse`, `UserPromptSubmit` and `SessionStart` events, and register MCP servers.
    `````

    Pair 2, old:
    `````text
    - Anything in `dev/scripts/install.ps1`/`install.sh` that could write outside the intended
      `~/.claude/`/`~/.config/opencode/` directories, or overwrite a file it doesn't own.
    `````
    Pair 2, new:
    `````text
    - Anything in `dev/scripts/install.ps1`/`install.sh` that could write outside the
      directories listed above, or overwrite a file it doesn't own.
    `````

    Pair 3, old:
    `````text
    - Anything in `source/hooks/*.js` (`loop-detect.js`, `post-edit-format.js`,
      `session-start-git-context.js`, `usage-log.js`) that could execute untrusted input, leak
    `````
    Pair 3, new:
    `````text
    - Anything in `source/hooks/*.js` (`loop-detect.js`, `post-edit-format.js`,
      `session-start-git-context.js`, `usage-log.js`, `validate-goals.js`, `project-rules.js`)
      that could execute untrusted input, leak
    `````

    Pair 4, old:
    `````text
    - Supply-chain issues in this repo's own dependencies (`ajv`, `ajv-formats`, `@biomejs/biome`,
      `typescript`).
    `````
    Pair 4, new:
    `````text
    - Supply-chain issues in this repo's own dependencies (`ajv`, `ajv-formats`, `@biomejs/biome`,
      `typescript`, `@types/node`) and in the pinned always-on MCP server (`@upstash/context7-mcp`).
    `````
  - check: `node -e "const t=require('fs').readFileSync('SECURITY.md','utf8');process.exit(['~/.codex/','UserPromptSubmit','validate-goals.js','project-rules.js','@types/node','@upstash/context7-mcp'].every((s)=>t.includes(s))&&!t.includes('the intended')?0:1)"` → exit 0
  - stop-if: an `old` text occurs zero times or more than once

- [x] **M23.7 Upgrade the always-on Context7 pin to 4.7.3**
  - proof: check exit 0, mcp-servers tests pass, Context7 4.7.3 initialize smoke ok, 2026-11-20, haiku
  - tier: light · medium
  - gate: notify
  - after: none
  - files: `source/opencode/mcp.json` (exists), `source/opencode/mcp-previous.json` (exists)
    - Files: `source/opencode/mcp.json` (exists). Anchor: Pair 1 below. Change: the version in `args`. Do not touch: `_managed_by`, `command`.
    - Files: `source/opencode/mcp-previous.json` (exists). Anchor: Pair 1 below. Change: append the 4.1.1 definition to `servers.context7`. Do not touch: other servers.
    - Verify: `node --test dev/tests/mcp-servers.test.js` → exit 0
    - Source: D7.
  - do:
    1. Edit the two files with the pairs below.
    2. State in one line that every existing install upgrades Context7 to 4.7.3 on its next installer run.
    3. Run the smoke command in Block 1 in bash. Stop if it exits non-zero, and report its output.

    File `source/opencode/mcp.json`. Replace each `old` text with its `new` text. Each `old` text occurs exactly once.

    Pair 1, old:
    `````text
          "args": ["-y", "@upstash/context7-mcp@4.1.1"]
    `````
    Pair 1, new:
    `````text
          "args": ["-y", "@upstash/context7-mcp@4.7.3"]
    `````

    File `source/opencode/mcp-previous.json`. Replace each `old` text with its `new` text. Each `old` text occurs exactly once.

    Pair 1, old:
    `````text
        "context7": [
          { "command": "npx", "args": ["-y", "@upstash/context7-mcp"] }
        ],
    `````
    Pair 1, new:
    `````text
        "context7": [
          { "command": "npx", "args": ["-y", "@upstash/context7-mcp"] },
          { "command": "npx", "args": ["-y", "@upstash/context7-mcp@4.1.1"] }
        ],
    `````

    Block 1:
    `````bash
    node -e "const {spawn}=require('node:child_process');const p=spawn('npx',['-y','@upstash/context7-mcp@4.7.3'],{shell:process.platform==='win32',stdio:['pipe','pipe','inherit']});let out='';const timer=setTimeout(()=>{p.kill();console.error('no initialize reply in 90 s');process.exit(1)},90000);p.stdout.on('data',(d)=>{out+=d;if(out.includes('serverInfo')){clearTimeout(timer);p.kill();console.log('initialize ok');process.exit(0)}});p.stdin.write(JSON.stringify({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'base-project-check',version:'0.0.0'}}})+'\n')"
    `````
  - check: `node --test dev/tests/mcp-servers.test.js && node -e "const f=require('fs');const c=JSON.parse(f.readFileSync('source/opencode/mcp.json','utf8'));const p=JSON.parse(f.readFileSync('source/opencode/mcp-previous.json','utf8'));process.exit(c.mcpServers.context7.args[1]==='@upstash/context7-mcp@4.7.3'&&p.servers.context7.some((d)=>d.args[1]==='@upstash/context7-mcp@4.1.1')?0:1)"` → exit 0
  - stop-if: an `old` text occurs zero times or more than once, or the Block 1 smoke exits non-zero

- [x] **M23.8 Pin the floating catalog versions and forbid `@latest`**
  - proof: check exit 0, no @latest left, 2026-11-20, haiku
  - tier: light · low
  - gate: auto
  - after: none
  - files: `source/plugins.json` (exists), `dev/tests/validate-plugins.test.js` (exists)
    - Files: `source/plugins.json` (exists). Anchor: the six `@latest` texts at lines 31, 32, 42, 43, 208 and 209. Change: exact versions from D8. Do not touch: any other field or entry.
    - Files: `dev/tests/validate-plugins.test.js` (exists). Anchor: the end of the file. Change: append Block 1. Do not touch: existing tests.
    - Verify: `node --test dev/tests/validate-plugins.test.js` → exit 0
    - Source: D8.
  - do:
    1. In `source/plugins.json`, replace both occurrences of `@playwright/mcp@latest` with `@playwright/mcp@0.0.86`.
    2. In `source/plugins.json`, replace both occurrences of `@supabase/mcp-server-supabase@latest` with `@supabase/mcp-server-supabase@0.19.0`.
    3. In `source/plugins.json`, replace both occurrences of `ruflo@latest` with `ruflo@3.79.1`.
    4. Stop if any of the three texts occurs a number of times other than 2 before the edit.
    5. Append Block 1 to the end of `dev/tests/validate-plugins.test.js`.
    6. Run `npx biome check --write dev/tests/validate-plugins.test.js`.

    Block 1:
    `````javascript

    test("catalog: no entry installs a floating @latest version", () => {
      const text = fs.readFileSync(
        path.join(__dirname, "..", "..", "source", "plugins.json"),
        "utf8",
      );
      assert.doesNotMatch(text, /@latest\b/);
    });
    `````
  - check: `node --test dev/tests/validate-plugins.test.js && npm run validate:plugins` → exit 0
  - stop-if: a replaced text occurs a number of times other than 2

### CI

- [x] **M23.5 Give CI a read-only token and pin actions to commit SHAs**
  - proof: check exit 0, both SHAs resolve on GitHub, 2026-11-20, haiku
  - tier: light · low
  - gate: auto
  - after: none
  - files: `.github/workflows/ci.yml` (exists)
    - Files: `.github/workflows/ci.yml` (exists). Anchor: Pair 1 below and the two `uses:` texts in steps 2 and 3. Change: add a top-level `permissions` block and pin the actions. Do not touch: job steps and assertions.
    - Verify: `gh api repos/actions/checkout/commits/3d3c42e5aac5ba805825da76410c181273ba90b1 --jq .sha` prints the same SHA
    - Source: D5.
  - do:
    1. Edit `.github/workflows/ci.yml` with Pair 1 below.
    2. Replace both occurrences of `uses: actions/checkout@v7` with `uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1`.
    3. Replace both occurrences of `uses: actions/setup-node@v7` with `uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0`.
    4. Stop if either `uses:` text occurs a number of times other than 2 before the edit.

    File `.github/workflows/ci.yml`. Replace each `old` text with its `new` text. Each `old` text occurs exactly once.

    Pair 1, old:
    `````text
      pull_request:
        branches: [main, master]

    jobs:
    `````
    Pair 1, new:
    `````text
      pull_request:
        branches: [main, master]

    permissions:
      contents: read

    jobs:
    `````
  - check: `node -e "const t=require('fs').readFileSync('.github/workflows/ci.yml','utf8');const n=(s)=>t.split(s).length-1;process.exit(t.includes('\npermissions:\n  contents: read\n\njobs:')&&n('actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1')===2&&n('actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0')===2&&!/actions\/(checkout|setup-node)@v\d/.test(t)?0:1)"` → exit 0
  - stop-if: an `old` text occurs zero times or more than once

- [x] **M23.6 Test Node.js 24 and 26 in CI and declare Node 22 as the minimum**
  - proof: check exit 0 (npm ci, npm test), node-compat job present, lockfile gained only engines, 2026-11-22, sonnet
  - tier: standard · medium
  - gate: auto
  - after: M23.5
  - files: `.github/workflows/ci.yml` (exists), `package.json` (exists), `package-lock.json` (exists)
    - Files: `.github/workflows/ci.yml` (exists). Anchor: Pair 1 below. Change: add the `node-compat` job before `install-test`. Do not touch: the `validate` and `install-test` jobs.
    - Files: `package.json` (exists). Anchor: the `license` key. Change: add `engines` after it with Block 1. Do not touch: scripts or dependencies.
    - Files: `package-lock.json` (exists). Change: regenerate with `npm install --package-lock-only --ignore-scripts`. Do not touch: dependency versions.
    - Verify: `npm ci && npm test` → exit 0
    - Source: D4.
  - do:
    1. Edit `.github/workflows/ci.yml` with Pair 1 below.
    2. Run Block 1 in bash to add `engines` to `package.json`.
    3. Run `npm install --package-lock-only --ignore-scripts`.
    4. Run `git diff --stat package-lock.json`. Stop if any dependency version changed, and report the diff.

    File `.github/workflows/ci.yml`. Replace each `old` text with its `new` text. Each `old` text occurs exactly once.

    Pair 1, old:
    `````text
      install-test:
        strategy:
    `````
    Pair 1, new:
    `````text
      node-compat:
        runs-on: ubuntu-latest
        strategy:
          fail-fast: false
          matrix:
            node: [24, 26]
        steps:
          - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1

          - name: Setup Node.js ${{ matrix.node }}
            uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0
            with:
              node-version: ${{ matrix.node }}
              cache: "npm"

          - name: Install dependencies
            run: npm ci

          - name: Run unit tests on Node ${{ matrix.node }}
            run: npm test

          - name: Run deterministic contract harness
            run: npm run test:harness

      install-test:
        strategy:
    `````

    Block 1:
    `````bash
    node -e "const f=require('fs');const p=JSON.parse(f.readFileSync('package.json','utf8'));const o={};for(const [k,v] of Object.entries(p)){o[k]=v;if(k==='license')o.engines={node:'>=22'}}f.writeFileSync('package.json',JSON.stringify(o,null,'\t')+'\n')"
    `````
  - check: `npm ci && npm test && node -e "const f=require('fs');const p=JSON.parse(f.readFileSync('package.json','utf8'));const t=f.readFileSync('.github/workflows/ci.yml','utf8');process.exit(p.engines&&p.engines.node==='>=22'&&t.includes('  node-compat:\n')&&t.includes('        node: [24, 26]\n')?0:1)"` → exit 0
  - stop-if: an `old` text occurs zero times or more than once, or a dependency version in `package-lock.json` changed

### Cross-platform

- [x] **M23.9 Install opencode files to the plural folders (install.sh)**
  - proof: check exit 0, bash -n clean, 2026-11-20, sonnet
  - tier: standard · high
  - gate: notify
  - after: none
  - files: `dev/scripts/install.sh` (exists)
    - Files: `dev/scripts/install.sh` (exists). Anchor: Pairs 1 and 2 below. Change: use `agents/` and `commands/`, and delete base_project's own files from the legacy folders. Do not touch: `sync_managed`, the source folder variables, or any other section.
    - Verify: `bash -n dev/scripts/install.sh` → exit 0
    - Source: D6; `set -euo pipefail` at line 11 is kept safe by the `|| continue` and `|| true` guards.
  - do:
    1. Edit `dev/scripts/install.sh` with Pairs 1 and 2 below.
    2. State in one line that the installer now deletes managed opencode files from `agent/` and `command/`.
    3. Do not run the installer. CI proves it in M23.11.

    File `dev/scripts/install.sh`. Replace each `old` text with its `new` text. Each `old` text occurs exactly once.

    Pair 1, old:
    `````text
    OPENCODE_AGENT_DIR="$OPENCODE_HOME/agent"
    OPENCODE_COMMAND_DIR="$OPENCODE_HOME/command"
    `````
    Pair 1, new:
    `````text
    OPENCODE_AGENT_DIR="$OPENCODE_HOME/agents"
    OPENCODE_COMMAND_DIR="$OPENCODE_HOME/commands"
    `````

    Pair 2, old:
    `````text
    for stale_dir in "$CLAUDE_HOME/base_project/dashboard" "$OPENCODE_HOME/base_project/dashboard"; do
    `````
    Pair 2, new:
    `````text
    # opencode reads agents/ and commands/ (plural); agent/ and command/ are legacy names it still
    # discovers. Remove base_project's own files from the legacy folders so no command loads twice.
    # A file without the managed marker is the user's own and stays where it is.
    for legacy_dir in "$OPENCODE_HOME/agent" "$OPENCODE_HOME/command"; do
        [ -d "$legacy_dir" ] || continue
        for legacy_file in "$legacy_dir"/*.md; do
            [ -f "$legacy_file" ] || continue
            if grep -q 'base_project:managed' "$legacy_file"; then
                rm -f "$legacy_file"
                ok "removed legacy opencode file: $legacy_file"
            fi
        done
        rmdir "$legacy_dir" 2>/dev/null || true
    done
    for stale_dir in "$CLAUDE_HOME/base_project/dashboard" "$OPENCODE_HOME/base_project/dashboard"; do
    `````
  - check: `bash -n dev/scripts/install.sh && test "$(grep -c -F 'OPENCODE_COMMAND_DIR="$OPENCODE_HOME/commands"' dev/scripts/install.sh)" = 1 && test "$(grep -c -F 'removed legacy opencode file' dev/scripts/install.sh)" = 1` → exit 0
  - stop-if: an `old` text occurs zero times or more than once

- [x] **M23.10 Install opencode files to the plural folders (install.ps1)**
  - proof: check exit 0, PowerShell parse clean, CRLF kept, 2026-11-20, sonnet
  - tier: standard · high
  - gate: notify
  - after: none
  - files: `dev/scripts/install.ps1` (exists)
    - Files: `dev/scripts/install.ps1` (exists). Anchor: Pairs 1 and 2 below. The file uses CRLF line endings; keep them. Change: use `agents` and `commands`, and delete base_project's own files from the legacy folders. Do not touch: `Sync-Managed`, `$opencodeCommandSrcDir`, or any other section.
    - Verify: the PowerShell parse in the check below → exit 0
    - Source: D6.
  - do:
    1. Edit `dev/scripts/install.ps1` with Pairs 1 and 2 below.
    2. Do not run the installer. CI proves it in M23.11.

    File `dev/scripts/install.ps1`. Replace each `old` text with its `new` text. Each `old` text occurs exactly once.

    Pair 1, old:
    `````text
    $opencodeAgentDir     = Join-Path $OpencodeHome "agent"
    $opencodeCommandDir   = Join-Path $OpencodeHome "command"
    `````
    Pair 1, new:
    `````text
    $opencodeAgentDir     = Join-Path $OpencodeHome "agents"
    $opencodeCommandDir   = Join-Path $OpencodeHome "commands"
    `````

    Pair 2, old:
    `````text
    foreach ($staleDir in @((Join-Path $ClaudeHome "base_project\dashboard"), (Join-Path $OpencodeHome "base_project\dashboard"))) {
    `````
    Pair 2, new:
    `````text
    # opencode reads agents\ and commands\ (plural); agent\ and command\ are legacy names it still
    # discovers. Remove base_project's own files from the legacy folders so no command loads twice.
    # A file without the managed marker is the user's own and stays where it is.
    foreach ($legacyDir in @((Join-Path $OpencodeHome "agent"), (Join-Path $OpencodeHome "command"))) {
        if (-not (Test-Path $legacyDir)) { continue }
        Get-ChildItem $legacyDir -Filter *.md -File | ForEach-Object {
            if ((Read-Utf8NoBom $_.FullName) -match 'base_project:managed') {
                Remove-Item $_.FullName -Force
                Write-Ok "removed legacy opencode file: $($_.FullName)"
            }
        }
        if (-not (Get-ChildItem $legacyDir -Force)) { Remove-Item $legacyDir -Force }
    }
    foreach ($staleDir in @((Join-Path $ClaudeHome "base_project\dashboard"), (Join-Path $OpencodeHome "base_project\dashboard"))) {
    `````
  - check: `powershell -NoProfile -Command '$e=$null; [void][System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path "dev/scripts/install.ps1").Path,[ref]$null,[ref]$e); if ($e.Count -gt 0) { exit 1 }' && test "$(grep -c -F 'Join-Path $OpencodeHome "commands"' dev/scripts/install.ps1)" = 1 && test "$(grep -c -F 'removed legacy opencode file' dev/scripts/install.ps1)" = 1` → exit 0
  - stop-if: an `old` text occurs zero times or more than once

- [x] **M23.11 Prove the opencode folder move in CI on all three systems**
  - proof: check exit 0, 24/24 path asserts moved to plural folders, legacy seed and cleanup asserts on bash and PowerShell, 2026-11-22, sonnet
  - tier: standard · medium
  - gate: auto
  - after: M23.6, M23.9, M23.10
  - files: `.github/workflows/ci.yml` (exists)
    - Files: `.github/workflows/ci.yml` (exists). Anchor: the path texts in steps 1 and 2, and Pairs 1 and 2 below. Change: assert the plural folders, seed legacy files before the first install, and assert the cleanup. Do not touch: the Claude, Codex and Kimi assertions.
    - Verify: the count check below → exit 0
    - Source: D6.
  - do:
    1. Replace all 24 occurrences of `$OPENCODE_HOME/command/` with `$OPENCODE_HOME/commands/`.
    2. Replace all 24 occurrences of `Join-Path $opencodeHome "command\` with `Join-Path $opencodeHome "commands\`.
    3. Stop if either count before the edit is not 24.
    4. Edit `.github/workflows/ci.yml` with Pairs 1 and 2 below, after steps 1 and 2.

    File `.github/workflows/ci.yml`. Replace each `old` text with its `new` text. Each `old` text occurs exactly once.

    Pair 1, old:
    `````text
              mkdir -p "$BASE_PROJECT_CODEX_ROOT"
              bash dev/scripts/install.sh
              test -f "$CLAUDE_HOME/CLAUDE.md"
    `````
    Pair 1, new:
    `````text
              mkdir -p "$BASE_PROJECT_CODEX_ROOT"
              mkdir -p "$OPENCODE_HOME/command" "$OPENCODE_HOME/agent"
              printf 'base_project:managed\n' > "$OPENCODE_HOME/command/ship.md"
              printf 'my own command\n' > "$OPENCODE_HOME/command/mine.md"
              printf 'base_project:managed\n' > "$OPENCODE_HOME/agent/coder.md"
              bash dev/scripts/install.sh
              test ! -e "$OPENCODE_HOME/command/ship.md"
              test -f "$OPENCODE_HOME/command/mine.md"
              test ! -e "$OPENCODE_HOME/agent"
              test -f "$OPENCODE_HOME/agents/coder.md"
              test -f "$CLAUDE_HOME/CLAUDE.md"
    `````

    Pair 2, old:
    `````text
              New-Item -ItemType Directory -Force -Path $env:BASE_PROJECT_CODEX_ROOT | Out-Null
              & "dev\scripts\install.ps1" -ClaudeHome $claudeHome -OpencodeHome $opencodeHome
              $expected = @(
    `````
    Pair 2, new:
    `````text
              New-Item -ItemType Directory -Force -Path $env:BASE_PROJECT_CODEX_ROOT | Out-Null
              New-Item -ItemType Directory -Force -Path (Join-Path $opencodeHome "command"), (Join-Path $opencodeHome "agent") | Out-Null
              Set-Content -Path (Join-Path $opencodeHome "command\ship.md") -Value "base_project:managed"
              Set-Content -Path (Join-Path $opencodeHome "command\mine.md") -Value "my own command"
              Set-Content -Path (Join-Path $opencodeHome "agent\coder.md") -Value "base_project:managed"
              & "dev\scripts\install.ps1" -ClaudeHome $claudeHome -OpencodeHome $opencodeHome
              if (Test-Path (Join-Path $opencodeHome "command\ship.md")) { throw "Legacy managed opencode command was not removed" }
              if (-not (Test-Path (Join-Path $opencodeHome "command\mine.md"))) { throw "The user's own legacy opencode command was removed" }
              if (Test-Path (Join-Path $opencodeHome "agent")) { throw "Empty legacy opencode agent folder was not removed" }
              if (-not (Test-Path (Join-Path $opencodeHome "agents\coder.md"))) { throw "opencode agents were not installed to agents" }
              $expected = @(
    `````
  - check: `node -e "const t=require('fs').readFileSync('.github/workflows/ci.yml','utf8');const n=(s)=>t.split(s).length-1;process.exit(n('\x24OPENCODE_HOME/commands/')===24&&n('\x24OPENCODE_HOME/command/')===4&&n('Join-Path \x24opencodeHome \x22commands\x5c')===24&&n('Join-Path \x24opencodeHome \x22command\x5c')===4&&t.includes('test ! -e \x22\x24OPENCODE_HOME/agent\x22')?0:1)"` → exit 0
  - stop-if: a step 1 or step 2 count is not 24, or an `old` text occurs zero times or more than once

- [x] **M23.12 Name the plural opencode folders in /uninstall (Claude and opencode dense)**
  - proof: check exit 0, ai-style lint clean, 2026-11-20, haiku
  - tier: light · low
  - gate: auto
  - after: none
  - files: `source/claude/commands/uninstall.md` (exists), `source/opencode/command/uninstall.md` (exists)
    - Files: `source/claude/commands/uninstall.md` (exists). Anchor: Pair 1 below. Change: the file list names the plural folders and the legacy ones. Do not touch: tiers and the rest of the list.
    - Files: `source/opencode/command/uninstall.md` (exists). Anchor: the same Pair 1 text. Change: the same. Do not touch: the same.
    - Verify: `npm run lint:ai-style` → exit 0
    - Source: D6.
  - do:
    1. Apply Pair 1 below to `source/claude/commands/uninstall.md`.
    2. Apply the same Pair 1 to `source/opencode/command/uninstall.md`.

    File `source/claude/commands/uninstall.md`. Replace each `old` text with its `new` text. Each `old` text occurs exactly once.

    Pair 1, old:
    `````text
    - Files under `~/.claude/agents/`, `~/.claude/commands/`, `~/.config/opencode/agent/`,
      `~/.config/opencode/command/`, `~/.codex/agents/`, and `~/.agents/skills/*/SKILL.md` that
    `````
    Pair 1, new:
    `````text
    - Files under `~/.claude/agents/`, `~/.claude/commands/`, `~/.config/opencode/agents/`,
      `~/.config/opencode/commands/`, `~/.codex/agents/`, `~/.agents/skills/*/SKILL.md`, and the
      legacy `~/.config/opencode/agent/` and `~/.config/opencode/command/` folders that
    `````

    File `source/opencode/command/uninstall.md`. Replace each `old` text with its `new` text. Each `old` text occurs exactly once.

    Pair 1, old:
    `````text
    - Files under `~/.claude/agents/`, `~/.claude/commands/`, `~/.config/opencode/agent/`,
      `~/.config/opencode/command/`, `~/.codex/agents/`, and `~/.agents/skills/*/SKILL.md` that
    `````
    Pair 1, new:
    `````text
    - Files under `~/.claude/agents/`, `~/.claude/commands/`, `~/.config/opencode/agents/`,
      `~/.config/opencode/commands/`, `~/.codex/agents/`, `~/.agents/skills/*/SKILL.md`, and the
      legacy `~/.config/opencode/agent/` and `~/.config/opencode/command/` folders that
    `````
  - check: `npm run lint:ai-style && node -e "const f=require('fs');process.exit(['source/claude/commands/uninstall.md','source/opencode/command/uninstall.md'].every((p)=>{const t=f.readFileSync(p,'utf8');return t.includes('~/.config/opencode/commands/')&&t.includes('legacy \x60~/.config/opencode/agent/\x60')})?0:1)"` → exit 0
  - stop-if: an `old` text occurs zero times or more than once

- [x] **M23.13 Name the plural opencode folders in opencode lite /uninstall and both /status files**
  - proof: check exit 0, ai-style lint clean, 2026-11-20, haiku
  - tier: light · low
  - gate: auto
  - after: none
  - files: `source/opencode/command-lite/uninstall.md` (exists), `source/opencode/command/status.md` (exists), `source/opencode/command-lite/status.md` (exists)
    - Files: `source/opencode/command-lite/uninstall.md` (exists). Anchor: Pair 1 below. Change: plural folders plus the legacy ones. Do not touch: other tiers.
    - Files: `source/opencode/command/status.md` (exists). Anchor: Pairs 1 and 2 below. Change: plural folders. Do not touch: other steps.
    - Files: `source/opencode/command-lite/status.md` (exists). Anchor: Pairs 1 and 2 below. Change: plural folders. Do not touch: other steps.
    - Verify: `npm run lint:ai-style` → exit 0
    - Source: D6.
  - do:
    1. Edit the three files with the pairs below.

    File `source/opencode/command-lite/uninstall.md`. Replace each `old` text with its `new` text. Each `old` text occurs exactly once.

    Pair 1, old:
    `````text
    `~/.config/opencode/agent/`, `~/.config/opencode/command/`, `~/.codex/agents/`,
    `````
    Pair 1, new:
    `````text
    `~/.config/opencode/agents/`, `~/.config/opencode/commands/`, the legacy `~/.config/opencode/agent/` and `~/.config/opencode/command/`, `~/.codex/agents/`,
    `````

    File `source/opencode/command/status.md`. Replace each `old` text with its `new` text. Each `old` text occurs exactly once.

    Pair 1, old:
    `````text
       `~/.config/opencode/agent/` that contain the `base_project:managed` marker.
    `````
    Pair 1, new:
    `````text
       `~/.config/opencode/agents/` that contain the `base_project:managed` marker.
    `````

    Pair 2, old:
    `````text
       `~/.config/opencode/command/` that contain the `base_project:managed` marker.
    `````
    Pair 2, new:
    `````text
       `~/.config/opencode/commands/` that contain the `base_project:managed` marker.
    `````

    File `source/opencode/command-lite/status.md`. Replace each `old` text with its `new` text. Each `old` text occurs exactly once.

    Pair 1, old:
    `````text
    in `~/.config/opencode/agent/` that contain
    `````
    Pair 1, new:
    `````text
    in `~/.config/opencode/agents/` that contain
    `````

    Pair 2, old:
    `````text
    in `~/.config/opencode/command/` that contain
    `````
    Pair 2, new:
    `````text
    in `~/.config/opencode/commands/` that contain
    `````
  - check: `npm run lint:ai-style && node -e "const f=require('fs');const bad=['source/opencode/command-lite/uninstall.md','source/opencode/command/status.md','source/opencode/command-lite/status.md'].filter((p)=>f.readFileSync(p,'utf8').split('\n').some((l)=>/~\/\.config\/opencode\/(agent|command)\//.test(l)&&!l.includes('legacy')));process.exit(bad.length?1:0)"` → exit 0
  - stop-if: an `old` text occurs zero times or more than once

- [x] **M23.14 Name the plural opencode folders in README and ARCHITECTURE**
  - proof: check exit 0, M23.3 and O22.10 checks still pass, 2026-11-20, haiku
  - tier: light · low
  - gate: auto
  - after: M23.3
  - files: `README.md` (exists), `ARCHITECTURE.md` (exists)
    - Files: `README.md` (exists). Anchor: Pairs 1 to 3 below. Change: the "Installed To" column for opencode. Do not touch: the "Purpose" column, which GOALS 22 changed.
    - Files: `ARCHITECTURE.md` (exists). Anchor: Pairs 1 to 3 below. Change: the arrow targets in the tree; keep the column alignment. Do not touch: the source folder names.
    - Verify: the check below → exit 0
    - Source: D6.
  - do:
    1. Edit the two files with the pairs below.

    File `README.md`. Replace each `old` text with its `new` text. Each `old` text occurs exactly once.

    Pair 1, old:
    `````text
    | `source/opencode/agent/*.md` | `~/.config/opencode/agent/` |
    `````
    Pair 1, new:
    `````text
    | `source/opencode/agent/*.md` | `~/.config/opencode/agents/` |
    `````

    Pair 2, old:
    `````text
    | `source/opencode/command/*.md` | `~/.config/opencode/command/` |
    `````
    Pair 2, new:
    `````text
    | `source/opencode/command/*.md` | `~/.config/opencode/commands/` |
    `````

    Pair 3, old:
    `````text
    | `source/opencode/command-lite/*.md` | `~/.config/opencode/command/` |
    `````
    Pair 3, new:
    `````text
    | `source/opencode/command-lite/*.md` | `~/.config/opencode/commands/` |
    `````

    File `ARCHITECTURE.md`. Replace each `old` text with its `new` text. Each `old` text occurs exactly once.

    Pair 1, old:
    `````text
    → ~/.config/opencode/agent/     (mesmo trio
    `````
    Pair 1, new:
    `````text
    → ~/.config/opencode/agents/    (mesmo trio
    `````

    Pair 2, old:
    `````text
    → ~/.config/opencode/command/   (perfil "dense"
    `````
    Pair 2, new:
    `````text
    → ~/.config/opencode/commands/  (perfil "dense"
    `````

    Pair 3, old:
    `````text
    → ~/.config/opencode/command/   (perfil "lite"
    `````
    Pair 3, new:
    `````text
    → ~/.config/opencode/commands/  (perfil "lite"
    `````
  - check: `node -e "const f=require('fs');process.exit(['README.md','ARCHITECTURE.md'].every((p)=>!/~\/\.config\/opencode\/(agent|command)\//.test(f.readFileSync(p,'utf8')))?0:1)"` → exit 0
  - stop-if: an `old` text occurs zero times or more than once

### Community

- [x] **M23.15 Add an issue chooser config and a pull request template**
  - proof: check exit 0, 2026-11-20, haiku
  - tier: light · low
  - gate: auto
  - after: none
  - files: `.github/ISSUE_TEMPLATE/config.yml` (new), `.github/pull_request_template.md` (new)
    - Files: `.github/ISSUE_TEMPLATE/config.yml` (new). Change: write Block 1. Do not touch: `bug_report.md`, `feature_request.md`.
    - Files: `.github/pull_request_template.md` (new). Change: write Block 2.
    - Verify: the check below → exit 0
    - Source: `CONTRIBUTING.md` section "Before opening a PR" names `npm run verify` and `npm run test:harness`; `SECURITY.md` names the private advisory URL.
  - do:
    1. Write `.github/ISSUE_TEMPLATE/config.yml` with exactly Block 1.
    2. Write `.github/pull_request_template.md` with exactly Block 2.

    Block 1:
    `````yaml
    blank_issues_enabled: false
    contact_links:
      - name: Report a security vulnerability
        url: https://github.com/alexmiguel011014-stack/base_project/security/advisories/new
        about: Report security issues privately. Never report them in a public issue.
    `````

    Block 2:
    `````markdown
    ## What changed

    <!-- One or two sentences. Link the issue this closes, if any. -->

    ## Checks

    - [ ] `npm run verify` passes locally
    - [ ] `npm run test:harness` passes locally
    - [ ] A change under `source/` was tried with the installer against a throwaway home (see CONTRIBUTING.md)
    - [ ] A new or renamed command is also in the menus, README, and the CI assertions
    `````
  - check: `node -e "const f=require('fs');const a=f.readFileSync('.github/ISSUE_TEMPLATE/config.yml','utf8');const b=f.readFileSync('.github/pull_request_template.md','utf8');process.exit(a.startsWith('blank_issues_enabled: false\n')&&a.includes('/security/advisories/new')&&b.includes('npm run verify')&&b.includes('npm run test:harness')?0:1)"` → exit 0
  - stop-if: either file already exists

- M23.16 and M23.18 and M23.21 (owner items) moved unchanged to `## Owner backlog` in root `GOALS.md` on 2026-11-22.

### Distribution

- [x] **M23.17 Write the plugin-distribution study**
  - proof: check exit 0, 9 headings in order, Recomendação: A, 2026-11-20, opus
  - tier: strong · high
  - gate: auto
  - after: none
  - files: `dev/estudo-distribuicao-plugins-2026.md` (new)
    - Files: `dev/estudo-distribuicao-plugins-2026.md` (new). Change: write the study with the sections in step 4. Do not touch: any other file.
    - Verify: the check below → exit 0
    - Source: D12 and the URLs in step 1.
  - do:
    1. Read these pages: https://code.claude.com/docs/en/plugins-reference, https://code.claude.com/docs/en/plugin-marketplaces, https://code.claude.com/docs/en/skills, https://code.claude.com/docs/en/hooks, https://developers.openai.com/codex/plugins, https://developers.openai.com/codex/plugins/build/, https://developers.openai.com/codex/skills, https://opencode.ai/docs/plugins/, https://opencode.ai/docs/commands.
    2. Read `README.md` section "What Gets Installed", `dev/scripts/install.sh` sections 3 to 8d, and `dev/scripts/install-codex.js`.
    3. Answer each question in Block 1 with a cited fact. If a fact cannot be confirmed, write `(não confirmado)` after it.
    4. Write `dev/estudo-distribuicao-plugins-2026.md` in Portuguese with these headings in this order: `# Estudo: distribuir o base_project como plugin (2026-11)`, `## Pergunta`, `## O que cada engine oferece hoje`, `## Mapeamento dos componentes`, `## Comandos vs skills no Claude Code`, `## Riscos`, `## Opções`, `## Recomendação`, `## Fontes`.
    5. Under `## O que cada engine oferece hoje`, write a table with the columns `Engine | Mecanismo | Componentes suportados | Instalação e atualização | Fonte`.
    6. Under `## Mapeamento dos componentes`, write a table with the columns `Componente | Plugin Claude Code | Plugin Codex | opencode | Fica no instalador?`. Give one row each to: the 20 commands, the 3 agents, the 6 hooks, the Context7 MCP, the global rule block, `base_project/references/`, `base_project/scripts/`, `plugins.json`, `~/.base_project/` state, and the opencode `lite` profile.
    7. Under `## Opções`, describe option A (installer only), option B (hybrid: plugins for Claude Code and Codex, installer for the rest), and option C (plugins only). Give each option its benefits, risks, and an estimated number of plan items.
    8. Start `## Recomendação` with one line `Recomendação: A`, `Recomendação: B`, or `Recomendação: C`. Then give at most five reasons, each citing the study.
    9. Under `## Fontes`, list every URL with the access date.

    Block 1:
    `````text
    Q1. Can a Claude Code plugin ship always-loaded global rules like the ~/.claude/CLAUDE.md block? If not, what is the closest mechanism (a SessionStart hook with additionalContext, an output style, another one)?
    Q2. How does a plugin hook refer to the plugin's own scripts (for example ${CLAUDE_PLUGIN_ROOT}), and does that work on Windows?
    Q3. Can one repository be both the marketplace (.claude-plugin/marketplace.json) and the plugin (.claude-plugin/plugin.json)?
    Q4. Are plugin commands and skills namespaced (for example /base_project:newgoal instead of /newgoal)? What does that change for the menu, the docs, and the user's habits?
    Q5. Which components can a Codex plugin ship (skills, MCP servers, hooks, agents), and where do personal marketplace files live?
    Q6. What can an opencode plugin ship? Can it add commands and agents, or only code hooks?
    Q7. How do update and removal work for a plugin, compared with /update and /uninstall?
    Q8. What happens to an existing installer-based install if the same commands also arrive from a plugin (duplicates, precedence)?
    Q9. Claude Code merged custom commands into skills; ~/.claude/commands/ still works. Should base_project install skills to ~/.claude/skills/<name>/SKILL.md, with or without a plugin?
    `````
  - check: `node -e "const t=require('fs').readFileSync('dev/estudo-distribuicao-plugins-2026.md','utf8');const h=['# Estudo: distribuir o base_project como plugin (2026-11)','## Pergunta','## O que cada engine oferece hoje','## Mapeamento dos componentes','## Comandos vs skills no Claude Code','## Riscos','## Opções','## Recomendação','## Fontes'];let i=0;const ordered=h.every((x)=>{const j=t.indexOf(x,i);if(j<0)return false;i=j;return true});const urls=new Set(t.match(/https:\/\/[^\s)>\]]+/g)||[]);process.exit(ordered&&/^Recomendação: [ABC]\b/m.test(t)&&urls.size>=8?0:1)"` → exit 0
  - stop-if: a page in step 1 cannot be read and no other official page answers the same question

### Final verification

- [x] **M23.19 Record the changes in the changelog and the ROADMAP**
  - proof: check exit 0, ROADMAP order 60 then 61 then decisions, 2026-11-22, haiku
  - tier: light · low
  - gate: auto
  - after: M23.3, M23.6, M23.7, M23.8, M23.11, M23.14
  - files: `README.md` (exists), `dev/ROADMAP.md` (exists)
    - Files: `README.md` (exists). Anchor: Pair 1 below, which M23.3 created. Change: add three changelog bullets. Do not touch: older releases.
    - Files: `dev/ROADMAP.md` (exists). Anchor: Pair 1 below. Change: add item 61 before the decisions list. Do not touch: item 60 from GOALS 22.
    - Verify: the check below → exit 0
    - Source: the items of this plan.
  - do:
    1. Edit the two files with the pairs below.
    2. Stop if `dev/ROADMAP.md` has no heading that starts with `## 60.`.

    File `README.md`. Replace each `old` text with its `new` text. Each `old` text occurs exactly once.

    Pair 1, old:
    `````text
    - `/diario` (contribution diary) was removed; diary files already on disk stay where they are
    `````
    Pair 1, new:
    `````text
    - `/diario` (contribution diary) was removed; diary files already on disk stay where they are
    - opencode files now install to `~/.config/opencode/agents/` and `commands/`, the plural folders opencode documents; the installer removes base_project's own copies from the legacy `agent/` and `command/` folders and leaves your files there
    - The always-on Context7 MCP is pinned to 4.7.3, and existing installs upgrade on the next installer run; every npm package in the plugin catalog is pinned to an exact version
    - CI tests Node.js 24 and 26 besides the minimum, Node.js 22; it uses a read-only token and pins each action to a commit
    `````

    File `dev/ROADMAP.md`. Replace each `old` text with its `new` text. Each `old` text occurs exactly once.

    Pair 1, old:
    `````text
    ---

    ## Decisões já tomadas (histórico, não reabrir sem motivo novo)
    `````
    Pair 1, new:
    `````text
    ## 61. Modernização e prontidão (GOALS 23) (2026-11-20)

    **Contexto**: avaliação de 2026-11-20 sobre o que ficou desatualizado. O CI testava só o Node 22
    (manutenção, fim em 2027-04-30), e o Node 26 é LTS ativo desde 2026-10-28. O opencode documenta
    `agents/` e `commands/` no plural, e o instalador escrevia nas pastas legadas `agent/` e
    `command/`. O Context7 estava fixado em 4.1.1 com a 4.7.3 publicada, e três entradas do catálogo
    usavam `@latest`. O README apontava para Discussions desativado e contradizia o catálogo sobre
    Postgres/SQLite. O SECURITY.md manda usar o relato privado de vulnerabilidade, desligado no GitHub
    nessa data.

    **Decisões**: Node mínimo 22, com CI também em 24 e 26; token do CI só leitura e actions fixadas
    por SHA; opencode nas pastas no plural, removendo só as cópias gerenciadas das pastas legadas;
    toda versão de pacote npm do catálogo fixada, com teste que rejeita `@latest`; `$schema` do Biome
    apontando para o pacote instalado. Distribuir o base_project como plugin nativo (Claude Code e
    Codex têm marketplaces) ficou para um estudo (`dev/estudo-distribuicao-plugins-2026.md`) e uma
    decisão do dono; este plano não migra nada.

    ---

    ## Decisões já tomadas (histórico, não reabrir sem motivo novo)
    `````
  - check: `node -e "const f=require('fs');const r=f.readFileSync('README.md','utf8');const d=f.readFileSync('dev/ROADMAP.md','utf8');process.exit(r.includes('the plural folders opencode documents')&&r.includes('pinned to 4.7.3')&&d.includes('## 61. Modernização e prontidão (GOALS 23)')&&d.indexOf('## 60.')<d.indexOf('## 61.')&&d.indexOf('## 61.')<d.indexOf('## Decisões já tomadas')?0:1)"` → exit 0
  - stop-if: an `old` text occurs zero times or more than once

- [x] **M23.20 Run the full local verification**
  - proof: npm ci, verify, harness, structure and archive checks exit 0; no singular opencode install path outside legacy notes, 2026-11-22, none (read-only item; the orchestrator ran it)
  - tier: light · low
  - gate: auto
  - after: M23.1, M23.2, M23.4, M23.12, M23.13, M23.15, M23.17, M23.19
  - files: none
    - Files: none. This item reads and runs; it edits nothing.
    - Verify: every command in the check below → exit 0
    - Source: `package.json` scripts; `CLAUDE.md` section "CI".
  - do:
    1. Run `npm ci`.
    2. Run `npm run verify`.
    3. Run `npm run test:harness`.
    4. Run `node dev/scripts/validate-goals-structure.js GOALS.md`.
    5. Run `node dev/scripts/goals-archive-index.js --check`.
    6. Run the check below.
    7. Stop at the first command that exits non-zero, and report its output.
  - check: `npm run verify && npm run test:harness && node dev/scripts/validate-goals-structure.js GOALS.md && node dev/scripts/goals-archive-index.js --check && node -e "const f=require('fs'),p=require('path');const files=['README.md','ARCHITECTURE.md','SECURITY.md'];const walk=(d)=>{for(const e of f.readdirSync(d,{withFileTypes:true})){const q=p.join(d,e.name);if(e.isDirectory())walk(q);else if(q.endsWith('.md'))files.push(q)}};walk('source');const bad=files.flatMap((q)=>f.readFileSync(q,'utf8').split('\n').filter((l)=>/~\/\.config\/opencode\/(agent|command)\//.test(l)&&!l.includes('legacy')).map((l)=>q+': '+l));if(bad.length)console.log(bad.join('\n'));process.exit(bad.length?1:0)"` → exit 0
  - stop-if: any command exits non-zero

### Explicitly out of scope

- Packaging base_project as a Claude Code or Codex plugin, and moving commands to `~/.claude/skills/`. Both wait for M23.18.
- Raising the minimum Node.js above 22. Revisit after Node 22 reaches end of life on 2027-04-30.
- Version bumps of already pinned catalog entries (`@toolbox-sdk/server`, `mcp-server-git`, `@modelcontextprotocol/server-filesystem`). `/updates` reports them.
- Archiving the bodies of GOALS 12 and 15–18, whose only open items are owner items. GOALS 21 D5 limits the owner backlog to executor-v1 plans.
- Removing the parked unified-layer code (R17.22b) and cutting the v1.2.0 release (R17.27). Both stay owner items.
- Enabling GitHub Discussions.

### Sources consulted

- Node.js release schedule: https://raw.githubusercontent.com/nodejs/Release/main/schedule.json and https://nodejs.org/en/blog/announcements/evolving-the-nodejs-release-schedule (accessed 2026-11-20).
- opencode commands and agents folders: https://opencode.ai/v2/docs/commands/ and https://opencode.ai/docs/commands (accessed 2026-11-20).
- Claude Code skills, plugins and marketplaces: https://code.claude.com/docs/en/skills, https://code.claude.com/docs/en/plugins-reference, https://code.claude.com/docs/en/plugin-marketplaces (accessed 2026-11-20).
- Codex plugins and skills: https://developers.openai.com/codex/plugins, https://developers.openai.com/codex/plugins/build/, https://developers.openai.com/codex/skills (accessed 2026-11-20).
- GitHub Actions secure use: https://docs.github.com/en/actions/reference/security/secure-use and https://github.blog/changelog/2025-08-15-github-actions-policy-now-supports-blocking-and-sha-pinning-actions/ (accessed 2026-11-20).
- GitHub private vulnerability reporting: https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting/configuring-private-vulnerability-reporting-for-a-repository (accessed 2026-11-20).
- Biome configuration schema: https://biomejs.dev/reference/configuration/ and https://polar.sh/biomejs/biome/issues/4147 (accessed 2026-11-20).
- Package versions from the npm registry (`npm view`) and PyPI on 2026-11-20: `@upstash/context7-mcp` 4.7.3, `@playwright/mcp` 0.0.86, `@supabase/mcp-server-supabase` 0.19.0, `ruflo` 3.79.1, `@toolbox-sdk/server` 1.17.0, `mcp-server-git` 2026.11.18; https://www.npmjs.com/package/@upstash/context7-mcp.
- Repository state on 2026-11-20: `gh repo view` (Discussions disabled, no Codex in the description, no GitHub release), `gh api .../private-vulnerability-reporting` (`{"enabled":false}`), `gh api .../branches/main/protection` (404, not protected), open Dependabot PR #20.
