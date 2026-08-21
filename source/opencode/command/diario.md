---
# base_project:managed
description: Record what was done in this project into its contribution diary — a per-project Word document (.docx) kept in one central directory outside every repository, so it can never reach GitHub. Synthesizes narrative entries from the tool-call ledger usage-log.js already records, plus git history.
---

Append to (or create) this project's contribution diary: dated entries describing what was
actually worked on, synthesized from real recorded evidence rather than memory or guesswork.

**Diaries live outside every repository, by design.** They are personal work records that may
quote internal decisions and file paths, and the user's requirement is absolute: this content
must never reach GitHub. That is enforced structurally — the diary directory is a sibling of
the project folders, inside none of them — not by trusting a `.gitignore` inside a repo.

**Scope limit, state it in the diary itself**: the ledger this reads only covers Claude Code —
`usage-log.js` registers as a Claude Code hook, and the ledger and scripts install only under
`~/.claude/`, in both engines (the same limit `/reviewusage` already declares). Work done
elsewhere — in opencode, in another editor, away from the keyboard — leaves no trace here.
Commits still capture some of it, but a day that shows little recorded activity means little
was *recorded*, not that little was done, and the diary must say so rather than implying an
idle day.

1. **Resolve the diary root.** Read `~/.base_project/diary-root.txt` (same state-file
   convention `~/.base_project/repo-path.txt` already uses for `/update` and `/status`). If it
   doesn't exist, default to `~/Documentos/Diarios_contribuicao`, create it, and write that path
   into the state file so the next run agrees with this one.

2. **Refuse to write inside a repository — hard stop, never a silent fallback.** Before writing
   anything, run `git -C <diary-root> rev-parse --is-inside-work-tree`. If it succeeds, the
   diary root is inside a git work tree and a commit could publish it. Stop, explain exactly
   that, and ask the user to move the directory or point the state file elsewhere. Never write
   the file anyway, never "just this once" — this check is the entire safety guarantee.

3. **Scaffold the directory on first use**: a `.gitignore` containing `*` (a second, independent
   lock in case the directory ever becomes a repository later), a `_source/` subfolder, and a
   `README.md` stating what the directory is and that it is never to be committed anywhere.

   **Two files per project, different jobs.** `_source/<project>.md` is the internal working
   copy this command appends to — Markdown, because appending text and diffing history is what
   it's for. `<project>.docx` at the diary root is the deliverable — regenerated from the full
   `_source/<project>.md` on every run, because a Word document isn't something you patch
   incrementally the way a text file is. The user reads and hands over the `.docx`; they never
   need to open the `.md`.

4. **Determine the target project.** Default: the current working directory. `$ARGUMENTS` may
   name another project path, or `--all` to sweep every project the ledger knows about. The
   project's *name* comes from its git remote's repository name when it has one, falling back
   to the folder name — the folder is often named something only this machine understands
   (`ERP_HK` on disk is the project everyone calls `ERP`).

5. **Gather the evidence** — never invent it:
   ```
   node ~/.claude/base_project/scripts/diary-source.js --project <project-root> [--since YYYY-MM-DD]
   ```
   It returns, per day: active duration, session count, tools used, files touched, the prompts
   that opened each chain, and git commits. Duration excludes idle gaps over 30 minutes, so a
   session left open overnight doesn't report as a full night of work.

6. **Read the existing `_source/<project>.md` first, and only append after its last recorded
   date.** Same rule `newgoal.md` step 6 applies to `GOALS.md` — never overwrite, never rewrite
   history already written. Re-running for a range already recorded must change nothing. Pass
   that last date as `--since` so the script doesn't re-report what's already in the file. If
   `_source/<project>.md` doesn't exist yet but `<project>.docx` does (a diary from before this
   command tracked a Markdown source), treat it as a fresh start — read the `.docx` for a human
   to reconcile manually rather than trying to parse Word XML back into the source format.

7. **Write entries in Portuguese**, in this format (the user's own template — content is read by
   people, so it follows the repo's language rule: text rendered literally to the user goes in
   the user's language, even though this command file is in English):

   ```markdown
   ## Dia N - DD/MM/AAAA
   **Título curto e concreto da atividade**

   Parágrafo em primeira pessoa: o que foi feito, por quê, quais decisões foram tomadas e o
   que deu errado no caminho. Um diário que só lista arquivos alterados não vale a leitura —
   o valor está no raciocínio, nos becos sem saída e nas escolhas.

   **(duração: XhYmin)**
   ```

   Synthesize from the evidence; **never transcribe raw prompt text into the diary.** Prompts
   can contain content the user would not want copied verbatim into a document they may hand
   to someone else. Describe what was worked on, don't quote the conversation.

8. **Rebuild the summary table from the full entry list every time**, never by incrementing a
   stored total — a table computed from scratch cannot drift out of sync with the entries above
   it:

   ```markdown
   ## Sumário das Contribuições
   | Data | Título | Horas |
   |---|---|---|
   | DD/MM/AAAA | ... | HH:MM |
   | | **TOTAL** | **HH:MM** |
   ```

9. **State coverage honestly in the diary header**: the date the recorded evidence starts, that
   durations are estimates of active session time (not a timesheet), and — when the project's
   git history predates the ledger — that early entries are reconstructed from commits alone
   and are therefore thinner. A diary that overstates its own completeness is worse than a
   short one.

10. **Render `_source/<project>.md` to `<project>.docx`** — this is the step that actually
    produces the deliverable; steps 6-9 only update the Markdown source. Use the `docx` skill's
    approach for creating a new document (a small docx-js script, written fresh — this project
    deliberately doesn't carry a checked-in renderer or a `docx` npm dependency; see
    `dev/ROADMAP.md` item 39 for why). Map the fixed diary shape directly: `# Title` →
    `HeadingLevel.TITLE`, `## Dia N - ...` → `HeadingLevel.HEADING_1`, `**bold**` spans →
    bold `TextRun`s, the summary table → a real `Table`/`TableRow`/`TableCell` (not one
    line of plain text). **Join consecutive non-blank source lines into one paragraph before
    parsing `**bold**` spans** — this repo's diaries wrap paragraphs across lines (its own
    ~88-90 char convention), and a bold span that starts on one line and ends on the next
    never matches a per-line regex; this exact bug shipped once and was only caught by
    unzipping the output and grepping for a stray `**`, not by the render command succeeding.
    Always regenerate the whole `.docx` from the whole current `.md` — never try to patch an
    existing `.docx`'s XML incrementally, which is far more failure-prone than a clean
    regenerate for a document this size.

11. **Verify the render before reporting success — a script that didn't throw is not proof the
    document is right.** Unzip the produced `.docx` and check `word/document.xml`: valid XML
    (`python -c "import xml.dom.minidom as m; m.parse('word/document.xml')"`), no stray `**`
    left over (a literal `**` surviving means the join-paragraphs step above has a gap), and the
    day-heading count matches the number of dated entries in the source. If LibreOffice
    (`soffice`) is available in this session, additionally convert to PDF and look at a page,
    per the `docx` skill's own verification step — but its absence doesn't excuse skipping the
    XML-level check, which needs no extra tooling.

12. **Never write a diary file into the project being documented**, regardless of `$ARGUMENTS`.
    The only writable location is the resolved diary root from step 1.

13. Report only: which diaries were written or updated (`.docx` path), how many entries were
    added, and the covered date range — not the entries themselves, the file has those.

$ARGUMENTS
