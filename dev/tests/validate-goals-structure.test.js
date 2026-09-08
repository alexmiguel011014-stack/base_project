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
    assert.doesNotMatch(body, /^- \[ \] \*\*[A-Z]\./m);
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
    assert.match(result.stderr, /GOALS\.md structure warning/);
    assert.match(result.stderr, /Duplicate item ID \*\*A\.1\*\*/);
  } finally {
    fs.rmSync(item.directory, { recursive: true, force: true });
  }
});
