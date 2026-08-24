// base_project:managed
const os = require("node:os");
const path = require("node:path");

function canonicalHome() {
  return (
    process.env.AGENTS_HOME ||
    process.env.BASE_PROJECT_HOME ||
    path.join(os.homedir(), ".agents")
  );
}

function legacyHome() {
  return path.join(os.homedir(), ".base_project");
}

function configPath(home = canonicalHome()) {
  return path.join(home, "config.json");
}

function mcpPath(home = canonicalHome()) {
  return path.join(home, "mcp", "mcp.json");
}

function rulesGlobalDir(home = canonicalHome()) {
  return path.join(home, "rules", "global");
}

function rulesProjectDir(projectName, home = canonicalHome()) {
  return path.join(home, "rules", projectName);
}

function skillsDir(home = canonicalHome()) {
  return path.join(home, "skills");
}

function commandsDir(home = canonicalHome()) {
  return path.join(home, "commands");
}

function reportsDir(home = canonicalHome()) {
  return path.join(home, "reports");
}

function snapshotsDir(home = canonicalHome()) {
  return path.join(home, "snapshots");
}

function keysDir(home = canonicalHome()) {
  return path.join(home, "keys");
}

function ageKeyPath(home = canonicalHome()) {
  return path.join(keysDir(home), "age.txt");
}

module.exports = {
  canonicalHome,
  legacyHome,
  configPath,
  mcpPath,
  rulesGlobalDir,
  rulesProjectDir,
  skillsDir,
  commandsDir,
  reportsDir,
  snapshotsDir,
  keysDir,
  ageKeyPath,
};
