# Archived plan — GOALS 24 — Installer: Adjacent MCP Retirement Corrupts opencode.jsonc

> Status: completed; owner items I24.5 continue in root `GOALS.md` `## Owner backlog`. Archived from root `GOALS.md` on 2026-11-22.
> This body is a historical snapshot; keep it immutable and add future active work to root `GOALS.md`.

---

<a id="goals-24-installer-adjacent-mcp-retirement"></a>
## GOALS 24 — Installer: Adjacent MCP Retirement Corrupts opencode.jsonc (base_project fix)
Format: executor-v1

Grounded against commit `e39172d` on 2026-11-23. `dev/scripts/install-opencode.js` refuses to write `opencode.jsonc` when `mergeConfig` retires two or more adjacent `mcp` entries and the last of them is the last member of the object. This plan adds a regression test that fails today, then replaces the per-member removal with one function that removes a whole run of members. In every block below, remove the 4-space plan indent; all other leading spaces are part of the text.

### Decisions

- D1 Root cause: `removeMember` builds one edit per retired member. A member that has a following member removes the text from its own key to the next key. The last member removes the text from the previous member's value end to its own value end. When two retired members are adjacent and the second is last, the two edits overlap, `applyEdits` produces invalid JSON, and the safety check `parseJsonc(merged)` rejects it. Source: `dev/scripts/install-opencode.js` lines 211-220, reproduced on 2026-11-23.
- D2 Failing cases, measured on 2026-11-23: two retired members at the end of three; all members retired. Passing cases: two retired members at the start; one retired member anywhere; non-adjacent retired members. Source: `mergeConfig` run on in-memory fixtures with 2-space indentation.
- D3 The fix groups retired indexes into runs of consecutive members. A run followed by a kept member removes text from the run's first key to that kept member's key. A run at the end removes text from the previous kept member's value end to the run's last value end. Retiring every member empties the object. Why: one non-overlapping edit per run. The prototype passed all nine cases and the existing 11 tests. Source: prototype run on 2026-11-23.
- D4 Do not change `insertMembers`. When every member is retired and a server is added in the same run, the existing insert edit leaves a trailing comma, and `parseJsonc` accepts trailing commas. Source: prototype case "retire all and add alpha", 2026-11-23.
- D5 No user-visible behavior changes except the fix: the same entries are retired and the same text outside them is kept. Do not change `mcp-previous.json` or the state file logic.
- D6 Run this plan on a new branch from `origin/main`, because the branch `claude/project-assessment-improvements-94d239` already merged as PR #21. The branch name is `fix/opencode-adjacent-mcp-retirement`.
- D7 Impact record: on 2026-11-23 the installer printed "opencode.jsonc could not be parsed (Expected double-quoted property name ... line 15 column 17)" and left the file untouched, because the file ended with the entries `context7`, `filesystem`, `git`. The owner repaired the file by hand. This plan does not touch any file outside the repository.

| Stage | Items | Depends on | Can run in parallel with |
| --- | --- | --- | --- |
| 1 Repro and test | I24.1 | none | none |
| 2 Fix | I24.2 | I24.1 | none |
| 3 Docs and verification | I24.3, I24.4 | I24.2; I24.4 also needs I24.3 | none |
| 4 Release | I24.5 | I24.4 | none |
<!-- item-contract: v1 -->

### Repro and regression test

