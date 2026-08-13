---
# base_project:managed
description: Scan the current project for clutter and disorganized structure — dead files, misplaced folders, duplication. Read-only — reports and proposes a reorganization, never moves/deletes files on its own.
---

Audit the current project's file/folder organization and report what could be cleaned up
or reorganized. Read-only, same contract as `/scanproject` — never move, delete, or
rewrite anything in this command.

1. If `/scanproject` was already run earlier in this same conversation and the project
   hasn't changed since, reuse its section 9 ("Estrutura") finding instead of re-scanning
   from scratch — this command is a deeper pass on that one category, not an unrelated
   audit.

2. Map the actual directory tree (use `graphify-out/`/`repomix-output.xml` if present,
   otherwise list directories directly — don't guess from file names alone). Look for:
   - **Dead files**: generated artifacts that should be gitignored but are committed
     (build output, logs, `node_modules`, `__pycache__`, editor temp files), empty
     files/folders, files with no incoming reference (unimported module, orphaned
     script) — verify with a real grep for the filename before calling something dead,
     don't infer from name alone.
   - **Misplaced structure**: files sitting at the project root that belong in a
     subfolder by the language/framework's own convention, or a subfolder whose contents
     don't match its name.
   - **Duplication**: near-identical files (same logic copy-pasted instead of shared),
     or two folders serving the same purpose (e.g. `utils/` and `helpers/` both existing
     with overlapping content).
   - **Naming/casing inconsistency** that makes navigation harder (mixed
     kebab-case/camelCase/snake_case across sibling files without a reason).

3. For each finding, state the concrete evidence (the grep that found zero references,
   the two files that are near-duplicates, the path that breaks convention) — not a
   vague "this looks messy". Severity is about impact on navigability, not correctness:
   use `high` (actively misleading or duplicated logic), `medium` (clutter that slows
   down finding things), `low` (cosmetic, e.g. naming).

4. Propose a concrete target structure — where each flagged item should move to, or
   confirmation it should just be deleted — but do not execute any of it. If the project
   already has an organization doc (ARCHITECTURE.md or similar) that documents the
   *intended* structure, check the real tree against that doc specifically and flag any
   drift, since that's a stronger signal than generic convention.

5. End with one line: how many high/medium/low findings, and whether the user wants
   `/fixproject` to execute the reorganization (reuse the same fix-and-reverify path —
   moving a file is still a change that needs re-verification: nothing that imported the
   old path broke).

6. Do not fix, move, or delete anything in this command.

$ARGUMENTS
