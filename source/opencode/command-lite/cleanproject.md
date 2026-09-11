---
# base_project:managed
description: Scan the project for clutter and disorganized structure (lite). Read-only — reports and proposes, never moves or deletes files.
---

Audit the project's file/folder organization and report what could be cleaned up. Read-only — never move, delete, or rewrite anything in this command.

STEP 1 — If `/scanproject` already ran earlier in this same conversation and the project hasn't changed since, reuse its structure finding instead of rescanning.

STEP 2 — Map the real directory tree. Use `graphify-out/`/`repomix-output.xml` if present, otherwise list directories directly — never guess from file names alone. Look for:
- Dead files: generated artifacts that should be gitignored but are committed, empty files/folders, files with no incoming reference. Verify with a real grep before calling something dead. When `graphify-out/GRAPH_REPORT.md` exists, check its Knowledge Gaps section first (isolated nodes, thin communities), then confirm with `graphify affected "<path>"` (stronger than grep — follows resolved edges); name the specific isolated node, don't just say "looks disconnected" (convention/reflection-based wiring won't show as an edge). Fall back to a real grep alone when Graphify isn't available.
- Misplaced structure: files at the project root that belong in a subfolder by convention, or a subfolder whose contents don't match its name.
- Duplication: near-identical files, or two folders serving the same purpose.
- Naming inconsistency that makes navigation harder.

STEP 3 — For each finding, state the concrete evidence (the grep that found nothing, the `graphify affected` trace with no dependents, the two near-duplicate files, the path that breaks convention). Severity: `high` (misleading or duplicated logic), `medium` (clutter that slows navigation), `low` (cosmetic).

STEP 4 — Propose a concrete target structure — where each item should move, or that it should be deleted. Do not execute any of it. If the project has an architecture doc describing the intended structure, check the real tree against it and flag drift.

STEP 5 — Report: how many high/medium/low findings, and whether `/fixproject` should run next.

STEP 6 — Do not fix, move, or delete anything in this command.

$ARGUMENTS