- [x] **I24.1 Add the regression test and prove it fails**
  - proof: check exit 0: new test fails, 11 others pass, only the test file changed, 2026-11-22, haiku
  - tier: light · medium
  - gate: notify
  - after: none
  - files: `dev/tests/install-opencode.test.js` (exists)
    - Files: `dev/tests/install-opencode.test.js` (exists). Anchor: the end of the file. Change: append Block 1. Do not touch: existing tests and helpers.
    - Verify: the check below → exit 0, which means the new test fails and every other test passes
    - Source: D1, D2.
  - do:
    1. Run `git fetch origin`.
    2. Run `git switch -c fix/opencode-adjacent-mcp-retirement origin/main`. Stop if the switch is refused.
    3. Run `npm ci`.
    4. Append Block 1 to the end of `dev/tests/install-opencode.test.js`.
    5. Run `npx biome check --write dev/tests/install-opencode.test.js`.
    6. Run the check below. Do not edit `dev/scripts/install-opencode.js` in this item.

    Block 1:
    `````javascript

    test("retiring adjacent MCP entries keeps the config valid", () => {
      const entry = (name) => [
        name,
        { type: "local", command: ["npx", "-y", name] },
      ];
      const cases = [
        { order: ["keep", "a", "b"], retired: ["a", "b"], left: ["keep"] },
        { order: ["a", "b", "keep"], retired: ["a", "b"], left: ["keep"] },
        { order: ["a", "keep", "b"], retired: ["a", "b"], left: ["keep"] },
        {
          order: ["k1", "a", "b", "k2", "c"],
          retired: ["a", "b", "c"],
          left: ["k1", "k2"],
        },
        { order: ["a", "b", "c"], retired: ["a", "b", "c"], left: [] },
      ];
      for (const { order, retired, left } of cases) {
        const mcp = Object.fromEntries(order.map(entry));
        for (const [indent, eol] of [
          [2, "\n"],
          [4, "\r\n"],
        ]) {
          const original = JSON.stringify({ mcp }, null, indent).replace(
            /\n/g,
            eol,
          );
          const result = merge(original, retired, {});
          assert.deepEqual(
            Object.keys(parseJsonc(result.text).mcp),
            left,
            order.join(","),
          );
          assert.deepEqual([...result.retired].sort(), [...retired].sort());
        }
      }
    });
    `````
  - check: `node -e "const r=require('child_process').spawnSync('node',['--test','dev/tests/install-opencode.test.js'],{encoding:'utf8'});const o=r.stdout+r.stderr;process.exit(r.status!==0&&/fail 1\b/.test(o)&&o.includes('retiring adjacent MCP entries')?0:1)"` → exit 0
  - stop-if: the switch to the new branch is refused, or the new test passes before the fix

### Fix

