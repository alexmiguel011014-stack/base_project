// base_project:managed
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  mergeConfig,
  parseJsonc,
  run,
} = require("../scripts/install-opencode.js");

const INSTRUCTIONS = "/repo/source/opencode-instructions.md";
const SERVERS = {
  alpha: { command: "npx", args: ["-y", "alpha-mcp"] },
  beta: { type: "remote", url: "https://beta.example/mcp" },
};
const ALPHA = { type: "local", command: ["npx", "-y", "alpha-mcp"] };
const BETA = { type: "remote", url: "https://beta.example/mcp" };

function merge(text, previouslyManaged = null, servers = SERVERS) {
  return mergeConfig(text, {
    instructionsPath: INSTRUCTIONS,
    servers,
    previouslyManaged,
  });
}

test("parseJsonc accepts comments, trailing commas and a BOM but keeps strings intact", () => {
  const parsed = parseJsonc(
    '\uFEFF{\n  // comment\n  "url": "http://x//y", /* block */\n  "list": ["a,}", "b",],\n}\n',
  );
  assert.deepEqual(parsed, { url: "http://x//y", list: ["a,}", "b"] });
});

test("a missing config is created with the schema, instructions and MCP servers", () => {
  const result = merge("");
  assert.equal(result.changed, true);
  assert.deepEqual(parseJsonc(result.text), {
    $schema: "https://opencode.ai/config.json",
    instructions: [INSTRUCTIONS],
    mcp: { alpha: ALPHA, beta: BETA },
  });
  assert.deepEqual(result.managed, ["alpha", "beta"]);
});

test("the user's own instructions, MCP servers and other keys survive the merge", () => {
  const original = JSON.stringify(
    {
      model: "anthropic/claude-sonnet-5",
      instructions: ["~/my-rules.md"],
      mcp: { "my-db": { type: "local", command: ["npx", "-y", "my-db-mcp"] } },
    },
    null,
    2,
  );
  const merged = parseJsonc(merge(original).text);
  assert.equal(merged.model, "anthropic/claude-sonnet-5");
  assert.deepEqual(merged.instructions, ["~/my-rules.md", INSTRUCTIONS]);
  // New entries are inserted at the top of the object (no trailing-comma surgery needed).
  assert.deepEqual(Object.keys(merged.mcp).sort(), ["alpha", "beta", "my-db"]);
  assert.deepEqual(merged.mcp["my-db"], {
    type: "local",
    command: ["npx", "-y", "my-db-mcp"],
  });
});

test("comments and formatting outside the edited values are preserved in a .jsonc file", () => {
  const original = [
    "{",
    "  // my theme",
    '  "$schema": "https://opencode.ai/config.json",',
    '  "theme": "tokyonight", /* inline note */',
    '  "mcp": {',
    "    // my database",
    '    "my-db": { "type": "local", "command": ["npx", "-y", "my-db-mcp"] },',
    "  },",
    "}",
    "",
  ].join("\n");
  const result = merge(original);
  for (const kept of [
    "// my theme",
    "/* inline note */",
    "// my database",
    '"my-db": { "type": "local", "command": ["npx", "-y", "my-db-mcp"] },',
  ]) {
    assert.ok(result.text.includes(kept), `lost: ${kept}`);
  }
  const merged = parseJsonc(result.text);
  assert.equal(merged.theme, "tokyonight");
  assert.deepEqual(merged.instructions, [INSTRUCTIONS]);
  assert.deepEqual(merged.mcp, {
    alpha: ALPHA,
    beta: BETA,
    "my-db": { type: "local", command: ["npx", "-y", "my-db-mcp"] },
  });
});

test("a second run with the same inputs changes nothing", () => {
  const first = merge('{\n  // keep me\n  "theme": "x"\n}\n');
  const second = merge(first.text, first.managed);
  assert.equal(second.changed, false);
  assert.equal(second.text, first.text);
});

test("an unparseable config is rejected instead of being reset", () => {
  assert.throws(() => merge('{ "theme": }'));
  assert.throws(() => merge("[1, 2]"), /top level is not a JSON object/);
});

test("only base_project's own servers are updated, and retired ones are removed", () => {
  const original = JSON.stringify(
    {
      mcp: {
        alpha: { type: "local", command: ["npx", "-y", "alpha-mcp@0.1"] },
        retired: { type: "local", command: ["npx", "-y", "old-mcp"] },
        beta: { type: "local", command: ["my-own-beta"] },
      },
    },
    null,
    2,
  );
  const result = merge(original, ["alpha", "retired"]);
  const merged = parseJsonc(result.text);
  assert.deepEqual(merged.mcp, {
    alpha: ALPHA,
    beta: { type: "local", command: ["my-own-beta"] },
  });
  assert.deepEqual(result.managed, ["alpha"]);
  assert.deepEqual(result.retired, ["retired"]);
  assert.match(result.warnings.join("\n"), /'beta' is your own definition/);
});

test("removing the first or the last MCP entry keeps the object valid", () => {
  for (const order of [
    ["retired", "keep"],
    ["keep", "retired"],
  ]) {
    const mcp = Object.fromEntries(
      order.map((name) => [name, { type: "local", command: [name] }]),
    );
    const result = merge(JSON.stringify({ mcp }, null, 2), ["retired"], {});
    assert.deepEqual(parseJsonc(result.text).mcp, {
      keep: { type: "local", command: ["keep"] },
    });
  }
});

test("an instructions path from a moved or renamed clone is replaced, not duplicated", () => {
  const original = JSON.stringify({
    instructions: [
      "~/mine.md",
      "C:\\old\\clone\\source\\opencode-instructions.md",
    ],
  });
  assert.deepEqual(parseJsonc(merge(original).text).instructions, [
    "~/mine.md",
    INSTRUCTIONS,
  ]);
});

test("the CLI merges the real catalog end to end and leaves unparseable files untouched", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bp-opencode-"));
  const opencodeHome = path.join(root, "opencode");
  const stateDir = path.join(root, "state");
  const args = ["--opencode-home", opencodeHome, "--state-dir", stateDir];
  const configPath = path.join(opencodeHome, "opencode.jsonc");
  const log = process.stdout.write;
  process.stdout.write = () => true;
  try {
    assert.equal(run(args), 0);
    const config = parseJsonc(fs.readFileSync(configPath, "utf8"));
    const shipped = Object.keys(
      JSON.parse(
        fs.readFileSync(
          path.join(__dirname, "..", "..", "source", "opencode", "mcp.json"),
          "utf8",
        ),
      ).mcpServers,
    );
    assert.deepEqual(Object.keys(config.mcp).sort(), [...shipped].sort());
    assert.match(config.instructions[0], /source\/opencode-instructions\.md$/);
    const state = JSON.parse(
      fs.readFileSync(path.join(stateDir, "opencode-managed-mcp.json"), "utf8"),
    );
    assert.deepEqual(state.servers, [...shipped].sort());

    const before = fs.readFileSync(configPath, "utf8");
    assert.equal(run(args), 0);
    assert.equal(fs.readFileSync(configPath, "utf8"), before);
    assert.equal(fs.existsSync(`${configPath}.bak`), false);

    fs.writeFileSync(configPath, '{ "theme": ', "utf8");
    assert.equal(run(args), 2);
    assert.equal(fs.readFileSync(configPath, "utf8"), '{ "theme": ');
  } finally {
    process.stdout.write = log;
    fs.rmSync(root, { recursive: true, force: true });
  }
});
