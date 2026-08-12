#!/usr/bin/env node
// base_project:managed
// PostToolUse hook: warns (stderr only, never blocks) when the same tool is
// called with the same input 5 times in a row within one session. This is
// the exact pattern that preceded a real data-loss accident in base_project's
// own development (a `git checkout --` repeated after formatter re-runs) —
// a human re-running the identical command without changing anything is a
// strong signal something is stuck, not that the approach is working.
//
// State lives in a small per-session file under os.tmpdir(), keyed by
// session_id, so it doesn't touch ~/.base_project/ and cleans up naturally
// (OS temp dir, not persisted long-term). Must never fail or block the tool
// call it's attached to — any error here is swallowed.

const fs = require("fs");
const os = require("os");
const path = require("path");

const REPEAT_THRESHOLD = 5;

function stateFilePath(sessionId) {
  const safe = String(sessionId || "unknown").replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(os.tmpdir(), `base_project-loop-${safe}.json`);
}

function signatureFor(toolName, toolInput) {
  try {
    return `${toolName}:${JSON.stringify(toolInput)}`;
  } catch {
    return `${toolName}:unserializable`;
  }
}

function checkAndUpdate(sessionId, toolName, toolInput) {
  const file = stateFilePath(sessionId);
  const sig = signatureFor(toolName, toolInput);
  let state = { sig: null, count: 0 };
  try {
    state = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    // no state yet — first call this session, or file unreadable
  }
  if (state.sig === sig) {
    state.count += 1;
  } else {
    state = { sig, count: 1 };
  }
  try {
    fs.writeFileSync(file, JSON.stringify(state), "utf8");
  } catch {
    // best-effort — a failed write just means detection resets next call
  }
  return state.count;
}

function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", () => resolve(data));
    setTimeout(() => resolve(data), 500);
  });
}

async function main() {
  try {
    const raw = await readStdin();
    const input = raw ? JSON.parse(raw) : {};
    const toolName = input.tool_name || null;
    if (toolName) {
      const count = checkAndUpdate(
        input.session_id || null,
        toolName,
        input.tool_input || null,
      );
      if (count >= REPEAT_THRESHOLD) {
        process.stderr.write(
          `[base_project] Same ${toolName} call repeated ${count}x in a row with identical input — ` +
            `if this isn't intentional (e.g. retrying a flaky command), it usually means the current ` +
            `approach is stuck. Consider stopping to reconsider instead of trying again.\n`,
        );
      }
    }
  } catch {
    // Loop detection must never break the tool call/turn it's attached to.
  }
  process.exit(0);
}

if (require.main === module) {
  main();
}

module.exports = { signatureFor, checkAndUpdate, stateFilePath };
