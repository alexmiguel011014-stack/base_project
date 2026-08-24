# base_project:managed

# Adapter Interface (Decision R2)

Minimal interface every adapter implements. Modeled on `spxrogers/agentsync` `internal/` packages: apply/capture/drift-classifier + translation report.

## Interface

Each adapter is `dev/scripts/adapters/<name>.js` exporting:

```js
export const id = "claude-code";          // matches adapters.json key
export const name = "Claude Code";
export function detect(home)               // -> boolean: is this agent present?
export function apply(canonical, project, opts)  // canonical = ~/.agents path, project = { name, path }, opts = { dryRun, scope }
export function capture(project, home)     // reads native config, returns canonical-shaped object
export function report()                   // returns last apply's { agent, scope, projected, skipped: [{reason}], lossy: [{field, dropped}] }
```

`apply` never silently drops. Every lossy transform or skipped scope is pushed to `lossy`/`skipped` with a reason string, surfaced to stdout and written to `<canonical>/reports/<project>.json` (Phase 1.3).

## Tiers

- **Deep (9)**: `claude-code`, `opencode`, `codex`, `cursor`, `gemini-cli`, `continue`, `windsurf`, `roo-code`, `cline` — full per-agent transforms verified against upstream docs + `spxrogers/agentsync` known limits.
- **Breadth (22)**: data-driven from `source/adapters.json` generic adapter — memory for all, MCP where `mcpServers` JSON shape is shared, `SKILL.md` where agent scans a directory. Adding a new entry to `adapters.json` without touching JS must project a new agent's memory file in dry-run (Phase 1.2).

## Adapter registry

`dev/scripts/adapters/index.js` loads `source/adapters.json` + deep modules and exposes `list()`, `get(id)`, `detectAll()`.

## Drift classifier

`dev/scripts/drift.js` compares `capture(native)` vs `apply(canonical)` and labels:

- `in-sync` — byte-equal after projection
- `drift` — native differs from projected
- `missing` — native file absent

Exit code: 0 in-sync, 1 drift/missing (so CI can gate).

## Link-type per adapter

Registry entry includes `link_type: "symlink" | "hardlink" | "auto"`. Only `cursor` defaults to `hardlink`; others default to `symlink`. `paths.js` resolves final type.

## Security invariant

Every `apply` that would touch a file containing a secret-bearing key (`*_API_KEY`, `*_TOKEN`) must go through `secrets.js` encrypt/decrypt; canonical never stores plaintext for those keys. `scan-skill.js` pre-trust scan runs before any marketplace fetch (Phase 2.3).
