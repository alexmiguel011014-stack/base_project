// base_project:managed
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const {
  entryFor,
  installEntryFrom,
  ledgerFile,
  redact,
  truncate,
} = require("../../source/hooks/usage-log.js");

// Payload shapes below are copied from real PostToolUse payloads captured on this
// machine, not invented — including the detail the whole reader depends on: outside a
// subagent, agent_type/agent_id are ABSENT, not null.
const MAIN_THREAD = {
  hook_event_name: "PostToolUse",
  session_id: "sess-1",
  prompt_id: "prompt-1",
  cwd: "C:\\proj",
  tool_name: "Bash",
  tool_input: { command: "semgrep --config auto" },
  tool_response: { stdout: "ok" },
  duration_ms: 42,
};

const SUBAGENT = {
  ...MAIN_THREAD,
  agent_type: "Explore",
  agent_id: "a0ba4fd79064806a2",
};

test("main-thread call records null agent, subagent call records its name", () => {
  assert.equal(entryFor(MAIN_THREAD).agent_type, null);
  assert.equal(entryFor(MAIN_THREAD).agent_id, null);
  assert.equal(entryFor(SUBAGENT).agent_type, "Explore");
  assert.equal(entryFor(SUBAGENT).agent_id, "a0ba4fd79064806a2");
});

test("tool entry keeps the fields /usagebp reports on", () => {
  const entry = entryFor(MAIN_THREAD);
  assert.equal(entry.event, "PostToolUse");
  assert.equal(entry.tool, "Bash");
  assert.equal(entry.cwd, "C:\\proj");
  assert.equal(entry.prompt_id, "prompt-1");
  assert.equal(entry.ms, 42);
  // The command must survive into the ledger - it is the only way to attribute a
  // CLI tool, since only MCP tools identify themselves through tool_name.
  assert.ok(entry.input.includes("semgrep"));
});

test("prompt event records the prompt instead of tool fields", () => {
  const entry = entryFor({
    hook_event_name: "UserPromptSubmit",
    session_id: "sess-1",
    prompt_id: "prompt-1",
    cwd: "C:\\proj",
    prompt: "/fixproject",
  });
  assert.equal(entry.event, "UserPromptSubmit");
  assert.equal(entry.prompt, "/fixproject");
  assert.equal(entry.tool, undefined);
});

test("oversized input is truncated so one Write can't bloat the ledger", () => {
  const entry = entryFor({
    ...MAIN_THREAD,
    tool_input: { content: "x".repeat(5000) },
  });
  assert.ok(entry.input.length <= 300);
});

test("truncate survives circular input instead of throwing", () => {
  const circular = {};
  circular.self = circular;
  assert.equal(truncate(circular, 100), null);
});

test("every entry is a single line, so one bad write can't corrupt its neighbours", () => {
  const line = JSON.stringify(entryFor(MAIN_THREAD));
  assert.ok(!line.includes("\n"));
});

test("install mode records origin, which is the only signal for non-catalog entries", () => {
  const entry = installEntryFrom([
    "--install",
    "semgrep",
    "--kind",
    "cli",
    "--origin",
    "discovery",
  ]);
  assert.equal(entry.event, "install");
  assert.equal(entry.id, "semgrep");
  assert.equal(entry.kind, "cli");
  assert.equal(entry.origin, "discovery");
});

test("install mode is off unless --install carries a value", () => {
  assert.equal(installEntryFrom([]), null);
  // a bare trailing --install must not record an entry with a null id
  assert.equal(installEntryFrom(["--install"]), null);
  // and must not swallow the next flag as if it were the id
  assert.equal(installEntryFrom(["--kind", "cli"]), null);
});

test("ledger file is per session and per day, which is what removes write contention", () => {
  const a = ledgerFile("sess-1");
  const b = ledgerFile("sess-2");
  assert.notEqual(a, b);
  assert.ok(path.basename(a).endsWith(".jsonl"));
  assert.ok(path.basename(a).includes("sess-1"));
  // path separators in a session id must never escape the ledger directory
  assert.equal(path.dirname(ledgerFile("../../evil")), path.dirname(a));
});

test("redact masks well-known secret shapes before anything reaches the ledger", () => {
  const cases = [
    [
      "export ANTHROPIC_API_KEY=sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123",
      "export ANTHROPIC_API_KEY=[REDACTED]",
    ],
    [
      '{"command":"curl -H \\"Authorization: Bearer abc.def-123\\" https://api.example.com"}',
      '{"command":"curl -H \\"Authorization: Bearer [REDACTED]\\" https://api.example.com"}',
    ],
    ['{"password":"hunter2hunter2"}', '{"password":"[REDACTED]"}'],
    [
      "git push https://ghp_abcdefghijklmnopqrstuvwxyz0123456789@github.com/x/y",
      "git push https://[REDACTED]@github.com/x/y",
    ],
    [
      "psql postgres://app:s3cr3t@db.internal/prod --password=other",
      "psql postgres://app:[REDACTED]@db.internal/prod --password=[REDACTED]",
    ],
    ["key AKIAIOSFODNN7EXAMPLE end", "key [REDACTED] end"],
    [
      "-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaA\n-----END OPENSSH PRIVATE KEY-----",
      "[REDACTED PRIVATE KEY]",
    ],
  ];
  for (const [input, expected] of cases) assert.equal(redact(input), expected);
});

test("redact leaves file paths and ordinary commands untouched", () => {
  for (const text of [
    '{"file_path":"/proj/src/token-utils.js"}',
    '{"command":"npm test -- --watch=false"}',
    '{"command":"git commit -m \\"fix tokenizer edge case\\""}',
    "C:\\\\proj\\\\secrets\\\\README.md",
  ]) {
    assert.equal(redact(text), text);
  }
});

test("entryFor redacts prompts and tool input before truncating them", () => {
  const prompt = entryFor({
    hook_event_name: "UserPromptSubmit",
    prompt: "use token=abcdef123456 please",
  });
  assert.equal(prompt.prompt, "use token=[REDACTED] please");
  const tool = entryFor({
    hook_event_name: "PostToolUse",
    tool_name: "Bash",
    tool_input: {
      command: `${"x".repeat(280)} API_KEY=sk-abcdefghijklmnopqrstuvwx`,
    },
  });
  assert.ok(!tool.input.includes("sk-abcdef"));
});
