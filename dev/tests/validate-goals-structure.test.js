// base_project:managed
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { check } = require("../scripts/validate-goals-structure.js");
const { goalsFiles } = require("../../source/hooks/validate-goals.js");

const repoRoot = path.resolve(__dirname, "..", "..");

// Derived from dev/goals-archive/README.md's own table instead of a hand-maintained literal
// list — a hardcoded array here silently desyncs the moment /execgoals (or a human) archives
// a new plan, since nothing would remind you to also edit this file. See GOALS 12 / B.3+B.4.
function loadArchivedPlans() {
  const indexPath = path.join(repoRoot, "dev", "goals-archive", "README.md");
  const index = fs.readFileSync(indexPath, "utf8");
  const rows = [
    ...index.matchAll(
      /^\|\s*GOALS\s+(\d+)\s+—.*?\[([^\]]+\.md)\]\(\.\/[^)]+\)/gm,
    ),
  ];
  return rows.map((m) => [Number(m[1]), m[2]]);
}
const archivedPlans = loadArchivedPlans();

// Derived from GOALS.md's own "## Active plans" list (the `#goals-N-...` anchors) rather than
// a literal expected number — same rationale as archivedPlans above.
function loadActivePlanNumbers(goalsText) {
  const section = goalsText.match(/^## Active plans\n([\s\S]*?)\n##/m);
  const body = section ? section[1] : "";
  return [...body.matchAll(/#goals-(\d+)-/g)].map((m) => Number(m[1]));
}

function fixture(content) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "bp-goals-"));
  const file = path.join(directory, "GOALS.md");
  fs.writeFileSync(file, content, "utf8");
  return { directory, file };
}

test("validate-goals-structure rejects duplicate bold item IDs", () => {
  const item = fixture("- [ ] **A.1** first\n- [ ] **A.1** duplicate\n");
  try {
    const result = check(item.file);
    assert.equal(result.ok, false);
    assert.deepEqual(result.findings[0], {
      code: "duplicate_item_id",
      id: "A.1",
      line: 2,
      firstLine: 1,
      message: "Duplicate item ID **A.1** at line 2; first used at line 1.",
    });
  } finally {
    fs.rmSync(item.directory, { recursive: true, force: true });
  }
});

test("validate-goals-structure checks titled and plan-numbered item definitions", () => {
  const item = fixture(
    [
      "- [ ] **H.1 Titled item** (`coder`) — body",
      "- [x] **S16.1 First** step",
      "  - [ ] **S16.1 Second** duplicate, indented",
      "- [ ] **S16.10 Distinct** — not a prefix clash",
      "- [ ] **H.1** duplicate of the titled item",
    ].join("\n"),
  );
  try {
    const result = check(item.file);
    assert.equal(result.ok, false);
    assert.deepEqual(
      result.findings.map((finding) => [finding.id, finding.line]),
      [
        ["S16.1", 3],
        ["H.1", 5],
      ],
    );
  } finally {
    fs.rmSync(item.directory, { recursive: true, force: true });
  }
});

test("validate-goals-structure ignores item IDs mentioned in prose", () => {
  const item = fixture(
    [
      "- [ ] **R17.4 Validator** — a duplicated `**S16.1**` must be reported;",
      "  see **S16.1** and **R17.4** above, which are mentions, not definitions.",
      "- [ ] **S16.1 The only definition**",
    ].join("\n"),
  );
  try {
    assert.deepEqual(check(item.file), { ok: true, findings: [] });
  } finally {
    fs.rmSync(item.directory, { recursive: true, force: true });
  }
});

test("validate-goals-structure rejects an unclosed Mermaid fence", () => {
  const item = fixture("```mermaid\nflowchart TD\n  A --> B\n");
  try {
    const result = check(item.file);
    assert.equal(result.ok, false);
    assert.equal(result.findings[0].code, "unclosed_mermaid_fence");
    assert.equal(result.findings[0].line, 1);
  } finally {
    fs.rmSync(item.directory, { recursive: true, force: true });
  }
});

test("validate-goals-structure accepts a well-formed goal file", () => {
  const item = fixture(
    "# Goals\n\n```mermaid\nflowchart TD\n  A --> B\n```\n\n- [ ] **A.1** first\n- [x] **A.2a** second\n",
  );
  try {
    assert.deepEqual(check(item.file), { ok: true, findings: [] });
  } finally {
    fs.rmSync(item.directory, { recursive: true, force: true });
  }
});

