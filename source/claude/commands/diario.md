---
# base_project:managed
description: Record what was done in this project into its contribution diary — a per-project Word document (.docx) kept in one central directory outside every repository, so it can never reach GitHub. Synthesizes narrative entries from the tool-call ledger usage-log.js already records, plus git history, and renders them into the fixed "Projeto de Extensão" university template.
---

Append to (or create) this project's contribution diary: dated entries describing what was
actually worked on, synthesized from real recorded evidence rather than memory or guesswork,
rendered into the fixed official template ("Template Diário de Contribuições.docx", a
university extension-project format with Orientador/Matrícula/Nome do Discente fields).

**Diaries live outside every repository, by design.** They are personal work records that may
quote internal decisions and file paths, and the user's requirement is absolute: this content
must never reach GitHub. That is enforced structurally — the diary directory is a sibling of
the project folders, inside none of them — not by trusting a `.gitignore` inside a repo.

**Scope limit, state it in the diary itself**: the ledger this reads only covers Claude Code —
`usage-log.js` registers as a Claude Code hook, and the ledger and scripts install only under
`~/.claude/`, in both engines (the same limit `/usagebp` already declares). Work done
elsewhere — in opencode, in another editor, in Codex, on another machine, away from the
keyboard — leaves no trace here. Commits still capture some of it, but a day that shows little
recorded activity means little was *recorded*, not that little was done, and the diary must say
so rather than implying an idle day.

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
   incrementally the way a text file is. The user reads, hands over, and can manually edit the
   `.docx`; they never need to open the `.md` themselves, but a manual edit made directly in the
   `.docx` will be overwritten on the next `/diario` run for that project unless it's also
   reflected in `_source/<project>.md` — say so if the user reports having hand-edited a `.docx`.

4. **Resolve the shared student/advisor profile and the hour plan.** Read
   `~/.base_project/diario-perfil.json`:
   ```json
   {
     "nomeDiscente": "...", "matricula": "...", "orientador": "...",
     "metaTotal": "400:00",
     "conjunto": [
       { "projeto": "ERP", "repo": "<pasta do git>", "pastas": ["<pasta>"], "modo": "auditado" },
       { "projeto": "Personal_app", "repo": "<pasta do git>", "pastas": ["<pasta>"], "modo": "ajuste" }
     ],
     "foraDoConjunto": [ { "projeto": "...", "repo": "<pasta do git>", "pastas": ["<pasta>"] } ],
     "horasAlvoPorProjeto": "112:00"
   }
   ```
   `nomeDiscente`, `matricula` and `orientador` are the same across every project's diary (one
   student, one advisor) and must never be re-derived or guessed. `metaTotal` is the combined
   hour target of the projects in `conjunto` — the user needs about 390h for the extension
   component and aims at 400:00 for margin. The advisor wrote on 21/10/2026 that 112h was only
   an estimate (4h per week), that going above it is fine, and that what matters is that the
   diary represents equivalent effort. `modo` is `auditado` (the project keeps its own audited
   hours in full) or `ajuste` (at most one project: it receives whatever closes the total).
   `foraDoConjunto` lists projects that do not count toward the target but share the same
   person, so their effort still enters the daily limit (step 9). `ignorarDias` (optional, per
   project, `["AAAA-MM-DD"]`) removes days whose only activity was administrative, such as
   generating the diary itself. `horasAlvoPorProjeto` (default 112:00) is the legacy per-project
   target, used only for a project that is in neither list.

   If the file or any of its fields doesn't exist yet, **stop and ask the user** before
   writing anything — do not invent a name, matrícula, advisor, hour target or project set.
   Once given, write them to this file so future runs never have to ask again. If the user
   later reports a change (new advisor, corrected matrícula, a different set of projects),
   update the file and mention which past diaries may now be stale.

5. **Determine the target project.** Default: the current working directory. `$ARGUMENTS` may
   name another project path, or `--all` to sweep every project the ledger knows about. The
   project's *name* comes from its git remote's repository name when it has one, falling back
   to the folder name — the folder is often named something only this machine understands
   (`ERP_HK` on disk is the project everyone calls `ERP`).

