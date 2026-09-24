// base_project:managed
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const {
  signatureFor,
  checkAndUpdate,
  stateFilePath,
  warningFor,
} = require("../../source/hooks/loop-detect.js");

function cleanup(sessionId) {
  try {
    fs.unlinkSync(stateFilePath(sessionId));
  } catch {
    // fine if it never existed
  }
}

test("signatureFor is stable for identical tool+input, differs otherwise", () => {
  const a = signatureFor("Bash", { command: "git status" });
  const b = signatureFor("Bash", { command: "git status" });
  const c = signatureFor("Bash", { command: "git log" });
  assert.equal(a, b);
  assert.notEqual(a, c);
});

test("checkAndUpdate counts consecutive identical calls, resets on a different one", () => {
  const session = `test-${Date.now()}-a`;
  cleanup(session);
  try {
    assert.equal(checkAndUpdate(session, "Bash", { command: "x" }), 1);
    assert.equal(checkAndUpdate(session, "Bash", { command: "x" }), 2);
    assert.equal(checkAndUpdate(session, "Bash", { command: "x" }), 3);
    // different input resets the streak
    assert.equal(checkAndUpdate(session, "Bash", { command: "y" }), 1);
    assert.equal(checkAndUpdate(session, "Bash", { command: "y" }), 2);
  } finally {
    cleanup(session);
  }
});

test("checkAndUpdate reaches the repeat threshold on the 5th identical call", () => {
  const session = `test-${Date.now()}-b`;
  cleanup(session);
  try {
    let count = 0;
    for (let i = 0; i < 5; i++) {
      count = checkAndUpdate(session, "Edit", { file_path: "x.js" });
    }
    assert.equal(count, 5);
  } finally {
    cleanup(session);
  }
});

test("checkAndUpdate isolates state per session_id", () => {
  const sessionA = `test-${Date.now()}-c1`;
  const sessionB = `test-${Date.now()}-c2`;
  cleanup(sessionA);
  cleanup(sessionB);
  try {
    checkAndUpdate(sessionA, "Bash", { command: "same" });
    checkAndUpdate(sessionA, "Bash", { command: "same" });
    const countB = checkAndUpdate(sessionB, "Bash", { command: "same" });
    assert.equal(countB, 1);
  } finally {
    cleanup(sessionA);
    cleanup(sessionB);
  }
});

test("warningFor stays silent below the threshold and names the tool at it", () => {
  assert.equal(warningFor("Bash", 4), null);
  assert.match(warningFor("Bash", 5), /Same Bash call repeated 5x/);
});

test("the hook hands the warning to the model as additionalContext on the 5th identical call", () => {
  const session = `test-${Date.now()}-e2e`;
  cleanup(session);
  const hook = path.join(
    __dirname,
    "..",
    "..",
    "source",
    "hooks",
    "loop-detect.js",
  );
  const payload = JSON.stringify({
    session_id: session,
    hook_event_name: "PostToolUse",
    tool_name: "Bash",
    tool_input: { command: "npm test" },
  });
  try {
    const runs = Array.from({ length: 5 }, () =>
      spawnSync(process.execPath, [hook], { encoding: "utf8", input: payload }),
    );
    for (const run of runs) assert.equal(run.status, 0);
    for (const run of runs.slice(0, 4)) assert.equal(run.stdout, "");
    // stdout JSON is what Claude Code and Codex pass to the model; exit-0 stderr is debug-only.
    const output = JSON.parse(runs[4].stdout);
    assert.equal(output.hookSpecificOutput.hookEventName, "PostToolUse");
    assert.match(
      output.hookSpecificOutput.additionalContext,
      /repeated 5x in a row/,
    );
  } finally {
    cleanup(session);
  }
});
