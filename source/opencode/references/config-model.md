# base_project:managed

# Unified Config Layer — Canonical Model

Read by `doctor`, `audit`, `context`, `apply`, and the adapter system. Single source of truth for how base_project projects one canonical source into N agent shapes.

## 1. Canonical store location (Decision R0)

- **Canonical unified store**: `~/.agents/` — introduced by this epic, mirrors `dot-agents` convention (`dot-agents/dot-agents` v1, `agentsync` `~/.agentsync/`). Chosen over reusing `~/.base_project/` alone because `~/.agents/` is the de-facto ecosystem name users already search for; `~/.base_project/` stays for THIS project's own bookkeeping (repo-path, diary-root, usage ledger `~/.claude/base_project/usage/`), not for unified agent configs.
- **Compatibility shim**: `~/.base_project/` is never deleted. On first `init`, if `~/.base_project/` exists and `~/.agents/` does not, `init` creates `~/.agents/` and writes a `README.md` noting the relationship. Existing `~/.base_project/repo-path.txt` and `~/.base_project/diary-root.txt` stay where they are (referenced via `~/.base_project/`).
- **Overrides**: `BASE_PROJECT_HOME` / `AGENTS_HOME` env var may point to an alternate canonical root (used by tests via `os.tmpdir()`). `paths.js` centralizes resolution: `CANONICAL_HOME = process.env.AGENTS_HOME || process.env.BASE_PROJECT_HOME || path.join(os.homedir(), ".agents")`.
- **Not created automatically on unrelated machines**: `install.ps1`/`.sh` creates `~/.agents/` scaffolding only; it does not write into any project repo.

## 2. Canonical layout (Decision R0, scaffolding Phase 0.2)

```
~/.agents/
├── config.json              # { schema_version: "1.0", projects: { <name>: { path, added } }, defaults: { link_type: "auto" } }
├── rules/
│   ├── global/              # applies to ALL projects
│   │   ├── CLAUDE.md        # seed
│   │   └── AGENTS.md        # seed
│   └── <project>/           # per-project overrides
├── mcp/
│   └── mcp.json             # { mcpServers: { name: { command, args, env, type, url, headers } } } — seed from source/opencode/mcp.json
├── skills/                  # SKILL.md directories, one per skill
├── commands/                # slash-command markdowns
├── tasks/                   # <project>.jsonl (append-only, Phase 5.1)
├── history/                 # session jsonl
├── reports/                 # <project>.json translation reports (Phase 1.3)
├── snapshots/               # <name>.tar.gz (Phase 5.2)
├── keys/
│   └── age.txt              # age keypair, gitignored, never committed (Phase 2.2)
├── .gitignore               # ignores keys/, reports/, snapshots/ if desired; keys/ always ignored
└── README.md
```

## 3. Hierarchical layers (Decision R1)

Three layers, ordered, like `opencode.ai/docs/config` 8-layer precedence (remote→global→custom→project) but simplified to 3 for this installer:

```
global → agent:<name> → project:<name>
```

- `global`: `~/.agents/rules/global/*` — shared baseline.
- `agent:<name>`: `~/.agents/rules/<agent>/*` (optional) — agent-specific tuning (e.g., Cursor needs MDC frontmatter).
- `project:<name>`: `~/.agents/rules/<project>/*` — project-specific overrides, bound via `config.json` `projects` map.

**Merge semantics**: later layer overrides conflicting keys, preserves non-conflicting keys. For Markdown rules, effective content = concatenation `global + agent + project` in that order (later lines win for duplicated headings — documented but not auto-deduped). For JSON (MCP, adapters), merge is deep per-key (later layer's key replaces earlier's value for that key only).

**Binding**: projects are not discovered by scanning HOME; they are explicitly bound via `config.json` `projects` map managed by `add <path>`/`remove <name>`. This matches `dot-agents` `config.json` and avoids scanning every `AGENTS.md` on disk.

**Extends (deferred)**: `AGOrcha/dot-agents` `extends` (git/local/HTTP + `.agentsrc.lock` SHA pinning) is not implemented in this epic; noted as a future goal if a concrete shared-layer request appears — same `recommend_if` gating `plugins.json` uses.

## 4. Link-type strategy (Decision R4)

- Default `link_type: "auto"` → **symlink** for all agents/files.
- Exception: **Cursor** `.cursor/rules/*` → **hardlink** (verified: Cursor does not follow symlinks for `.cursor/rules/*.mdc`; dot-agents docs and local `fs.stat` inode check confirm). Hardlinks share inode, so edits on either side reflect automatically on same device.
- `EXDEV` (cross-device) fallback: if `fs.link` fails with `EXDEV`, warn and copy file, flag in `doctor` as `warning` not `error` (Phase 1.4).
- `doctor` is the arbiter of link health; `apply --fix` recreates broken links.

## 5. Monorepo support (Decision R4)

- Optional target option `type: "nested-glob"` for memory:
  - `source: "."` (project root), `pattern: "**/AGENTS.md"`, `destination: "{relative_path}/CLAUDE.md"` (or per-agent equivalent)
  - `exclude: ["node_modules/**", ".agents/**", ".git/**", "dist/**", "build/**"]`
- Same shape `dallay/agentsync` uses for `AGENTS.md` discovery. Resolver discovers multiple package roots under one repo and projects one memory file per package. Off by default; enabled via `config.json` per target when a repo contains `packages/*` or `apps/*`.

## 6. Non-goals for this model

- No cloud sync (100% local, git-to-own-remote only).
- No automatic migration of existing `~/.claude/` files without `capture` + explicit consent.
- No `extends` shared layers in this epic.