6. **Gather the evidence** — never invent the *content*:
   ```
   node ~/.claude/base_project/scripts/diary-source.js --project <project-root> [--since YYYY-MM-DD]
   ```
   It returns, per day: active duration, session count, tools used, files touched, the prompts
   that opened each chain, and git commits. Duration excludes idle gaps over 30 minutes, so a
   session left open overnight doesn't report as a full night of work. This evidence drives the
   *narrative* (what was done, titles, summaries) — it does **not** drive the hour value
   written into each entry; see step 9.

   The script is a start, not the whole picture. Read the commits yourself too, all branches:
   `git log --all --no-merges` with full messages and `--numstat`, newest-first by default —
   narrate in chronological order. `--project` only matches the project's main root, so work
   done from a git worktree or from another folder (the ledger records the *session's* folder,
   not the project the files belong to) is undercounted; `diary-hours.js` (step 9) attributes by
   file path too. Ledger timestamps are UTC; the user's day is local time (UTC-3 in Brazil), and
   a commit shortly after midnight stays on the calendar day git shows, so the diary matches
   what GitHub shows. Codex sessions appear only as prompts (no file list), so for those days
   say what the day aimed at and what the commits show, not a diff.

   **The ledger can hold credentials pasted into prompts or commands** (tokens, passwords,
   one-time login codes). Never copy any of it into a diary, and tell the user if you notice one.

7. **Read the existing `_source/<project>.md` first, and only append after its last recorded
   date.** Same rule `newgoal.md` step 6 applies to `GOALS.md` — never overwrite, never rewrite
   history already written. Re-running for a range already recorded must change nothing except
   the hour rebalancing described in step 9. Pass the last recorded date as `--since` so the
   script doesn't re-report what's already in the file. If `_source/<project>.md` doesn't exist
   yet but `<project>.docx` does (a diary from before this command tracked a Markdown source),
   treat it as a fresh start — read the `.docx` for a human to reconcile manually rather than
   trying to parse Word XML back into the source format. Only the user can ask for a full
   rewrite of already-written entries (as happened on 17/10 and 21/10/2026, when the diaries
   were rewritten session by session after the advisor found them too summarized).

8. **Write entries in Portuguese**, following the fixed template's field structure exactly —
   this is not a free-form journal format, it maps directly onto the official document:

   ```markdown
   # Diário de Contribuições — <Nome do Projeto>

   **Projeto de Extensão**: <mesmo nome do projeto, salvo indicação em contrário do usuário>
   **Orientador**: <do perfil, passo 4>
   **Matrícula do Discente**: <do perfil, passo 4>
   **Nome do Discente**: <do perfil, passo 4>
   **Data de Início das Contribuições**: <data do primeiro commit/entrada>

   ## Projeto Apoiado

   **Projeto**: <nome do projeto>
   **Descrição**: <1-3 frases, do README ou do que o projeto faz>
   **Página do Projeto**: <URL — só inclua esta linha se existir uma página pública além do repo>
   **Repositório de Código**: <URL do remoto git>
   **Justificativa para apoiar o projeto**: <1-3 frases — projeto próprio em desenvolvimento
   contínuo, não uma contribuição a repositório de terceiro, salvo se for genuinamente o caso>

   > Nota interna — não entra no `.docx`. <metodologia de distribuição das horas deste diário,
   > ver passo 9 — isto é auditoria interna, não aparece no documento renderizado>

   ## Contribuições Realizadas

   ## Dia N - DD/MM/AAAA
   **Título da contribuição**: <título curto e concreto>

   **Resumo da contribuição**: <2 a 5 parágrafos em primeira pessoa, no pretérito>

   **Horas gastas na contribuição**: HH:MM
   ```

   **How to write the resumo.** The reader is the advisor, and the professor already found
   short, list-like diaries insufficient. Write it as a narrative of the day, one paragraph per
   work session (manhã, tarde, noite, with approximate clock times only where a commit or ledger
   event supports them): what was built or changed, why, which problem appeared and how it was
   solved, how it was verified, and what it means for the project. Explain technical terms in
   a clause the first time they appear. Concrete beats generic: name the module, the rule, the
   screen, the number that matters. Do not claim a cause, a result or a decision the evidence
   (commit bodies, files edited, commands run) does not support — when only a commit exists,
   describe it by what the commit says.

   **What does not belong in a diary** — it was removed from every diary on 17/10 and 21/10/2026
   and must not come back: ledger event counts and session counts; "sem commit nesse dia";
   sentences narrating requests to the assistant ("pedi para…"); coordination between
   conversations or worktrees; commit hashes; credentials; automatic dependency-update commits
   (at most one sentence inside a neighbouring entry); trivial commits ("test", renames of an
   empty file); conversations unrelated to the project (hardware, personal errands). A day
   whose effort is under 30 minutes gets no entry: mention its one small commit inside the
   nearest entry instead. A diary says what was done and learned; it is not a chat log.

   Synthesize título/resumo from the evidence gathered in step 6; **never transcribe raw prompt
   text into the diary.** Prompts can contain content the user would not want copied verbatim
   into a document they may hand to someone else. The `> Nota interna` block is the one place
   allowed to talk *about* the diary itself (methodology, caveats) — it must never appear in
   the rendered `.docx` (see step 12).

