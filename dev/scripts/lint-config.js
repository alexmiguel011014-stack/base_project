#!/usr/bin/env node
// base_project:managed
const fs = require("node:fs");
const path = require("node:path");
const { canonicalHome, configPath, mcpPath } = require("./paths");

function help() {
  console.log(`lint-config — validate canonical config files
Usage:
  node dev/scripts/lint-config.js [--json]
  Checks: ~/.agents/config.json, source/adapters.json, ~/.agents/mcp/mcp.json
`);
}

function validate() {
  const home =
    process.env.AGENTS_HOME || process.env.BASE_PROJECT_HOME
      ? process.env.AGENTS_HOME || process.env.BASE_PROJECT_HOME
      : canonicalHome();
  const errors = [];

  // config.json
  const cfgPath = configPath(home);
  if (fs.existsSync(cfgPath)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
      if (!cfg.projects || typeof cfg.projects !== "object")
        errors.push(`config.json: missing or invalid projects`);
      if (
        cfg.defaults?.link_type &&
        !["auto", "symlink", "hardlink"].includes(cfg.defaults.link_type)
      ) {
        errors.push(`config.json: invalid link_type ${cfg.defaults.link_type}`);
      }
    } catch (e) {
      errors.push(`config.json: invalid JSON ${e.message}`);
    }
  }

  // adapters.json
  const adaptersPath = path.join(
    __dirname,
    "..",
    "..",
    "source",
    "adapters.json",
  );
  if (fs.existsSync(adaptersPath)) {
    try {
      const cat = JSON.parse(fs.readFileSync(adaptersPath, "utf8"));
      if (!cat._managed_by) errors.push(`adapters.json: missing _managed_by`);
      if (!Array.isArray(cat.adapters))
        errors.push(`adapters.json: adapters must be array`);
      else {
        for (const a of cat.adapters) {
          if (!a.id || !a.name)
            errors.push(
              `adapters.json: adapter missing id/name ${JSON.stringify(a).slice(0, 60)}`,
            );
        }
      }
    } catch (e) {
      errors.push(`adapters.json: invalid JSON ${e.message}`);
    }
  }

  // mcp.json
  const mcpFile = mcpPath(home);
  if (fs.existsSync(mcpFile)) {
    try {
      const mcp = JSON.parse(fs.readFileSync(mcpFile, "utf8"));
      if (!mcp.mcpServers || typeof mcp.mcpServers !== "object")
        errors.push(`mcp.json: missing mcpServers`);
    } catch (e) {
      errors.push(`mcp.json: invalid JSON ${e.message}`);
    }
  }

  return { valid: errors.length === 0, errors, home };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    help();
    process.exit(0);
  }
  const result = validate();
  if (args.includes("--json")) console.log(JSON.stringify(result, null, 2));
  else {
    if (result.valid) console.log("lint-config: ok");
    else {
      console.error("lint-config: errors");
      for (const e of result.errors) console.error(`  - ${e}`);
    }
  }
  process.exit(result.valid ? 0 : 1);
}

module.exports = { validate };
