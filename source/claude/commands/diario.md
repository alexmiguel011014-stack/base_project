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
   incrementally the way a text file is. The user reads, hands over, and can manually edit the
   `.docx`; they never need to open the `.md` themselves, but a manual edit made directly in the
   `.docx` will be overwritten on the next `/diario` run for that project unless it's also
   reflected in `_source/<project>.md` — say so if the user reports having hand-edited a `.docx`.

4. **Resolve the shared student/advisor profile.** Read `~/.base_project/diario-perfil.json`:
   ```json
   { "nomeDiscente": "...", "matricula": "...", "orientador": "...", "horasAlvoPorProjeto": "112:00" }
   ```
   These four fields are the same across every project's diary (one student, one advisor, one
   agreed hour target) and must never be re-derived or guessed. If the file doesn't exist yet,
   **stop and ask the user** for all four values before writing anything — do not invent a name,
   matrícula, advisor, or hour target. Once given, write them to this file so future runs (for
   this or any other project) never have to ask again. If the user later reports a change
   (new advisor, corrected matrícula), update the file and mention which past diaries may now
   be stale in that one field.

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
   *narrative* (what was done, titles, summaries) and which calendar dates get an entry — it
   does **not** drive the hour value written into each entry; see step 9. A day with no commit
   and no real duration/file activity (a one-off question, a trivial "continuar") does not
   deserve its own entry — skip it rather than padding the diary with empty days.

7. **Read the existing `_source/<project>.md` first, and only append after its last recorded
   date.** Same rule `newgoal.md` step 6 applies to `GOALS.md` — never overwrite, never rewrite
   history already written. Re-running for a range already recorded must change nothing except
   the hour rebalancing described in step 9. Pass the last recorded date as `--since` so the
   script doesn't re-report what's already in the file. If `_source/<project>.md` doesn't exist
   yet but `<project>.docx` does (a diary from before this command tracked a Markdown source),
   treat it as a fresh start — read the `.docx` for a human to reconcile manually rather than
   trying to parse Word XML back into the source format.

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

   **Resumo da contribuição**: <parágrafo em primeira pessoa: o que foi feito, por quê, quais
   decisões foram tomadas e o que deu errado no caminho — um diário que só lista arquivos
   alterados não vale a leitura>

   **Horas gastas na contribuição**: HH:MM
   ```

   Synthesize título/resumo from the evidence gathered in step 6; **never transcribe raw prompt
   text into the diary.** Prompts can contain content the user would not want copied verbatim
   into a document they may hand to someone else. Describe what was worked on, don't quote the
   conversation. The `> Nota interna` block is the one place allowed to talk *about* the diary
   itself (methodology, caveats) — it must never appear in the rendered `.docx` (see step 11).

9. **The hour value in every entry must make the project's total equal
   `horasAlvoPorProjeto` from the shared profile (default 112:00) — independently, per
   project.** This is a deliberate, professor-agreed departure from "never invent": the
   ledger/commit evidence decides *which dates* get an entry and *how they compare in relative
   effort* (a 20-commit day is not worth the same as a 3-line-fix day), but the actual `HH:MM`
   values are allocated, not measured, so that they sum exactly to the target.

   - Rebuild the allocation from scratch every time entries are added or the target changes —
     never patch old hour values in place while leaving new ones measured differently, which
     would make the per-day numbers incomparable within the same diary. **This means editing
     every already-existing entry's `Horas gastas na contribuição` line, not just adding new
     ones** — a run that appends new days without touching old values will not sum to the
     target, and this is the single most common way this step goes wrong.
   - Weight days by the real signal available (commit count, files touched, ledger active
     duration where it exists, narrative complexity) — a busier day should still read as a
     bigger number than a quiet one, even though neither is a literal clock reading.
   - Keep individual days inside a plausible range (roughly 4-15h) whenever there are enough
     recorded dates to spread the target across — do not default to a flat even split, and
     avoid a single day absorbing the whole target unless there is truly only one date on
     record.
   - **Exception, and only while it lasts:** a project with too few recorded dates to spread the
     target plausibly (e.g. 3 dates for 112h) may temporarily carry implausibly large per-day
     values — document this explicitly in that project's `> Nota interna` block, per the
     user's own decision on 31/08/2026 for `MGGP_Vmatlab`. The very next time `/diario` runs for
     that project and finds more recorded dates, it must re-spread the same target across the
     now-larger set of dates and shrink the per-day values back toward the normal range — this
     is not optional cleanup, it is the whole point of allowing the exception temporarily.
   - Round to whole hours (`HH:00`) unless the project's existing entries already use finer
     granularity — match whatever precedent that specific diary has already set.
   - State the allocation method plainly in the `> Nota interna` block (step 8) so a future
     `/diario` run — or a human — can tell how the numbers were derived without re-deriving them
     from scratch.
   - **Verify the arithmetic with a script, not by hand.** Before writing the `.md` or `.docx`,
     sum every `dias[].horas` value programmatically (see the one-liner in step 13) and confirm
     it equals `horasAlvoPorProjeto` exactly — not "close enough", not off by one rounding step
     on a single leftover entry. Do this **after** editing the old entries too, since a
     forgotten old value is the most likely place a silent drift hides.

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

    The TOTAL must equal `horasAlvoPorProjeto` (step 9) except for the documented, temporary
    exception case.

11. **End `_source/<project>.md` with an `## Assinaturas` section** containing just a short
    note that it renders as a blank signature table in the `.docx` (aluno/orientador) — there is
    nothing to fill in on the Markdown side; this section exists so the rendered document always
    has the official signature block.

12. **Render `_source/<project>.md` to `<project>.docx`** using the checked-in renderer:
    ```
    node ~/.claude/base_project/scripts/diary-docx-render.js <dados.json> <project-root>/<project>.docx
    ```
    Build `<dados.json>` from the parsed `_source/<project>.md` (see the schema documented at
    the top of `diary-docx-render.js` — it needs `projetoExtensao`, `orientador`, `matricula`,
    `nomeDiscente`, `dataInicio`, `projeto`, `descricao`, optional `paginaProjeto`,
    `repositorio`, `justificativa`, `totalHoras`, and the `dias[]` array with
    `data`/`titulo`/`resumo`/`horas`). **Never skip the `> Nota interna` block when building
    this JSON** — it is source-only and must not leak into any of the JSON fields that get
    rendered.

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
    leftover `**` markers, and the hour total is exactly right:
    ```
    node -e "const d=require('<dados.json>'); const t=d.dias.reduce((a,x)=>{const [h,m]=x.horas.split(':').map(Number);return a+h*60+m},0); console.log(t, d.totalHoras)"
    ```
    confirm the printed total in minutes matches `horasAlvoPorProjeto` converted to minutes
    (or documents why not, per the step 9 exception) — do not trust a hand-summed total. If
    Word or LibreOffice (`soffice`) is available in this session, additionally convert to PDF
    and look at a page to confirm the visual layout still matches the template — but their
    absence doesn't excuse skipping the XML-level and arithmetic checks, which need no extra
    tooling.

14. **Never write a diary file into the project being documented**, regardless of `$ARGUMENTS`.
    The only writable location is the resolved diary root from step 1.

15. Report only: which diaries were written or updated (`.docx` path), how many entries were
    added, the covered date range, and the current total hours — not the entries themselves, the
    file has those.

$ARGUMENTS
