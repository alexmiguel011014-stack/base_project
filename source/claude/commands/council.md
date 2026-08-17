---
# base_project:managed
description: Pressure-test a decision through 5 independent advisor perspectives, then synthesize a verdict.
---

The user wants a hard decision or claim pressure-tested from multiple angles instead of a single-pass
opinion. Run a council.

0. **Always confirm before running — every time, no matter how this was invoked**: typed
   directly, combined with another command in the same message (e.g. `/newgoal /council`), or
   triggered from inside another command's own instructions (e.g. `/newgoal` step 4a). A council
   costs roughly 6x a single-pass answer (5 advisors + a synthesis pass) for a more
   pressure-tested result. Before step 1, ask the user plainly, in their own language, something
   equivalent to: "Running /council spends more tokens for a better result — do you really want
   to use it?" Wait for a clear yes before continuing. If the question looks simple or
   low-stakes, say so and suggest answering directly instead — being invoked is not by itself a
   reason to skip this judgment call.

1. Reframe the user's question/claim as a neutral, self-contained prompt — strip any of your own framing
   or lean toward an answer.

2. Produce 5 independent "advisor" passes over that neutral prompt, each committing to a distinct
   thinking style, reaching its own conclusion without seeing the others' output:
   - **The Skeptic** — actively looks for what's wrong, missing, or overly optimistic in the idea.
   - **The Pragmatist** — weighs cost, time, and maintenance burden over elegance.
   - **The Advocate** — argues from the perspective of whoever is most affected by the outcome.
   - **The Contrarian** — makes the strongest honest case for the opposite of the obvious answer.
   - **The Domain Expert** — applies the deepest technical/domain knowledge to the specifics at hand.

3. As a 6th pass ("the President"), read all 5 verdicts together, note where they agree and disagree, and
   synthesize one final recommendation — including what evidence would flip it if the vote is close.

4. Report: the President's verdict first, then a one-line summary of each advisor's stance.

$ARGUMENTS
