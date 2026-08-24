#!/usr/bin/env node
// base_project:managed
const fs = require("node:fs");
const path = require("node:path");
const { canonicalHome, configPath } = require("./paths");

const SCHEMA_VERSION = "1.0";

function help() {
  console.log(`config-store — manage ~/.agents/config.json
Usage:
  node dev/scripts/config-store.js --help
  node dev/scripts/config-store.js --init
  node dev/scripts/config-store.js add <path> [--name <name>]
  node dev/scripts/config-store.js remove <name>
  node dev/scripts/config-store.js list [--json]
  node dev/scripts/config-store.js get --project <path> [--json]

Env:
  AGENTS_HOME / BASE_PROJECT_HOME overrides the canonical home (default: ~/.agents)
`);
}

function readConfig(home) {
  const p = configPath(home);
  if (!fs.existsSync(p))
    return {
      schema_version: SCHEMA_VERSION,
      projects: {},
      defaults: { link_type: "auto" },
    };
  try {
    const raw = fs.readFileSync(p, "utf8");
    const obj = JSON.parse(raw);
    if (!obj.projects) obj.projects = {};
    if (!obj.defaults) obj.defaults = { link_type: "auto" };
    return obj;
  } catch {
    return {
      schema_version: SCHEMA_VERSION,
      projects: {},
      defaults: { link_type: "auto" },
    };
  }
}

function writeConfig(home, obj) {
  const p = configPath(home);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, `${JSON.stringify(obj, null, 2)}\n`, "utf8");
}

function ensureCanonicalScaffold(home) {
  const dirs = [
    path.join(home, "rules", "global"),
    path.join(home, "mcp"),
    path.join(home, "skills"),
    path.join(home, "commands"),
    path.join(home, "reports"),
    path.join(home, "snapshots"),
    path.join(home, "keys"),
    path.join(home, "tasks"),
    path.join(home, "history"),
  ];
  for (const d of dirs) fs.mkdirSync(d, { recursive: true });
  const globalClaude = path.join(home, "rules", "global", "CLAUDE.md");
  if (!fs.existsSync(globalClaude)) {
    fs.writeFileSync(
      globalClaude,
      "# Global rules\n<!-- base_project:managed global seed -->\n",
      "utf8",
    );
  }
  const globalAgents = path.join(home, "rules", "global", "AGENTS.md");
  if (!fs.existsSync(globalAgents)) {
    fs.writeFileSync(
      globalAgents,
      "# Global agents instructions\n<!-- base_project:managed global seed -->\n",
      "utf8",
    );
  }
  const mcpFile = path.join(home, "mcp", "mcp.json");
  if (!fs.existsSync(mcpFile)) {
    const seedSrc = path.join(
      __dirname,
      "..",
      "..",
      "source",
      "opencode",
      "mcp.json",
    );
    try {
      if (fs.existsSync(seedSrc)) {
        fs.copyFileSync(seedSrc, mcpFile);
      } else {
        fs.writeFileSync(
          mcpFile,
          `${JSON.stringify({ mcpServers: {} }, null, 2)}\n`,
          "utf8",
        );
      }
    } catch {
      fs.writeFileSync(
        mcpFile,
        `${JSON.stringify({ mcpServers: {} }, null, 2)}\n`,
        "utf8",
      );
    }
  }
  const gitignore = path.join(home, ".gitignore");
  if (!fs.existsSync(gitignore)) {
    fs.writeFileSync(
      gitignore,
      "keys/\nreports/\nsnapshots/\n.DS_Store\n",
      "utf8",
    );
  }
  const readme = path.join(home, "README.md");
  if (!fs.existsSync(readme)) {
    fs.writeFileSync(
      readme,
      `# ~/.agents — unified config layer (base_project)\n\nCanonical store for all AI coding agents. Managed by base_project. See \`source/claude/references/config-model.md\`.\n\n- \`rules/global/\` — shared rules\n- \`mcp/mcp.json\` — MCP servers\n- \`skills/\` — SKILL.md dirs\n- \`commands/\` — slash commands\n\nSync with \`git\` to your private remote; never commit secrets (keys/ is gitignored).\n`,
      "utf8",
    );
  }
}

const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h") || args.length === 0) {
  help();
  process.exit(0);
}

const home = canonicalHome();
const cmd = args[0];

if (cmd === "--init" || cmd === "init") {
  ensureCanonicalScaffold(home);
  const cfg = readConfig(home);
  writeConfig(home, cfg);
  console.log(`initialized ${home}`);
  process.exit(0);
}

if (cmd === "add") {
  const targetPath = args[1];
  if (!targetPath) {
    console.error("add requires <path>");
    process.exit(1);
  }
  const nameIdx = args.indexOf("--name");
  let name = nameIdx !== -1 ? args[nameIdx + 1] : null;
  if (!name) {
    const abs = path.resolve(targetPath);
    name = path.basename(abs);
  }
  ensureCanonicalScaffold(home);
  const cfg = readConfig(home);
  cfg.projects[name] = {
    path: path.resolve(targetPath),
    added: new Date().toISOString(),
  };
  writeConfig(home, cfg);
  fs.mkdirSync(path.join(home, "rules", name), { recursive: true });
  console.log(`added ${name} -> ${cfg.projects[name].path}`);
  process.exit(0);
}

if (cmd === "remove") {
  const name = args[1];
  if (!name) {
    console.error("remove requires <name>");
    process.exit(1);
  }
  const cfg = readConfig(home);
  if (cfg.projects[name]) {
    delete cfg.projects[name];
    writeConfig(home, cfg);
    console.log(`removed ${name}`);
  } else {
    console.error(`project ${name} not found`);
    process.exit(1);
  }
  process.exit(0);
}

if (cmd === "list") {
  const cfg = readConfig(home);
  if (args.includes("--json")) {
    console.log(JSON.stringify(cfg.projects, null, 2));
  } else {
    for (const [k, v] of Object.entries(cfg.projects))
      console.log(`${k}\t${v.path}\t${v.added}`);
  }
  process.exit(0);
}

if (cmd === "get") {
  const idx = args.indexOf("--project");
  const p = idx !== -1 ? args[idx + 1] : null;
  const cfg = readConfig(home);
  if (!p) {
    console.log(JSON.stringify(cfg, null, 2));
    process.exit(0);
  }
  const abs = path.resolve(p);
  let found = null;
  for (const [k, v] of Object.entries(cfg.projects)) {
    if (path.resolve(v.path) === abs) {
      found = { name: k, ...v };
      break;
    }
  }
  if (args.includes("--json"))
    console.log(
      JSON.stringify(found ?? { error: "not found", path: abs }, null, 2),
    );
  else
    console.log(found ? `${found.name} -> ${found.path}` : `not found: ${abs}`);
  process.exit(found ? 0 : 1);
}

console.error(`unknown command: ${cmd}`);
help();
process.exit(1);