test("active GOALS.md stays structurally valid and contains only executable plans", () => {
  const goalsPath = path.join(repoRoot, "GOALS.md");
  const goals = fs.readFileSync(goalsPath, "utf8");
  assert.deepEqual(check(goalsPath), { ok: true, findings: [] });
  const headingNumbers = [...goals.matchAll(/^## GOALS (\d+) —/gm)].map((m) =>
    Number(m[1]),
  );
  const activeNumbers = loadActivePlanNumbers(goals);
  assert.deepEqual(
    [...headingNumbers].sort((a, b) => a - b),
    [...activeNumbers].sort((a, b) => a - b),
  );
  for (const [number] of archivedPlans) {
    assert.doesNotMatch(goals, new RegExp(`^## GOALS ${number} —`, "m"));
  }
});

test("completed GOALS archive preserves navigable bodies and recorded checksums", () => {
  const archiveDir = path.join(repoRoot, "dev", "goals-archive");
  const index = fs.readFileSync(path.join(archiveDir, "README.md"), "utf8");
  for (const [number, file] of archivedPlans) {
    const archivePath = path.join(archiveDir, file);
    const body = fs.readFileSync(archivePath, "utf8");
    const hash = crypto
      .createHash("sha256")
      .update(fs.readFileSync(archivePath))
      .digest("hex");
    assert.match(body, new RegExp(`^## GOALS ${number} —`, "m"));
    assert.doesNotMatch(body, /^\s*- \[ \] \*\*[A-Z]\d*\./m);
    assert.ok(index.includes(`[${file}](./${file})`));
    assert.match(index, new RegExp(`\`${hash}\``));
  }
});

test("validate-goals hook finds Codex apply_patch GOALS.md targets", () => {
  assert.deepEqual(
    goalsFiles({
      cwd: "/workspace",
      tool_name: "apply_patch",
      tool_input: {
        command: "*** Begin Patch\n*** Update File: GOALS.md\n*** End Patch\n",
      },
    }),
    [path.resolve("/workspace", "GOALS.md")],
  );
});

test("validate-goals hook warns for a malformed GOALS.md without failing the edit", () => {
  const item = fixture("- [ ] **A.1** first\n- [ ] **A.1** duplicate\n");
  try {
    const hook = path.join(
      __dirname,
      "..",
      "..",
      "source",
      "hooks",
      "validate-goals.js",
    );
    const result = spawnSync(process.execPath, [hook], {
      encoding: "utf8",
      input: JSON.stringify({
        cwd: item.directory,
        tool_name: "Edit",
        tool_input: { file_path: "GOALS.md" },
      }),
    });
    assert.equal(result.status, 0);
    // stdout JSON is the channel the model actually receives; exit-0 stderr is debug-only.
    const output = JSON.parse(result.stdout);
    assert.equal(output.hookSpecificOutput.hookEventName, "PostToolUse");
    assert.match(
      output.hookSpecificOutput.additionalContext,
      /GOALS\.md structure warning/,
    );
    assert.match(
      output.hookSpecificOutput.additionalContext,
      /Duplicate item ID \*\*A\.1\*\*/,
    );
  } finally {
    fs.rmSync(item.directory, { recursive: true, force: true });
  }
});

test("validate-goals hook stays silent for a well-formed GOALS.md and for other files", () => {
  const item = fixture("- [ ] **A.1** first\n- [x] **A.2** second\n");
  const hook = path.join(
    __dirname,
    "..",
    "..",
    "source",
    "hooks",
    "validate-goals.js",
  );
  try {
    for (const filePath of ["GOALS.md", "README.md"]) {
      const result = spawnSync(process.execPath, [hook], {
        encoding: "utf8",
        input: JSON.stringify({
          cwd: item.directory,
          hook_event_name: "PostToolUse",
          tool_name: "Edit",
          tool_input: { file_path: filePath },
        }),
      });
      assert.equal(result.status, 0);
      assert.equal(result.stdout, "");
    }
  } finally {
    fs.rmSync(item.directory, { recursive: true, force: true });
  }
});
