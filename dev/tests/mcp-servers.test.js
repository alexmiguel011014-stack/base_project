// base_project:managed
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const {
  CODEX_HEADER,
  claudeRetirements,
  codexBlock,
  loadCurrent,
  loadPrevious,
  mergeCodexConfig,
} = require("../scripts/mcp-servers.js");

const repoRoot = path.resolve(__dirname, "..", "..");

const pinned = {
  context7: { command: "npx", args: ["-y", "@upstash/context7-mcp@4.1.1"] },
};
const previous = {
  context7: [{ command: "npx", args: ["-y", "@upstash/context7-mcp"] }],
  filesystem: [
    {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem", "."],
    },
  ],
  git: [{ command: "npx", args: ["-y", "mcp-git"] }],
  "brave-search": [
    {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-brave-search"],
      env: { BRAVE_API_KEY: "YOUR_BRAVE_API_KEY" },
    },
  ],
  github: [
    {
      type: "remote",
      url: "https://api.githubcopilot.com/mcp/",
      headers: { Authorization: "Bearer YOUR_GITHUB_TOKEN" },
    },
  ],
};

const userSettings = 'model = "gpt-5"\n\n[profiles.fast]\nmodel = "o4-mini"\n';

// Exactly what install.sh's old `printf` appends produced.
const bashOutput = `${userSettings}
${CODEX_HEADER}

[mcp_servers.context7]
command = "npx"
args = ["-y", "@upstash/context7-mcp"]

[mcp_servers.filesystem]
command = "npx"
args = ["-y", "@modelcontextprotocol/server-filesystem", "."]

[mcp_servers.git]
command = "npx"
args = ["-y", "mcp-git"]
`;

// Exactly what install.ps1's old string building produced (header glued to the first table).
const powershellOutput = `${userSettings.trimEnd()}
${CODEX_HEADER}
[mcp_servers.context7]
command = "npx"
args = ["-y", "@upstash/context7-mcp"]

[mcp_servers.filesystem]
command = "npx"
args = ["-y", "@modelcontextprotocol/server-filesystem", "."]

[mcp_servers.git]
command = "npx"
args = ["-y", "mcp-git"]
`;

test("codex: appends shipped servers under the managed header, then stays put", () => {
  const first = mergeCodexConfig(userSettings, pinned, previous);
  assert.equal(first.changed, true);
  assert.equal(
    first.text,
    `${userSettings}\n${CODEX_HEADER}\n\n${codexBlock("context7", pinned.context7)}`,
  );
  const second = mergeCodexConfig(first.text, pinned, previous);
  assert.equal(second.changed, false);
  assert.deepEqual(second.warnings, []);

  const empty = mergeCodexConfig("", pinned, previous);
  assert.equal(
    empty.text,
    `${CODEX_HEADER}\n\n${codexBlock("context7", pinned.context7)}`,
  );
});

test("codex: upgrades and retires only blocks base_project wrote, in both installers' old formats", () => {
  for (const original of [bashOutput, powershellOutput]) {
    const result = mergeCodexConfig(original, pinned, previous);
    assert.equal(result.changed, true);
    assert.ok(result.text.startsWith(userSettings.trimEnd()));
    assert.ok(result.text.includes(CODEX_HEADER));
    assert.ok(result.text.includes(codexBlock("context7", pinned.context7)));
    assert.doesNotMatch(result.text, /mcp_servers\.(filesystem|git)\b/);
    assert.doesNotMatch(result.text, /context7-mcp"\]/);
    assert.ok(result.text.endsWith("\n") && !result.text.endsWith("\n\n"));
    assert.equal(result.notes.length, 3);
    assert.equal(
      mergeCodexConfig(result.text, pinned, previous).changed,
      false,
    );
  }
});

test("codex: tables the user edited or wrote are left byte for byte", () => {
  const original = `[mcp_servers.context7]
command = "npx"
args = ["-y", "@upstash/context7-mcp", "--api-key", "abc"]

[mcp_servers.filesystem]
command = "npx"
args = ["-y", "@modelcontextprotocol/server-filesystem", "/home/me/notes"]

[mcp_servers.git]
command = "npx"
args = ["-y", "mcp-git"]
startup_timeout_sec = 30
`;
  const result = mergeCodexConfig(original, pinned, previous);
  assert.equal(result.changed, false);
  assert.equal(result.text, original);
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /'context7' is your own definition/);
});

test("codex: a sub-table elsewhere makes the block the user's", () => {
  const original = `[mcp_servers.git]
command = "npx"
args = ["-y", "mcp-git"]

[profiles.fast]
model = "o4-mini"

[mcp_servers.git.env]
GIT_DIR = "/srv/repo"
`;
  const result = mergeCodexConfig(original, {}, previous);
  assert.equal(result.changed, false);
});

test("codex: servers defined without their own table are never duplicated", () => {
  const parentTable =
    '[mcp_servers]\ncontext7 = { command = "npx", args = ["-y", "@upstash/context7-mcp"] }\n';
  const parent = mergeCodexConfig(parentTable, pinned, previous);
  assert.equal(parent.changed, false);
  assert.match(parent.warnings[0], /form base_project does not manage/);

  const dotted = 'mcp_servers.context7.command = "npx"\n';
  assert.equal(mergeCodexConfig(dotted, pinned, previous).changed, false);

  const inline = 'mcp_servers = { context7 = { command = "npx" } }\n';
  const inlineResult = mergeCodexConfig(inline, pinned, previous);
  assert.equal(inlineResult.changed, false);
  assert.match(inlineResult.warnings[0], /inline table/);
});