9. **Hours: the diaries of the `conjunto` must add up to `metaTotal`, and each day's value
   comes from audited effort, not from a stopwatch.** Run
   ```
   node ~/.claude/base_project/scripts/diary-hours.js --json <saida.json>
   ```
   It reads the profile (step 4) and prints, for each project of the set, the minutes of every
   date that gets an entry, and exits 0 only when the sum over the whole set is exactly
   `metaTotal`. Write its values verbatim as `HH:MM` (whole minutes). Like the renderer, this
   script lives only under `~/.claude/base_project/scripts/` and is not yet shipped by the
   installer; if it is missing on this machine, apply the method below by hand and verify the
   sums with a script. The method, so a human can audit it:
   - Effort per commit = 15 min + 0.1 min per changed line + 1.5 min per file with at least 10
     changed lines (at most 40 files), capped at 4h per commit; an automatic dependency bump is
     5 min; the same commit cherry-picked across branches counts once; lockfiles don't count.
   - Ledger floor: for each project and day, the active time with pauses up to 60 min, counting
     events whose folder *or* file path belongs to the project. The day's weight is the larger of
     the two numbers.
   - Daily limit: one person has at most 12h a day, so the weights of all projects (`conjunto`
     and `foraDoConjunto`) are scaled down together on a day that exceeds it.
   - Days under 30 minutes of weight get no entry (step 8). The calendar day is the local one.
   - A project in `auditado` mode keeps its weight in full, rounded to the minute. The single
     `ajuste` project receives what closes the total, split by the relative weight of its days
     (largest remainder, whole minutes). With no `ajuste` project everything is scaled
     proportionally. The script never inflates: when the audited total is below the target, or
     the `auditado` projects already pass it, it exits 2 with a warning — then **stop and ask
     the user**.
   - Why not the raw ledger: it exists only since 17/08/2026, it does not see Codex or sessions
     opened in other folders, and on one project it recorded 22h against about 98h of work
     visible in commits.

   Consequences to apply every run:
   - Adding a day to any project of the set moves the `ajuste` project's values, so **every
     already-existing entry's `Horas gastas na contribuição` line in every diary of the set must
     be rewritten from the script's output**, not only the new ones — never patch old values in
     place while leaving new ones computed differently.
   - If a day exists only because of administrative activity (generating the diary itself,
     scanning repositories), put it in the project's `ignorarDias` in the profile instead of
     writing an entry for it.
   - A project that is in neither list keeps the legacy rule: allocate whole hours so its total
     equals `horasAlvoPorProjeto` (default 112:00), weighting days by commits, files and
     narrative complexity, and say so in its `> Nota interna`.
   - State the method plainly in the `> Nota interna` block (step 8): the target, the mode of
     this project, the audited total before any scaling, and the dates that got no entry.
   - **Verify the arithmetic with a script, not by hand.** After writing the entries, parse
     every diary of the set and check that each project's sum equals the script's allocation
     and that the three sums together equal `metaTotal` (the one-liner in step 13).

