// base_project:managed
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { buildBaseline } = require("../scripts/usage-baseline.js");
const { readLedger } = require("../scripts/diary-source.js");

// Above V8's spread-argument limit (~125-130k). /usagebp used to crash with
// "Maximum call stack size exceeded" here (dev/auditoria-2026-09-24.md, F5).
const EVENTS = 150_000;
const START = Date.parse("2026-05-01T09:00:00.000Z");

function syntheticEvents() {
  const events = [];
  for (let i = 0; i < EVENTS; i++) {
    const ts = new Date(START + i * 1000).toISOString();
    const promptId = `p${Math.floor(i / 25)}`;
    events.push(
      i % 25 === 0
        ? {
            ts,
            event: "UserPromptSubmit",
            session: "s1",
            prompt_id: promptId,
            cwd: "/proj",
            prompt: "run the tests",
          }
        : {
            ts,
            event: "PostToolUse",
            session: "s1",
            prompt_id: promptId,
            cwd: "/proj",
            tool: "Read",
            input: `{"file_path":"/proj/f${i % 40}.js"}`,
            ms: i % 900,
          },
    );
  }
  return events;
}

test("usage baseline handles a ledger larger than the spread-argument limit", () => {
  const baseline = buildBaseline({
    events: syntheticEvents(),
    invalidLines: 0,
    files: 1,
  });
  const ledger = baseline.sources.ledger;
  assert.equal(ledger.prompt_events + ledger.tool_events, EVENTS);
  assert.equal(ledger.date_start, new Date(START).toISOString());
  assert.equal(
    ledger.date_end,
    new Date(START + (EVENTS - 1) * 1000).toISOString(),
  );
});

test("the diary reader handles a single ledger file larger than the spread-argument limit", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bp-ledger-scale-"));
  try {
    const lines = syntheticEvents().map((event) => JSON.stringify(event));
    fs.writeFileSync(
      path.join(dir, "2026-05-01-s1.jsonl"),
      `${lines.join("\n")}\n`,
    );
    assert.equal(readLedger(dir).length, EVENTS);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
