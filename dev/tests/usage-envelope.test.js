// base_project:managed
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { parseUsageReport } = require("../scripts/usage-envelope.js");
const {
  buildDiagnostics,
  buildBaseline,
  buildWorkflowAudit,
  compareBaselines,
  classifyError,
  commandName,
  classifyPrompt,
  parseLedgerText,
  readLedger,
} = require("../scripts/usage-baseline.js");

const repoRoot = path.resolve(__dirname, "..", "..");

const REPORT = `Claude Code usage report (2026-09-04T01:36:52.329Z)
Client: Mozilla/5.0 (Windows NT 10.0; Win64; x64) Claude/1.44121.4

Plan limits:

- session-0: 92% (resets 2026-09-04T02:10:00.148474+00:00)
- weekly_all-1: 65% (resets 2026-09-07T19:00:00.148499+00:00)

Session:

- Sonnet 5: 6.4k in / 1.8M out / 1.6B cache read / 16M cache write
- Cost: $16.89 | API 22m | Wall 38m

Local activity: 1762 requests (24h) | 5233 requests (7d)`;

test("normalizes the supplied Claude usage report", () => {
  const result = parseUsageReport(REPORT);

  assert.equal(result.schema_version, "usage-envelope/v1");
  assert.equal(result.source.authority, "user-provided");
  assert.equal(result.captured_at, "2026-09-04T01:36:52.329Z");
  assert.equal(result.plan_limits[0].used_percent.value, 92);
  assert.equal(
    result.plan_limits[0].resets_at.value,
    "2026-09-04T02:10:00.148Z",
  );
  assert.equal(result.sessions[0].model, "Sonnet 5");
  assert.equal(result.sessions[0].input_tokens.value, 6400);
  assert.equal(result.sessions[0].output_tokens.value, 1800000);
  assert.equal(result.sessions[0].cache_read_tokens.value, 1600000000);
  assert.equal(result.sessions[0].cache_write_tokens.value, 16000000);
  assert.equal(result.sessions[0].cost_usd.value, 16.89);
  assert.equal(result.sessions[0].cost_usd.status, "estimated");
  assert.equal(result.sessions[0].api_minutes.value, 22);
  assert.equal(result.sessions[0].wall_minutes.value, 38);
  assert.deepEqual(result.local_activity, [
    { window: "24h", requests: 1762 },
    { window: "7d", requests: 5233 },
  ]);
  assert.deepEqual(result.unknown_fields, []);
});

test("keeps omitted metrics explicitly unavailable instead of zero", () => {
  const result = parseUsageReport(
    "Claude Code usage report (2026-09-04T01:36:52.329Z)\nSession:\n- Sonnet 5: 2k out",
  );

  assert.equal(result.sessions[0].output_tokens.value, 2000);
  assert.equal(result.sessions[0].input_tokens.value, null);
  assert.equal(result.sessions[0].input_tokens.status, "unavailable");
  assert.equal(result.sessions[0].cost_usd.value, null);
  assert.equal(result.sessions[0].cost_usd.status, "unavailable");
  assert.ok(result.unknown_fields.includes("sessions[0].input_tokens"));
});

test("refuses credential-like material before producing an artifact", () => {
  assert.throws(
    () =>
      parseUsageReport(
        "Claude Code usage report (2026-09-04T01:36:52.329Z)\nAuthorization: Bearer abcdefghijk",
      ),
    /credential-like material/,
  );
});