10. **Rebuild the summary table from the full entry list every time**, never by incrementing a
    stored total — a table computed from scratch cannot drift out of sync with the entries above
    it:

    ```markdown
    ## Sumário das Contribuições

    | Data | Título | Horas |
    |---|---|---|
    | DD/MM/AAAA | ... | HH:MM |
    | | **TOTAL** | **HH:MM** |
    ```

    The TOTAL is this project's allocated total from `diary-hours.js` (step 9) — it can exceed
    99 hours, so write it as `HHH:MM` when needed — and the totals of the projects in the set
    add up to `metaTotal`.

11. **End `_source/<project>.md` with an `## Assinaturas` section** containing just a short
    note that it renders as a blank signature table in the `.docx` (aluno/orientador) — there is
    nothing to fill in on the Markdown side; this section exists so the rendered document always
    has the official signature block.

12. **Render `_source/<project>.md` to `<project>.docx`** using the checked-in renderer:
    ```
    node ~/.claude/base_project/scripts/diary-docx-render.js <dados.json> <diary-root>/<project>.docx
    ```
    Build `<dados.json>` from the parsed `_source/<project>.md` (see the schema documented at
    the top of `diary-docx-render.js` — it needs `projetoExtensao`, `orientador`, `matricula`,
    `nomeDiscente`, `dataInicio`, `projeto`, `descricao`, optional `paginaProjeto`,
    `repositorio`, `justificativa`, `totalHoras`, and the `dias[]` array with
    `data`/`titulo`/`resumo`/`horas`; paragraphs of `resumo` are separated by a blank line).
    **Never skip the `> Nota interna` block when building this JSON** — it is source-only and
    must not leak into any of the JSON fields that get rendered.

    This script is checked in (unlike the rest of this project's philosophy of writing small
    render scripts fresh each time) because the official template is precise enough — exact
    colors, borders, table shading — that reconstructing it from a text description every run
    risks drift between diaries. If `node ~/.claude/base_project/scripts/diary-docx-render.js`
    fails with `Cannot find module 'docx'`, run `npm install docx` inside
    `~/.claude/base_project/scripts/` once (it carries its own `package.json`) and retry —
    do not fall back to writing a one-off docx-js script instead; fix the dependency. If it
    fails with `EBUSY`/a locked-file error, the `.docx` is open in Word — check for unsaved
    changes on that document (e.g. via COM: `[Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")`)
    before closing it; never close a document with unsaved edits without telling the user first.

    Always regenerate the whole `.docx` from the whole current `.md` — never try to patch an
    existing `.docx`'s XML incrementally, which is far more failure-prone than a clean
    regenerate for a document this size.

13. **Verify the render before reporting success — a script that didn't throw is not proof the
    document is right.** Unzip the produced `.docx` and check `word/document.xml`: valid XML
    (`python -c "import xml.dom.minidom as m; m.parse('word/document.xml')"`), the count of
    `Contribuição do dia` occurrences matches the number of dated entries in the source, no
    leftover `**` markers. Then the arithmetic, from the JSON of every diary of the set:
    ```
    node -e "let all=0;for(const f of process.argv.slice(1)){const d=require(f);const t=d.dias.reduce((a,x)=>{const [h,m]=x.horas.split(':').map(Number);return a+h*60+m},0);all+=t;console.log(f,t,d.totalHoras)};console.log('conjunto',all)" <dados1.json> <dados2.json> ...
    ```
    confirm each project's minutes match `diary-hours.js` and that `conjunto` equals `metaTotal`
    converted to minutes — do not trust a hand-summed total. Also check the checkable claims of
    the text against git and the ledger (clock times against commit times, "N arquivos" against
    the commit's file count, line counts, version numbers, test counts); the first 21/10/2026
    pass of this check found a wrong line count (a lockfile had inflated it). If Word or
    LibreOffice (`soffice`) is available in this session, additionally convert to PDF and look
    at a page, or ask Word for the page count, to confirm the layout still matches the template
    — but their absence doesn't excuse skipping the XML-level and arithmetic checks, which need
    no extra tooling.

14. **Never write a diary file into the project being documented**, regardless of `$ARGUMENTS`.
    The only writable location is the resolved diary root from step 1.

15. Report only: which diaries were written or updated (`.docx` path), how many entries were
    added, the covered date range, each project's hours and the total of the set against
    `metaTotal` — not the entries themselves, the file has those.

$ARGUMENTS
