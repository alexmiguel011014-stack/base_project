---
# base_project:managed
name: cleanproject
description: Read-only organization audit for dead files, misplaced folders, duplication, and repository clutter. Use for $cleanproject or an explicit request to plan cleanup without changing files.
---

Inspect the current repository without moving, deleting, or editing anything.

1. Understand the project from its manifests, README, `graphify-out/`, and targeted file listing. Never traverse dependency or vendored directories wholesale. When `graphify-out/GRAPH_REPORT.md` exists, its `## Knowledge Gaps` section (isolated nodes, thin communities) is the starting candidate list for dead/disconnected files — read it before a raw file listing.
2. Identify dead or generated files that appear tracked accidentally, misplaced modules, duplicated implementations, ambiguous root-level files, stale artifacts, and directory boundaries that disagree with runtime imports or build configuration.
3. Prove each candidate with references, imports, manifest entries, git history when useful, generated-file configuration, or a `graphify affected "<path>"` trace showing no dependents (stronger than grep — follows resolved graph edges, not text matches). An isolated node named in Knowledge Gaps is a signal to verify, not proof — convention/reflection-based wiring (DI, ORM auto-discovery, dynamic imports) won't show as a graph edge. Fall back to references/imports/grep alone when Graphify isn't available. “Looks unused” is not proof.
4. Distinguish safe moves/removals from changes that need a compatibility or migration plan.
5. Return a prioritized cleanup plan with exact paths, rationale, risk, and verification for each action.

This skill is read-only. `$fixproject` applies accepted cleanup work.

