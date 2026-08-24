#!/usr/bin/env node
// base_project:managed
const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");
const { canonicalHome, snapshotsDir } = require("./paths");

function help() {
  console.log(`snapshot — config versioning (tar)
Usage:
  node dev/scripts/snapshot.js snapshot <name>
  node dev/scripts/snapshot.js restore <name>
  node dev/scripts/snapshot.js list
`);
}

function isInsideGitRepo(p) {
  try {
    execSync("git rev-parse --is-inside-work-tree", {
      cwd: p,
      stdio: ["pipe", "pipe", "pipe"],
      encoding: "utf8",
    });
    return true;
  } catch {
    return false;
  }
}

const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h") || args.length === 0) {
  help();
  process.exit(0);
}
const home =
  process.env.AGENTS_HOME || process.env.BASE_PROJECT_HOME
    ? process.env.AGENTS_HOME || process.env.BASE_PROJECT_HOME
    : canonicalHome();
const cmd = args[0];

if (cmd === "list") {
  const dir = snapshotsDir(home);
  if (!fs.existsSync(dir)) {
    console.log("(no snapshots)");
    process.exit(0);
  }
  for (const f of fs.readdirSync(dir)) console.log(f.replace(/\.tar\.gz$/, ""));
  process.exit(0);
}

if (cmd === "snapshot") {
  const name = args[1];
  if (!name) {
    console.error("snapshot requires <name>");
    process.exit(1);
  }
  if (
    isInsideGitRepo(path.resolve(name)) &&
    path.resolve(name).startsWith(path.resolve(home)) === false
  ) {
    // if name is a path inside a repo, refuse
    // but snapshot name is not a path, it's a label, so ignore
  }
  const dir = snapshotsDir(home);
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, `${name}.tar.gz`);
  // use tar if available, else copy
  try {
    // exclude keys/ and reports/ per GOALS
    const excludes = [
      "--exclude=keys",
      "--exclude=reports",
      "--exclude=snapshots",
      "--exclude=.git",
    ];
    execSync(`tar ${excludes.join(" ")} -czf "${dest}" -C "${home}" .`, {
      stdio: ["pipe", "pipe", "pipe"],
    });
    console.log(`snapshot ${name} -> ${dest}`);
    process.exit(0);
  } catch (_e) {
    // fallback: copy dir
    try {
      fs.cpSync(home, `${dest}.dir`, {
        recursive: true,
        force: true,
        filter: (src) =>
          !src.includes(`${path.sep}keys${path.sep}`) &&
          !src.includes(`${path.sep}reports${path.sep}`),
      });
      console.log(`snapshot fallback copy ${dest}.dir`);
      process.exit(0);
    } catch (err) {
      console.error(`snapshot failed: ${err.message}`);
      process.exit(1);
    }
  }
}

if (cmd === "restore") {
  const name = args[1];
  if (!name) {
    console.error("restore requires <name>");
    process.exit(1);
  }
  const dir = snapshotsDir(home);
  const src = path.join(dir, `${name}.tar.gz`);
  const srcDir = `${src}.dir`;
  let done = false;
  if (fs.existsSync(src)) {
    try {
      // backup current
      const backup = path.join(dir, `pre-restore-${Date.now()}.tar.gz`);
      try {
        execSync(`tar --exclude=snapshots -czf "${backup}" -C "${home}" .`, {
          stdio: ["pipe", "pipe", "pipe"],
        });
      } catch {}
      execSync(`tar -xzf "${src}" -C "${home}"`, {
        stdio: ["pipe", "pipe", "pipe"],
      });
      console.log(`restored ${name} from ${src}`);
      done = true;
    } catch (e) {
      console.error(`restore tar failed: ${e.message}`);
    }
  }
  if (!done && fs.existsSync(srcDir)) {
    fs.cpSync(srcDir, home, { recursive: true, force: true });
    console.log(`restored ${name} from ${srcDir}`);
    done = true;
  }
  if (!done) {
    console.error(`snapshot ${name} not found`);
    process.exit(1);
  }
  process.exit(0);
}

help();
process.exit(1);