- [x] **I24.2 Replace removeMember with removeMembers**
  - proof: check exit 0: 23 tests pass, typecheck and biome clean, no removeMember( left, 2026-11-22, haiku
  - tier: light · medium
  - gate: auto
  - after: I24.1
  - files: `dev/scripts/install-opencode.js` (exists)
    - Files: `dev/scripts/install-opencode.js` (exists). Anchor: Pairs 1 and 2 below. Change: one function that removes whole runs of members, and its single call site. Do not touch: `insertMembers`, `applyEdits`, `scanObject`, and every other part of `mergeConfig`.
    - Verify: the check below → exit 0
    - Source: D3, D4, D5.
  - do:
    1. Edit `dev/scripts/install-opencode.js` with Pairs 1 and 2 below.
    2. Run `npx biome check --write dev/scripts/install-opencode.js`.
    3. Run `grep -c "removeMember(" dev/scripts/install-opencode.js`. Expect `0`.

    File `dev/scripts/install-opencode.js`. Replace each `old` text with its `new` text. Each `old` text occurs exactly once.

    Pair 1, old:
    `````text
    // Edit that deletes one member together with the comma that separates it.
    function removeMember(object, index) {
      const member = object.members[index];
      const next = object.members[index + 1];
      if (next) return { start: member.keyStart, end: next.keyStart, text: "" };
      const previous = object.members[index - 1];
      if (previous)
        return { start: previous.valueEnd, end: member.valueEnd, text: "" };
      return { start: object.open + 1, end: object.close, text: "" };
    }
    `````
    Pair 1, new:
    `````text
    // Edits that delete the members at `indexes` together with the commas that separate them.
    // Consecutive members are removed as one run, so no two edits overlap.
    function removeMembers(object, indexes) {
      const removed = new Set(indexes);
      if (object.members.every((_, index) => removed.has(index))) {
        return [{ start: object.open + 1, end: object.close, text: "" }];
      }
      const edits = [];
      let index = 0;
      while (index < object.members.length) {
        if (!removed.has(index)) {
          index += 1;
          continue;
        }
        let last = index;
        while (removed.has(last + 1)) last += 1;
        const next = object.members[last + 1];
        if (next) {
          edits.push({
            start: object.members[index].keyStart,
            end: next.keyStart,
            text: "",
          });
        } else {
          edits.push({
            start: object.members[index - 1].valueEnd,
            end: object.members[last].valueEnd,
            text: "",
          });
        }
        index = last + 1;
      }
      return edits;
    }
    `````

    Pair 2, old:
    `````text
        for (const name of retired) {
          const index = mcpObject.members.findIndex((entry) => entry.key === name);
          if (index !== -1) edits.push(removeMember(mcpObject, index));
        }
    `````
    Pair 2, new:
    `````text
        const retiredIndexes = retired
          .map((name) =>
            mcpObject.members.findIndex((entry) => entry.key === name),
          )
          .filter((index) => index !== -1);
        edits.push(...removeMembers(mcpObject, retiredIndexes));
    `````
  - check: `node --test dev/tests/install-opencode.test.js dev/tests/mcp-servers.test.js && npm run typecheck && npx biome check dev/scripts/install-opencode.js dev/tests/install-opencode.test.js && test "$(grep -c 'removeMember(' dev/scripts/install-opencode.js)" = 0` → exit 0
  - stop-if: an `old` text occurs zero times or more than once

### Verification and release

- [x] **I24.3 Record the fix in the changelog**
  - proof: check exit 0, one changelog bullet added under Unreleased, 2026-11-22, haiku
  - tier: light · low
  - gate: auto
  - after: I24.2
  - files: `README.md` (exists)
    - Files: `README.md` (exists). Anchor: Pair 1 below. Change: add one bullet at the top of "Unreleased". Do not touch: other bullets and releases.
    - Verify: the check below → exit 0
    - Source: D7.
  - do:
    1. Edit `README.md` with Pair 1 below.

    File `README.md`. Replace each `old` text with its `new` text. Each `old` text occurs exactly once.

    Pair 1, old:
    `````text
    ### Unreleased
    `````
    Pair 1, new:
    `````text
    ### Unreleased
    - Fixed: the installer no longer refuses to update `opencode.jsonc` when it retires two or more neighboring MCP entries, such as the old `filesystem` and `git` entries at the end of the list; before, it printed a parse error and left the file untouched
    `````
  - check: `node -e "const t=require('fs').readFileSync('README.md','utf8');process.exit(t.includes('### Unreleased\n- Fixed: the installer no longer refuses to update \x60opencode.jsonc\x60')?0:1)"` → exit 0
  - stop-if: an `old` text occurs zero times or more than once

- [x] **I24.4 Run the full local verification**
  - proof: verify, harness, structure and archive checks exit 0; 204 of 205 tests pass, 0 fail, 2026-11-22, none (run by the orchestrator)
  - tier: light · low
  - gate: auto
  - after: I24.3
  - files: none
    - Files: none. This item runs commands and edits nothing.
    - Verify: the check below → exit 0
    - Source: `package.json` scripts.
  - do:
    1. Run `npm run verify`.
    2. Run `npm run test:harness`.
    3. Run `node dev/scripts/validate-goals-structure.js GOALS.md`.
    4. Run `node dev/scripts/goals-archive-index.js --check`.
    5. Stop at the first command that exits non-zero, and report its output.
  - check: `npm run verify && npm run test:harness && node dev/scripts/validate-goals-structure.js GOALS.md && node dev/scripts/goals-archive-index.js --check` → exit 0
  - stop-if: any command exits non-zero

- I24.5 (owner items) moved unchanged to `## Owner backlog` in root `GOALS.md` on 2026-11-22.

### Explicitly out of scope

- Changing which MCP entries the installer retires, `mcp-previous.json`, or the state file.
- Repairing any user's `opencode.jsonc`. The owner's file was repaired by hand on 2026-11-23.
- The Claude Code `claude` binary, which fails to start on the owner's machine, and the Codex `config.toml` merge.

### Sources consulted

- `dev/scripts/install-opencode.js` (`removeMember`, `mergeConfig`, `applyEdits`) and `dev/tests/install-opencode.test.js` at commit `e39172d`, read on 2026-11-23.
- Reproduction and prototype runs on in-memory fixtures, 2026-11-23: before the fix 11 tests pass and the new test fails; with the prototype 12 tests pass.
- Installer output from the owner's machine on 2026-11-23, quoted in D7.
