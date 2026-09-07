---
# base_project:managed
name: diario
description: Create or update this project's external contribution diary from the shared usage ledger and git history. Use only when the user invokes $diario or explicitly asks to record the work diary.
---

Append evidence-based entries to this project's contribution diary. Never write diary content inside any repository.

1. Resolve the diary root from `~/.base_project/diary-root.txt`. If absent, default to `~/Documentos/Diarios_contribuicao`, create it, and persist that path.
2. Hard-stop if `git -C <diary-root> rev-parse --is-inside-work-tree` succeeds. The diary must not be reachable by a repository. Never make a one-time exception.
3. On first use, create a `.gitignore` containing `*`, a `_source/` directory, and a README explaining the privacy boundary.
4. Target the current project unless arguments supply another path or `--all`. Derive its public name from the git remote when possible, otherwise the folder name.
5. Gather evidence with `node ~/.claude/base_project/scripts/diary-source.js --project <root> [--since YYYY-MM-DD]`. Claude and Codex deliberately share this existing ledger and helper path so prior diary history remains continuous. State that opencode and offline work are outside ledger coverage; commits may partially fill gaps.
6. Read `_source/<project>.md` and append only dates after its last entry. Never rewrite history or duplicate a previously covered range. If only an older `.docx` exists, start a new Markdown source and flag manual reconciliation instead of reverse-parsing Word XML.
7. Write Portuguese first-person entries with a numbered day/date heading, concrete title, reasoning and decisions, failures or dead ends, and estimated active duration. Synthesize prompts; never quote raw prompt text.
8. Rebuild the full contribution summary table and total duration from all entries on every run.
9. State evidence start date, that durations estimate active time with idle gaps excluded, and when early history was reconstructed only from commits.
10. Render the complete Markdown source to `<project>.docx` using the available document skill/tooling. Map headings, bold spans, paragraphs, and the summary to real Word structures. Join wrapped non-blank source lines before parsing bold spans.
11. Verify the `.docx`: unzip it, parse `word/document.xml` as valid XML, ensure no literal `**` remains, and match Word day-heading count to Markdown entries. If office/PDF rendering is available, inspect a rendered page too.
12. Report only the `.docx` path, entries added, and covered date range.

The diary's location, source format, and existing ledger are compatibility contracts. Do not migrate or rename them as part of this skill.