test("installers expose the normalizer through the shared scripts directory", () => {
  const powershell = fs.readFileSync(
    path.join(repoRoot, "dev", "scripts", "install.ps1"),
    "utf8",
  );
  const shell = fs.readFileSync(
    path.join(repoRoot, "dev", "scripts", "install.sh"),
    "utf8",
  );
  assert.match(powershell, /["']usage-envelope\.js["']/);
  assert.match(powershell, /["']usage-baseline\.js["']/);
  assert.match(shell, /usage-envelope\.js/);
  assert.match(shell, /usage-baseline\.js/);
});

test("usagebp variants expose the same optional report input", () => {
  const files = [
    ["source", "claude", "commands", "usagebp.md"],
    ["source", "opencode", "command", "usagebp.md"],
    ["source", "opencode", "command-lite", "usagebp.md"],
    ["source", "codex", "skills", "usagebp", "SKILL.md"],
  ];
  for (const relative of files) {
    const content = fs.readFileSync(path.join(repoRoot, ...relative), "utf8");
    assert.match(content, /--usage-report <path>/);
    assert.match(content, /usage-envelope\.js/);
    assert.match(content, /usage-baseline\.js/);
    assert.match(content, /untrusted data/i);
    assert.match(content, /Claude Code and Codex/i);
    assert.match(content, /opencode/i);
    assert.match(content, /--compare <baseline\.json>/i);
    assert.match(content, /keep_intervention/i);
  }
});

test("usagebp works from source and installed layouts without touching the diary", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bp-usage-layout-"));
  const installedScripts = path.join(root, "claude", "base_project", "scripts");
  const ledgerDir = path.join(root, "claude", "base_project", "usage");
  const diaryPath = path.join(root, "diary-root.txt");
  const ledgerText = [
    JSON.stringify({
      event: "UserPromptSubmit",
      ts: "2026-09-04T01:00:00.000Z",
      prompt_id: "prompt-a",
      prompt: "/usagebp",
    }),
    JSON.stringify({
      event: "PostToolUse",
      ts: "2026-09-04T01:00:01.000Z",
      prompt_id: "prompt-a",
      tool: "Read",
      response: "ok",
      ms: 12,
    }),
  ].join("\n");

  try {
    fs.mkdirSync(installedScripts, { recursive: true });
    fs.mkdirSync(ledgerDir, { recursive: true });
    fs.copyFileSync(
      path.join(repoRoot, "dev", "scripts", "usage-envelope.js"),
      path.join(installedScripts, "usage-envelope.js"),
    );
    fs.copyFileSync(
      path.join(repoRoot, "dev", "scripts", "usage-baseline.js"),
      path.join(installedScripts, "usage-baseline.js"),
    );
    fs.writeFileSync(path.join(ledgerDir, "session.jsonl"), ledgerText, "utf8");
    fs.writeFileSync(diaryPath, "external diary sentinel\n", "utf8");

    const installedBaseline = require(
      path.join(installedScripts, "usage-baseline.js"),
    );
    const sourceResult = buildBaseline(readLedger(ledgerDir));
    const installedResult = installedBaseline.buildBaseline(
      installedBaseline.readLedger(ledgerDir.replaceAll("\\", "/")),
    );

    assert.deepEqual(installedResult.task_classes, sourceResult.task_classes);
    assert.deepEqual(installedResult.diagnostics, sourceResult.diagnostics);
    assert.equal(
      fs.readFileSync(diaryPath, "utf8"),
      "external diary sentinel\n",
    );
    assert.equal(
      fs.readFileSync(path.join(ledgerDir, "session.jsonl"), "utf8"),
      ledgerText,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("baseline groups command chains without exposing recorded payloads", () => {
  const events = [
    {
      event: "UserPromptSubmit",
      ts: "2026-09-04T01:00:00.000Z",
      session: "session-a",
      prompt_id: "prompt-a",
      prompt: "/newgoal plan",
    },
    {
      event: "PostToolUse",
      ts: "2026-09-04T01:00:01.000Z",
      session: "session-a",
      prompt_id: "prompt-a",
      tool: "Read",
      input: "SECRET_PAYLOAD_SHOULD_NOT_APPEAR",
      response: "ok",
      ms: 10,
    },
    {
      event: "PostToolUse",
      ts: "2026-09-04T01:00:02.000Z",
      session: "session-a",
      prompt_id: "prompt-a",
      tool: "Bash",
      input: "test",
      response: "expected failed check",
      ms: 20,
    },
    {
      event: "UserPromptSubmit",
      ts: "2026-09-04T01:05:00.000Z",
      session: "session-a",
      prompt_id: "prompt-b",
      prompt: "/repertoire research",
    },
    {
      event: "PostToolUse",
      ts: "2026-09-04T01:05:01.000Z",
      session: "session-a",
      prompt_id: "prompt-b",
      tool: "WebSearch",
      input: "research",
      response: "ok",
      ms: 30,
    },
  ];

  const result = buildBaseline({ events });
  assert.equal(classifyPrompt("/newgoal plan"), "planning");
  assert.equal(classifyPrompt("plain request"), "unclassified");
  assert.equal(result.sources.ledger.prompt_events, 2);
  assert.equal(result.sources.ledger.tool_events, 3);
  assert.equal(commandName("$execgoals run plan"), "execgoals");
  assert.equal(result.task_classes[0].task_class, "planning");
  assert.equal(result.task_classes[0].tool_calls_per_prompt, 2);
  assert.equal(result.task_classes[0].error_like_events, 1);
  assert.equal(result.task_classes[1].task_class, "research");
  assert.equal(result.task_classes[1].duration_ms.total, 30);
  assert.match(JSON.stringify(result), /unavailable/);
  assert.doesNotMatch(JSON.stringify(result), /SECRET_PAYLOAD/);
});

test("diagnostic queue prioritizes confirmed failures and keeps candidates separate", () => {
  const events = [
    {
      event: "UserPromptSubmit",
      ts: "2026-09-04T01:00:00.000Z",
      session: "session-a",
      prompt_id: "prompt-a",
      prompt: "/execgoals execute",
    },
    {
      event: "PostToolUse",
      ts: "2026-09-04T01:00:01.000Z",
      session: "session-a",
      prompt_id: "prompt-a",
      tool: "Bash",
      input: "SECRET_INPUT_MUST_NOT_APPEAR",
      response: "command failed: exit 1",
      ms: 10,
    },
    {
      event: "PostToolUse",
      ts: "2026-09-04T01:00:02.000Z",
      session: "session-a",
      prompt_id: "prompt-a",
      tool: "Bash",
      input: "network request timed out",
      response: "request timed out",
      ms: 20,
    },
    {
      event: "PostToolUse",
      ts: "2026-09-04T01:00:03.000Z",
      session: "session-a",
      prompt_id: "prompt-a",
      tool: "Read",
      input: "same-file",
      response: "SECRET_RESPONSE_MUST_NOT_APPEAR",
      ms: 5,
    },
    {
      event: "PostToolUse",
      ts: "2026-09-04T01:00:04.000Z",
      session: "session-a",
      prompt_id: "prompt-a",
      tool: "Read",
      input: "same-file",
      response: "ok",
      ms: 5,
    },
  ];

  const result = buildBaseline({ events, files: 1 });
  const queue = result.diagnostics.queue;

  assert.equal(queue[0].id, "genuine-task-failures");
  assert.equal(queue[0].status, "confirmed");
  assert.ok(queue.some((item) => item.id === "transient-failures"));
  assert.ok(queue.some((item) => item.id === "repeated-reads"));
  assert.ok(
    queue.every(
      (item, index) =>
        index === 0 || item.priority >= queue[index - 1].priority,
    ),
  );
  assert.equal(result.diagnostics.summary.confirmed, 1);
  assert.doesNotMatch(JSON.stringify(result.diagnostics), /SECRET_/);
});

test("diagnostic queue marks missing coverage unavailable", () => {
  const result = buildDiagnostics({ files: 2 });

  assert.equal(result.schema_version, "usage-diagnostics/v1");
  assert.equal(result.queue.length, 1);
  assert.equal(result.queue[0].id, "coverage-missing");
  assert.equal(result.queue[0].status, "unavailable");
  assert.equal(result.summary.unavailable, 1);
});

function comparisonFixture(overrides = {}) {
  return {
    schema_version: "usage-baseline/v1",
    comparison: {
      task_class: "short-fix",
      repository: "base_project",
      model: "Sonnet 5",
      effort: "high",
      ...overrides.comparison,
    },
    task_classes: [
      {
        task_class: "short-fix",
        tool_calls_per_prompt: overrides.tool_calls_per_prompt ?? 4,
        error_like_rate: overrides.error_like_rate ?? 0,
        duration_ms: {
          average_per_prompt: overrides.duration_ms ?? 100,
        },
      },
    ],
    sources: {
      usage_report: {
        sessions: [
          {
            output_tokens: { value: overrides.output_tokens ?? 1000 },
            cache_read_tokens: { value: overrides.cache_read_tokens ?? 500 },
            cache_write_tokens: { value: overrides.cache_write_tokens ?? 50 },
          },
        ],
        plan_limits: [
          { used_percent: { value: overrides.limit_used_percent ?? 20 } },
        ],
      },
    },
    quality_outcome: {
      requested_behavior: "pass",
      tests: "pass",
      regressions: 0,
      unnecessary_changes: 0,
      user_rework: 0,
      ...overrides.quality_outcome,
    },
  };
}

test("comparison harness keeps an intervention only with matched evidence", () => {
  const result = compareBaselines(
    comparisonFixture(),
    comparisonFixture({
      tool_calls_per_prompt: 2,
      duration_ms: 80,
      output_tokens: 800,
      limit_used_percent: 18,
    }),
  );

  assert.equal(result.schema_version, "usage-comparison/v1");
  assert.equal(result.comparability.status, "comparable");
  assert.equal(result.decision, "keep_intervention");
  assert.equal(result.metrics.tool_calls_per_prompt.delta, -2);
  assert.equal(result.metrics.duration_ms_per_prompt.delta, -20);
  assert.equal(result.metrics.output_tokens.intervention, 800);
  assert.equal(result.metrics.plan_limit_used_percent.delta, -2);
});

test("comparison harness refuses to decide on missing metadata or regressions", () => {
  const missing = compareBaselines(
    comparisonFixture({ comparison: { effort: undefined } }),
    comparisonFixture({ comparison: { effort: undefined } }),
  );
  assert.equal(missing.decision, "needs_review");
  assert.equal(missing.comparability.status, "not_comparable");

  const regression = compareBaselines(
    comparisonFixture(),
    comparisonFixture({ quality_outcome: { regressions: 1 } }),
  );
  assert.equal(regression.decision, "revert_or_review");
});

test("ledger parser counts malformed lines without losing valid neighbors", () => {
  const result = parseLedgerText(
    '{"event":"UserPromptSubmit","prompt":"/ship"}\nnot json\n{"event":"PostToolUse","tool":"Bash"}\n',
  );
  assert.equal(result.events.length, 2);
  assert.equal(result.invalidLines, 1);
});

test("classifies error-like output conservatively", () => {
  assert.equal(
    classifyError(
      { response: "expected failed error in negative test" },
      "run test",
    ),
    "expected_negative_test",
  );
  assert.equal(
    classifyError({ response: "request timed out" }, "research"),
    "transient_infrastructure",
  );
  assert.equal(
    classifyError({ response: "command failed: exit 1" }, "implementation"),
    "genuine_task_failure",
  );
  assert.equal(
    classifyError({ response: "Error: ambiguous result" }, "plain request"),
    "needs_review",
  );
  assert.equal(classifyError({ response: "ok" }, "plain request"), null);
});

test("audits workflow churn as candidates instead of conclusions", () => {
  const events = [
    {
      event: "UserPromptSubmit",
      ts: "2026-09-04T01:00:00.000Z",
      prompt_id: "a",
      prompt: "/newgoal plan",
    },
    {
      event: "UserPromptSubmit",
      ts: "2026-09-04T01:01:00.000Z",
      prompt_id: "b",
      prompt: "/execgoals execute",
    },
    {
      event: "PostToolUse",
      ts: "2026-09-04T01:01:01.000Z",
      prompt_id: "b",
      tool: "Read",
      input: "GOALS.md",
      response: "ok",
    },
    {
      event: "PostToolUse",
      ts: "2026-09-04T01:01:02.000Z",
      prompt_id: "b",
      tool: "Read",
      input: "GOALS.md",
      response: "ok",
    },
    {
      event: "UserPromptSubmit",
      ts: "2026-09-04T01:02:00.000Z",
      prompt_id: "c",
      prompt: "/ship",
    },
  ];
  const result = buildWorkflowAudit(events);
  assert.equal(result.complete_newgoal_execgoals_ship_cycles, 1);
  assert.equal(result.empty_prompt_chains, 2);
  assert.equal(result.repeated_read_calls, 1);
  assert.match(result.interpretation, /necessary/);
});

test("global instruction layers share the quality-per-token policy", () => {
  const files = [
    ["source", "CLAUDE.md"],
    ["source", "opencode-instructions.md"],
    ["source", "codex", "AGENTS.md"],
  ];
  for (const relative of files) {
    const content = fs.readFileSync(path.join(repoRoot, ...relative), "utf8");
    assert.match(content, /Optimize correctness per token/);
    assert.match(content, /Quality-per-token profiles/);
    assert.match(content, /Never impose a universal low-effort/);
  }
});
