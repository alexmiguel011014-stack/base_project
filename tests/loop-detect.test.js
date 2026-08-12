// base_project:managed
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const {
  signatureFor,
  checkAndUpdate,
  stateFilePath,
} = require("../source/hooks/loop-detect.js");

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