test("codex: a header-like line inside a multi-line string is not a table", () => {
  const original =
    'notes = """\n[mcp_servers.context7]\ncommand = "npx"\n"""\n';
  const result = mergeCodexConfig(original, pinned, previous);
  assert.equal(result.changed, true);
  assert.ok(result.text.startsWith(original));
  assert.ok(result.text.endsWith(codexBlock("context7", pinned.context7)));
});

test("codex: CRLF files keep CRLF, and a header left empty goes with its last server", () => {
  const original = bashOutput.replace(/\n/g, "\r\n");
  const result = mergeCodexConfig(original, pinned, previous);
  assert.doesNotMatch(result.text.replace(/\r\n/g, ""), /\n/);
  assert.ok(
    result.text.includes(codexBlock("context7", pinned.context7, "\r\n")),
  );

  const onlyRetired = `${userSettings}\n${CODEX_HEADER}\n\n[mcp_servers.git]\ncommand = "npx"\nargs = ["-y", "mcp-git"]\n`;
  const cleaned = mergeCodexConfig(onlyRetired, {}, previous);
  assert.equal(cleaned.text, userSettings);
});

test("claude: retires only servers no longer shipped that still match a shipped definition", () => {
  const config = {
    mcpServers: {
      context7: {
        type: "stdio",
        command: "npx",
        args: ["-y", "@upstash/context7-mcp"],
        env: {},
      },
      filesystem: {
        type: "stdio",
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-filesystem", "."],
        env: {},
      },
      git: {
        type: "stdio",
        command: "npx",
        args: ["-y", "mcp-git", "--repository", "/srv/app"],
        env: {},
      },
      "brave-search": {
        type: "stdio",
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-brave-search"],
        env: { BRAVE_API_KEY: "YOUR_BRAVE_API_KEY" },
      },
      github: {
        type: "http",
        url: "https://api.githubcopilot.com/mcp/",
        headers: { Authorization: "Bearer ghp_real" },
      },
    },
  };
  assert.deepEqual(claudeRetirements(config, pinned, previous), [
    "filesystem",
    "brave-search",
  ]);
  config.mcpServers.github.headers.Authorization = "Bearer YOUR_GITHUB_TOKEN";
  assert.deepEqual(claudeRetirements(config, pinned, previous), [
    "filesystem",
    "brave-search",
    "github",
  ]);
  assert.deepEqual(claudeRetirements({}, pinned, previous), []);
});

test("claude: the CLI prints retirements and stays silent without a config", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bp-mcp-"));
  const configFile = path.join(dir, ".claude.json");
  fs.writeFileSync(
    configFile,
    JSON.stringify({
      mcpServers: {
        git: {
          type: "stdio",
          command: "npx",
          args: ["-y", "mcp-git"],
          env: {},
        },
      },
    }),
  );
  const cli = (file) =>
    execFileSync(
      process.execPath,
      [
        "dev/scripts/mcp-servers.js",
        "--claude-retirements",
        "--claude-config",
        file,
      ],
      { cwd: repoRoot, encoding: "utf8" },
    );
  assert.equal(cli(configFile), "git\n");
  assert.equal(cli(path.join(dir, "missing.json")), "");
});

test("install-codex.js upgrades an old config.toml where Codex reads it", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bp-codex-mcp-"));
  const codex = path.join(root, "codex");
  fs.mkdirSync(codex, { recursive: true });
  fs.writeFileSync(path.join(codex, "config.toml"), bashOutput);
  execFileSync(process.execPath, ["dev/scripts/install-codex.js"], {
    cwd: repoRoot,
    env: {
      ...process.env,
      BASE_PROJECT_CODEX_ROOT: codex,
      BASE_PROJECT_AGENTS_ROOT: path.join(root, "agents"),
      BASE_PROJECT_CLAUDE_ROOT: path.join(root, "claude"),
    },
    encoding: "utf8",
  });
  const updated = fs.readFileSync(path.join(codex, "config.toml"), "utf8");
  assert.ok(updated.startsWith(userSettings.trimEnd()));
  assert.ok(updated.includes(codexBlock("context7", loadCurrent().context7)));
  assert.doesNotMatch(updated, /mcp_servers\.(filesystem|git)\b/);
  assert.equal(
    fs.readFileSync(path.join(codex, "config.toml.bak"), "utf8"),
    bashOutput,
  );
});

test("shipped MCP servers are pinned, and every retired name keeps its old definition", () => {
  const current = loadCurrent();
  for (const [name, server] of Object.entries(current)) {
    if (server.command !== "npx") continue;
    const pkg = server.args.find((arg) => !arg.startsWith("-"));
    assert.match(
      pkg,
      /^(@[^/]+\/)?[^@]+@\d+\.\d+\.\d+$/,
      `${name} must pin an exact version (GOALS 17 R17.23)`,
    );
  }
  const shipped = loadPrevious();
  for (const name of ["context7", "filesystem", "git"]) {
    assert.ok(shipped[name]?.length, `${name} keeps its previous definition`);
  }
  for (const [name, definitions] of Object.entries(shipped)) {
    for (const definition of definitions) {
      assert.notDeepEqual(
        definition,
        current[name],
        `${name}: the current definition is not a previous one`,
      );
    }
  }
});
