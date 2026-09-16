// base_project:managed
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..", "..");

const SHARED_BLOCK = `### UI verification & screen control
- Verify behavior through the most precise channel first: the project's own tests and CLI output, direct HTTP/API calls, and logs; then app-driving tooling that drives the running app through its DOM/accessibility tree — typed inputs, form fills, element references, page text, console and network reads. That tooling is the default way to test a UI: drive the flow end to end with it before considering anything else.
- Screen control (desktop computer use: capturing the screen and clicking or typing by pixel coordinates, taking over the foreground) is a last resort, not a testing tool — it rarely produces a reliable result. Use it only when the target is a native app with no DOM, API, CLI, or test path, and only after stating why nothing else can reach it and getting the user's explicit go-ahead for that specific task in chat; never because it is available or looks quicker, and never as a fallback when the app-driving tooling reports a problem.
- Never take desktop screenshots on your own initiative. When a visual check is genuinely needed (layout, rendering, what the user actually sees), ask the user for a screenshot and say exactly which window, state, and viewport it should show; keep working from tests, DOM, text, and console evidence meanwhile. Page captures produced by the app-driving tooling itself are not screen control, but take them only when the check is visual by nature (a design review at several viewport widths) or the user asked for one — otherwise read the state as text.`;

const GLOBAL_RULE_FILES = [
  ["source", "CLAUDE.md"],
  ["source", "opencode-instructions.md"],
  ["source", "codex", "AGENTS.md"],
];

const REVIEWER_FILES = [
  ["source", "claude", "agents", "reviewer.md"],
  ["source", "opencode", "agent", "reviewer.md"],
  ["source", "codex", "agents", "reviewer.toml"],
];

const DESIGNREVIEW_FILES = [
  ["source", "claude", "commands", "designreview.md"],
  ["source", "opencode", "command", "designreview.md"],
  ["source", "opencode", "command-lite", "designreview.md"],
  ["source", "codex", "skills", "designreview", "SKILL.md"],
];

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, ...relativePath), "utf8");
}

// Whitespace-insensitive containment check: the shared clause is line-wrapped
// differently across the dense/lite/Codex variants, so hard-wrap position must
// not matter to this test.
function collapsedIncludes(content, needle) {
  return content.replace(/\s+/g, " ").includes(needle);
}

test("the shared UI-verification block is byte-identical across all three global rule files", () => {
  for (const relativePath of GLOBAL_RULE_FILES) {
    const content = read(relativePath);
    assert.equal(
      content.split(SHARED_BLOCK).length - 1,
      1,
      `${relativePath.join("/")} must contain the exact shared UI-verification block exactly once`,
    );
  }
});

test("the UI-verification section sits between Self-Correction and Task Sizing in every global rule file", () => {
  for (const relativePath of GLOBAL_RULE_FILES) {
    const content = read(relativePath);
    const selfCorrectionIdx = content.indexOf("### Self-Correction");
    const uiVerificationIdx = content.indexOf(
      "### UI verification & screen control",
    );
    const taskSizingIdx = content.search(/### Task Sizing/);
    assert.ok(
      selfCorrectionIdx >= 0 && uiVerificationIdx >= 0 && taskSizingIdx >= 0,
      `${relativePath.join("/")} is missing one of the three anchor headings`,
    );
    assert.ok(
      selfCorrectionIdx < uiVerificationIdx &&
        uiVerificationIdx < taskSizingIdx,
      `${relativePath.join("/")} must order Self-Correction -> UI verification -> Task Sizing`,
    );
  }
});

test("each runtime's rule file names its own app-driving and screen-control tooling", () => {
  const claude = read(["source", "CLAUDE.md"]);
  assert.match(claude, /computer-use/);
  assert.match(claude, /Browser pane/);
  assert.match(claude, /Claude in Chrome/);

  const opencode = read(["source", "opencode-instructions.md"]);
  assert.match(opencode, /Playwright MCP/);

  const codex = read(["source", "codex", "AGENTS.md"]);
  assert.match(codex, /@Browser/);
  assert.match(codex, /Computer Use/);
  assert.match(codex, /Browser extension/);
});

test("the human-in-the-loop tier in every global rule file names screen control", () => {
  for (const relativePath of GLOBAL_RULE_FILES) {
    const content = read(relativePath);
    assert.match(
      content,
      /human-in-the-loop[\s\S]{0,400}?screen control/,
      `${relativePath.join("/")} must list screen control in its human-in-the-loop tier`,
    );
  }
});

test("no reviewer definition accepts a bare screenshot as behavioral proof anymore", () => {
  for (const relativePath of REVIEWER_FILES) {
    const content = read(relativePath);
    assert.doesNotMatch(
      content,
      /a real command's output, a screenshot\)/,
      `${relativePath.join("/")} must not list a bare screenshot as proof`,
    );
    assert.match(
      content,
      /screenshot the user provided/,
      `${relativePath.join("/")} must require a user-provided screenshot, never one taken by screen control`,
    );
  }
});

test("every designreview variant scopes its capture step to browser tooling, never desktop screen control", () => {
  for (const relativePath of DESIGNREVIEW_FILES) {
    const content = read(relativePath);
    assert.ok(
      collapsedIncludes(content, "never desktop screen control"),
      `${relativePath.join("/")} must state its captures are never desktop screen control`,
    );
  }
});
