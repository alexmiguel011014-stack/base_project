## base_project — Global Operating Rules for Codex

These rules apply in every project unless a project-local `AGENTS.md` overrides them.

### Token Economy
- Never fully read `external/`, `node_modules/`, `.venv/`, or other vendored/dependency directories.
- Before scanning an unfamiliar codebase, check for `graphify-out/`; if missing, run `$bootstrap` first.
- When editing, show only changed lines with minimal surrounding context; never rewrite whole files unless asked.

### Security
- Never commit or hardcode real API keys, tokens, or credentials in a project repository.
- Read runtime secrets from the project's own gitignored `.env`. MCP credentials belong in Codex user configuration, never in a project repository.

### Workflow
1. **Plan** — use the read-only `architect` subagent before non-trivial changes.
2. **Implement** — use the `coder` subagent for surgical, scoped edits.
3. **Review** — use the `reviewer` subagent to inspect the diff and run the project's lint, typecheck, and tests. It never commits unless explicitly asked.
4. **Plan is not execution** — a planning or research skill such as `$newgoal` or `$repertoire` never implements its output in the same turn. `$execgoals`, or a separate explicit request, performs execution.
5. **Tiered autonomy** — classify every action before taking it: **auto-approved** for routine, reversible work inside the current repository; **notify-and-proceed** for an in-scope, reversible change whose visible effect should be stated before continuing; and **human-in-the-loop** for an irreversible or hard-to-recover action, a material scope choice, data/state outside base_project's own repository, sensitive data, credentials, or external publication. Decide from reversibility, scope of affected state, and data sensitivity — not from whether the action merely looks technically easy. The ERP database compatibility test is the model case for human-in-the-loop: even a copied test database was external sensitive data, so it required explicit approval first.

### Autonomy and Confirmations
- Once the user authorizes a task, perform ordinary, reversible, in-scope implementation and verification without repeatedly asking permission.
- Ask only when a choice materially changes scope, an action is destructive or difficult to recover, credentials or external publication are involved, or a workflow defines its own explicit safety gate such as `$council`, `$pr`, `$uninstall`, or destructive tiers of `$undo`.
- A sandbox or host approval is an environment requirement; do not duplicate that question in chat.

### Plugin Auto-Suggestion
- At the start of substantial project work, check `~/.codex/base_project/plugins.json` once against the project. If a catalog condition clearly matches and the capability is not installed, mention it once without interrupting the task.
- Never install or register a plugin on your own initiative. The user must explicitly invoke `$plugins` or separately request installation.
- Do not repeat a suggestion in the same session after it was mentioned or declined.

### WhatsApp-Style Menu
- Show the menu only at the start of a session when the first request is not already specific, and after completing a substantial task.
- Read `~/.codex/base_project/references/command-menu.md` and render it verbatim. Never reconstruct it from memory.
- Skip the menu whenever the user has already made a direct request.

### Contribution Diary
- After substantial work, mention once that `$diario` can record it. Never write a diary unless asked.
- Diaries remain outside every repository, using the root in `~/.base_project/diary-root.txt`. Never suggest committing them.
- Codex and Claude share the existing ledger under `~/.claude/base_project/usage/` so historical diaries remain continuous.

### Self-Correction
- After code changes, detect and run the project's own test, typecheck, lint, or build commands from its manifest. Fix failures before delivery.

### Task Sizing and Responses
- Answer trivial questions directly. Use the full Plan → Implement → Review workflow for substantial work.
- Be concise by default without weakening exact paths, numbers, code, or safety negations.
- When a deliverable is written to a file, point to the file and summarize it briefly instead of duplicating its full contents in chat.
