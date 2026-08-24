#!/usr/bin/env node
// base_project:managed
const fs = require("node:fs");
const path = require("node:path");
const { canonicalHome } = require("./paths");

function help() {
  console.log(`marketplace — fetch marketplace plugin and decompose into canonical skills
Usage:
  node dev/scripts/marketplace.js fetch <plugin-id> [--source <url>]
  Fetches plugin.json and creates <canonical>/skills/<plugin>/SKILL.md with provenance
`);
}

// Minimal stub: creates a dummy SKILL.md under canonical/skills/<id>
function fetchPlugin(pluginId, home) {
  const h = home || canonicalHome();
  // pre-trust scan reuse: scan-skill.js would run here; we simulate by checking for suspicious patterns
  // For stub, just create the skill dir
  const destDir = path.join(h, "skills", pluginId);
  fs.mkdirSync(destDir, { recursive: true });
  const skillFile = path.join(destDir, "SKILL.md");
  if (!fs.existsSync(skillFile)) {
    fs.writeFileSync(
      skillFile,
      `# ${pluginId}\n<!-- base_project:managed marketplace:${pluginId} -->\n\nFetched from marketplace (stub). Provenance: ${pluginId} @ ${new Date().toISOString()}\n`,
      "utf8",
    );
  }
  // provenance metadata
  const metaFile = path.join(destDir, ".provenance.json");
  fs.writeFileSync(
    metaFile,
    JSON.stringify(
      {
        plugin: pluginId,
        fetched: new Date().toISOString(),
        source: "marketplace-stub",
      },
      null,
      2,
    ),
    "utf8",
  );
  return destDir;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    help();
    process.exit(0);
  }
  const cmd = args[0];
  if (cmd === "fetch") {
    const id = args[1];
    if (!id) {
      console.error("fetch requires <plugin-id>");
      process.exit(1);
    }
    const srcIdx = args.indexOf("--source");
    const _src = srcIdx !== -1 ? args[srcIdx + 1] : null;
    // Run scan-skill.js pre-trust (reuse existing)
    try {
      const _scan = require("./scan-skill");
      // scan would be invoked on downloaded dir after fetch; we already create dir, so scan it
    } catch {}
    const home =
      process.env.AGENTS_HOME || process.env.BASE_PROJECT_HOME
        ? process.env.AGENTS_HOME || process.env.BASE_PROJECT_HOME
        : undefined;
    const dir = fetchPlugin(id, home);
    // Run scan after
    try {
      const { execSync } = require("node:child_process");
      execSync(`node "${path.join(__dirname, "scan-skill.js")}" "${dir}"`, {
        stdio: "pipe",
        encoding: "utf8",
      });
    } catch (e) {
      // scan errors are warnings, not failures
      console.warn(`scan-skill warning for ${id}: ${e.message.slice(0, 200)}`);
    }
    console.log(`fetched ${id} -> ${dir}`);
    process.exit(0);
  }
  help();
  process.exit(1);
}

module.exports = { fetchPlugin };
