---
# base_project:managed
description: Record what was done in this project into its contribution diary (lite). A per-project Word document kept outside every repository.
---

Append to (or create) this project's contribution diary: dated entries describing what was actually worked on, built from real recorded evidence, not memory or guesswork.

Diaries live outside every repository, by design — this content must never reach GitHub.

Scope limit, state this in the diary itself: the ledger this reads only covers Claude Code — work done in opencode or elsewhere leaves no trace in it. Commits still capture some of it, but a day with little recorded activity means little was recorded, not that little was done.

STEP 1 — Resolve the diary root. Read `~/.base_project/diary-root.txt`. If it doesn't exist, default to `~/Documentos/Diarios_contribuicao`, create it, and write that path into the state file.

STEP 2 — Hard stop check, never skip: run `git -C <diary-root> rev-parse --is-inside-work-tree`. If it succeeds, the diary root is inside a git repo and a commit could publish it. Stop, explain that exactly, and ask the user to move the directory or point the state file elsewhere. Never write the file anyway.

STEP 3 — On first use, scaffold the directory: a `.gitignore` containing `*`, a `_source/` subfolder, and a `README.md` stating the directory is never to be committed.

STEP 4 — Determine the target project: the current working directory by default. `$ARGUMENTS` may name another project path, or `--all` for every project the ledger knows about. Use the project's git remote repo name if it has one, otherwise the folder name.

STEP 5 — Gather the evidence, never invent it: `node ~/.config/opencode/base_project/scripts/diary-source.js --project <project-root> [--since YYYY-MM-DD]`. It returns per day: active duration, session count, tools used, files touched, prompts that opened each chain, and git commits. Idle gaps over 30 minutes don't count as active time.

STEP 6 — Read the existing `_source/<project>.md` first. Only append after its last recorded date — never overwrite or rewrite history already written. Pass that last date as `--since`. If `_source/<project>.md` doesn't exist but `<project>.docx` does, treat it as a fresh start and read the `.docx` for the user to reconcile manually.

STEP 7 — Write entries in Portuguese, in this format:
```markdown
## Dia N - DD/MM/AAAA
**Título curto e concreto da atividade**

Parágrafo em primeira pessoa: o que foi feito, por quê, quais decisões foram tomadas e o
que deu errado no caminho.

**(duração: XhYmin)**
```
Synthesize from the evidence. Never transcribe raw prompt text into the diary — describe what was worked on, don't quote the conversation.

STEP 8 — Rebuild the summary table from the full entry list every time, never by incrementing a stored total:
```markdown
## Sumário das Contribuições
| Data | Título | Horas |
|---|---|---|
| DD/MM/AAAA | ... | HH:MM |
| | **TOTAL** | **HH:MM** |
```

STEP 9 — State coverage honestly in the diary header: the date recorded evidence starts, that durations are estimates (not a timesheet), and — if git history predates the ledger — that early entries are reconstructed from commits alone and are thinner.

STEP 10 — Render `_source/<project>.md` to `<project>.docx`. Use the `docx` skill's approach — a small docx-js script written fresh. Map: `# Title` → `HeadingLevel.TITLE`, `## Dia N - ...` → `HeadingLevel.HEADING_1`, `**bold**` spans → bold `TextRun`s, the summary table → a real `Table`. Join consecutive non-blank source lines into one paragraph before parsing `**bold**` spans — a bold span split across lines won't match a per-line regex. Always regenerate the whole `.docx` from the whole current `.md` — never patch an existing `.docx`'s XML incrementally.

STEP 11 — Verify the render before reporting success. Unzip the produced `.docx` and check `word/document.xml`: valid XML (`python -c "import xml.dom.minidom as m; m.parse('word/document.xml')"`), no stray `**` left over, and the day-heading count matches the number of dated entries in the source. If LibreOffice (`soffice`) is available, also convert to PDF and look at a page — its absence doesn't excuse skipping the XML check.

STEP 12 — Never write a diary file into the project being documented, regardless of `$ARGUMENTS`. The only writable location is the diary root from step 1.

STEP 13 — Report only: which diaries were written or updated (the `.docx` path), how many entries were added, and the date range covered.

$ARGUMENTS
