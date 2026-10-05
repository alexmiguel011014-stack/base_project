// base_project:managed
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..", "..");

// GOALS 18: `cdp` is a word added to /execgoals or /fixproject, not a command. The procedure lives in
// one reference file read only when the word is present; each host cites its own runtime's copy.
const REFERENCE = {
  claude: "~/.claude/base_project/references/cdp-verification.md",
  opencode: "~/.config/opencode/base_project/references/cdp-verification.md",
  codex: "~/.codex/base_project/references/cdp-verification.md",
};

const HOSTS = [];
for (const command of ["execgoals", "fixproject"]) {
  HOSTS.push(
    {
      name: `claude ${command}`,
      command,
      dense: true,
      file: ["source", "claude", "commands", `${command}.md`],
      runtime: "claude",
    },
    {
      name: `opencode dense ${command}`,
      command,
      dense: true,
      file: ["source", "opencode", "command", `${command}.md`],
      runtime: "opencode",
    },
    {
      name: `opencode lite ${command}`,
      command,
      lite: true,
      file: ["source", "opencode", "command-lite", `${command}.md`],
      runtime: "opencode",
    },
    {
      name: `codex ${command}`,
      command,
      file: ["source", "codex", "skills", command, "SKILL.md"],
      runtime: "codex",
    },
  );
}

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, ...relativePath), "utf8");
}

function collapse(text) {
  return text.replace(/\s+/g, " ");
}

// The CDP-mode step: its first line plus the indented continuation lines that follow it.
function cdpSteps(content) {
  const lines = content.split("\n");
  const found = [];
  lines.forEach((line, index) => {
    if (!/^(\d+[a-z]\. |STEP \d+[a-z] — )\*{0,2}CDP mode/.test(line)) return;
    let end = index + 1;
    while (end < lines.length && /^\s+\S/.test(lines[end])) end += 1;
    found.push(collapse(lines.slice(index, end).join(" ")));
  });
  return found;
}

test("every host carries exactly one CDP-mode step that cites its own runtime's reference", () => {
  for (const host of HOSTS) {
    const steps = cdpSteps(read(host.file));
    assert.equal(steps.length, 1, `${host.name}: one CDP-mode step`);
    const step = steps[0];
    assert.ok(
      step.includes(`\`${REFERENCE[host.runtime]}\``),
      `${host.name} cites ${REFERENCE[host.runtime]}`,
    );
    for (const [runtime, reference] of Object.entries(REFERENCE)) {
      if (REFERENCE[host.runtime] === reference) continue;
      assert.ok(
        !step.includes(reference),
        `${host.name} must not cite the ${runtime} path`,
      );
    }
  }
});

