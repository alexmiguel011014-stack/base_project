# base_project:managed

AI-facing writing standard, paraphrased from ASD-STE100 (Simplified Technical English).
Read it before you write or edit text that an agent follows: commands, skills, agents, global
rule blocks, references, and executor-v1 plans in `GOALS.md`.
It does not apply to text a person reads: README, ARCHITECTURE, command menus, diaries, chat replies.

## A. Text an agent follows (English)

1. Write one instruction per sentence. Start the sentence with its verb: Run, Read, Write, Ask, Stop.
2. Keep a step sentence at 20 words or fewer. Keep a description sentence at 25 words or fewer.
3. Write each condition on its own line: `If <condition>: <action>.` Write the other case on its own line.
4. Use the terms in the glossary. Do not use their synonyms.
5. Use `must` and `do not` for rules. Do not use `should`, `may`, or `try to` in a step.
6. Do not put an aside in dashes or parentheses inside a step. Write a new sentence.
7. Name exact things: file paths, commands, IDs, numbers. Do not write "the file" or "as above".
8. Write each stop condition as `Stop if <condition>.` Then say what to report.
9. Keep the reason out of the step. If the reason changes what the agent does, add one `Why:` line.
10. Do not repeat a rule that a global rule block already states. Name its section instead.
11. Write an example only when the step fails without it. Start it with `Example:`.
12. Use numbered steps for an order. Use bullets for items without an order.

## B. Glossary: one word, one meaning

| Use | Meaning | Do not use for this meaning |
| --- | --- | --- |
| check | test a fact with evidence: a command result or a file read | verify, ensure, make sure, double-check, confirm |
| ask | request a decision from the user, then wait | prompt the user, check with the user |
| confirm | the user approves; only the user confirms | the agent confirms |
| stop | end the current command and report | abort, halt, bail out |
| run | start a command or a script | execute, invoke |
| item | one checkbox in `GOALS.md` | task, todo, ticket |
| plan | one `GOALS N` section | goal, roadmap |
| executor | the subagent that runs one item | worker, helper |
| blocked | cannot continue without a decision or an input | stuck |

## C. Text the user reads (the user's language)

1. Put the answer, the decision, or the result in the first sentence. Then give the evidence.
2. Use short sentences of about 15 words. Use active voice. Give one fact per sentence.
3. Report work status with three words: done, blocked (with the reason), next.
4. Do not hedge. Do not restate the question. Do not narrate tool calls.
5. Give more depth when the user asks for it or the task needs it.
6. Never shorten code, numbers, file paths, or negations.

Answer the user in the user's language, even though this file is English.
