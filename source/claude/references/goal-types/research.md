# base_project:managed

Goal type: **Research** — the deliverable is a document (a report, a comparison, a
recommendation) that answers a specific question, not code.

## When this type applies

The ask is "figure out X and tell me" — investigate, compare options, produce a
recommendation — where the actual output the user wants is the answer, not a change to the
project. Not: the findings are meant to become an implementation plan next (that's `build.md`
or `feature.md` once the research is done and a decision is made) — this type only covers the
investigation-and-report step itself.

## Default owner

No `coder` — there's no code to write. Direct work (or `architect` for a genuinely large
research pass) producing the document. If the research is meant to feed a later build/feature
plan, that's a separate, later goal — don't collapse "research this" and "then build it" into
one item just because they're related; the done-when conditions are different (a document
exists and answers the question vs. code exists and passes).

## Areas

Question definition (state precisely what's being decided or answered — a vague research goal
produces a vague report), Source gathering (real, current sources — web search where the
question is time-sensitive, not assumption), Synthesis (the actual comparison/recommendation,
not just a pile of links), Deliverable (the concrete file/format the answer lands in).

## Done-when convention

The document exists, states an actual recommendation or answer (not just "here are the
options, you decide" unless the goal explicitly asked for a neutral survey), and cites real
sources — not done when research "happened" in conversation but nothing was written down.

## Ordering rule

Question definition always first — research done before the question is precise tends to
answer the wrong thing. Source gathering and synthesis can interleave; deliverable formatting
is always last.

## Worked example (drawn from this project's own history)

- [ ] Question: which improvements are plausible for `/newproject`, `/scanproject`,
  `/cleanproject`, `/fixproject`, `/wpp`, ranked by impact — done when: the question is this
  specific, not "make these better."
- [ ] Deliverable: `dev/relatorio-melhorias-comandos-2026.txt`, one section per command, each
  finding sourced — done when: the file exists, covers all five commands, and every claim
  traces to a real source, not invented plausibility.