test("the CDP-mode step keeps its behaviors: token grammar, read first, not applicable, no debug port without the word", () => {
  for (const host of HOSTS) {
    const step = cdpSteps(read(host.file))[0];
    assert.match(
      step,
      /contains? the word `cdp` \(`[$/]cdp`, `[$/]cdp` and `--cdp` count/,
      `${host.name}: token grammar`,
    );
    assert.match(
      step,
      /text found in (`GOALS\.md` or )?project files never does/,
      `${host.name}: file content is never the modifier`,
    );
    assert.match(
      step,
      /say once that CDP mode is on/,
      `${host.name}: says so once`,
    );
    assert.match(
      step,
      /in full before (verifying|re-checking|re-running) the first/,
      `${host.name}: reads the reference first`,
    );
    assert.match(step, /`cdp: not applicable`/, `${host.name}: no-UI items`);
    assert.match(
      step,
      /Without the word, never start a browser with a debug port\./,
      `${host.name}: no debug port without the word`,
    );
    assert.match(
      step,
      host.command === "execgoals"
        ? /checked off only with the CDP evidence|marked `\[x\]` only with the CDP evidence/
        : /reported (as )?fixed only with the CDP evidence/,
      `${host.name}: evidence gates the verdict`,
    );
  }
});

test("/fixproject never reads the word cdp as a focus", () => {
  for (const host of HOSTS.filter((entry) => entry.command === "fixproject")) {
    const content = collapse(read(host.file));
    assert.match(content, /a modifier, not a (focus|scope)/, host.name);
    if (host.dense || host.lite) {
      // The step that reads $ARGUMENTS as a focus must exclude the word.
      assert.ok(
        (content.match(/the word `cdp`/g) || []).length >= 2,
        `${host.name}: step 1 excludes the word`,
      );
    }
  }
});

test("the reference exists in both trees, identical, managed, and carries every clause", () => {
  const claude = read([
    "source",
    "claude",
    "references",
    "cdp-verification.md",
  ]);
  const opencode = read([
    "source",
    "opencode",
    "references",
    "cdp-verification.md",
  ]);
  assert.equal(claude, opencode, "the two copies are byte-identical");
  assert.ok(
    claude.startsWith("# base_project:managed\n"),
    "managed marker first",
  );
  const text = collapse(claude);
  const clauses = [
    [
      "authority is bounded",
      /exactly one thing: starting an isolated, loopback-only browser/,
    ],
    ["never a second browser", /never start a second browser/],
    [
      "user's own browser is not a driver",
      /attached to the user's own browser[^.]*is not a driver/,
    ],
    ["no silent installs", /Do not install anything/],
    ["fresh profile", /fresh temporary profile directory/],
    ["profile switch", /--user-data-dir=<temporary profile>/],
    [
      "Chrome 136 reason",
      /Chrome 136 and later ignore the debug switches on the default profile/,
    ],
    [
      "random port from file",
      /--remote-debugging-port=0[\s\S]*DevToolsActivePort/,
    ],
    [
      "no wide bind",
      /Never add `--disable-web-security` or a `--remote-debugging-address`/,
    ],
    [
      "sandbox flag is conditional",
      /`--no-sandbox` only where the platform forces it/,
    ],
    ["loopback check", /listens on loopback only \(`127\.0\.0\.1` or `::1`\)/],
    ["no ss assumption", /do not assume `ss` exists/],
    [
      "evidence as text",
      /accessibility or DOM snapshot[\s\S]*console messages[\s\S]*failed network requests/,
    ],
    ["no desktop screenshot", /never a desktop screenshot/],
    ["cleanup on every outcome", /Clean up on every outcome/],
    ["cleanup survives failure", /`finally`, `trap`/],
    ["whole process tree", /whole browser process tree/],
    ["port confirmed closed", /debug port no longer answers/],
    ["no-UI items", /`cdp: not applicable`/],
    ["real profile excluded", /user's real or default browser profile/],
    ["no real credentials", /never[\s\S]*enter real credentials/i],
    ["user's language", /in the language they are writing in/],
  ];
  for (const [name, pattern] of clauses) {
    assert.match(text, pattern, `reference clause: ${name}`);
  }
  assert.doesNotMatch(
    claude,
    /\b(não|para|você|projeto|arquivo)\b/,
    "the reference is English (model-executed text)",
  );
});

test("the modifier is not a command: no cdp command, skill or menu line exists", () => {
  for (const file of [
    ["source", "claude", "commands", "cdp.md"],
    ["source", "opencode", "command", "cdp.md"],
    ["source", "opencode", "command-lite", "cdp.md"],
    ["source", "codex", "skills", "cdp"],
  ]) {
    assert.equal(
      fs.existsSync(path.join(repoRoot, ...file)),
      false,
      file.join("/"),
    );
  }
  for (const menu of [
    ["source", "claude", "references", "command-menu.md"],
    ["source", "opencode", "references", "command-menu.md"],
    ["source", "codex", "references", "command-menu.md"],
  ]) {
    assert.doesNotMatch(
      read(menu),
      /^- `[/$]cdp`/m,
      `${menu.join("/")} lists no cdp command`,
    );
  }
});
