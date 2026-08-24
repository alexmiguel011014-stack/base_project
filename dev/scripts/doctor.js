#!/usr/bin/env node
// base_project:managed
const fs = require("node:fs");
const path = require("node:path");
const { canonicalHome, rulesGlobalDir } = require("./paths");

function help() {
  console.log(`doctor — health diagnostics for unified layer
Usage:
  node dev/scripts/doctor.js [--project <path>] [--json]
Checks: broken symlinks/hardlinks, missing canonical dirs, stale hooks in settings.json, legacy formats, EXDEV fallback
Exit 0 healthy, 1 with actionable fixes
`);
}

function checkHealth({ projectPath, home }) {
  const h = home || canonicalHome();
  const issues = [];
  const _fixes = [];

  // canonical dirs
  const requiredDirs = [
    rulesGlobalDir(h),
    path.join(h, "mcp"),
    path.join(h, "skills"),
    path.join(h, "commands"),
  ];
  for (const d of requiredDirs) {
    if (!fs.existsSync(d)) {
      issues.push({
        level: "error",
        message: `missing canonical dir ${d}`,
        fix: `node dev/scripts/config-store.js --init`,
      });
    }
  }

  // broken symlinks in project
  if (projectPath) {
    const abs = path.resolve(projectPath);
    const candidates = [
      path.join(abs, "CLAUDE.md"),
      path.join(abs, "AGENTS.md"),
      path.join(abs, "GEMINI.md"),
      path.join(abs, ".cursor", "rules", "agentsync.mdc"),
      path.join(abs, ".claude.json"),
    ];
    for (const p of candidates) {
      try {
        const stat = fs.lstatSync(p);
        if (stat.isSymbolicLink()) {
          const target = fs.readlinkSync(p);
          const resolved = path.isAbsolute(target)
            ? target
            : path.resolve(path.dirname(p), target);
          if (!fs.existsSync(resolved)) {
            issues.push({
              level: "error",
              message: `broken symlink ${p} -> ${target}`,
              fix: `node dev/scripts/apply.js --project ${abs} --fix`,
            });
          }
        } else if (stat.isFile()) {
          // hardlink check for cursor
          if (p.includes(".cursor")) {
            try {
              const target = path.join(h, "rules", "global", "AGENTS.md");
              if (fs.existsSync(target)) {
                const a = fs.statSync(p);
                const b = fs.statSync(target);
                if (a.ino !== b.ino) {
                  issues.push({
                    level: "warning",
                    message: `cursor hardlink not inode-equal (cross-device copy fallback) ${p}`,
                    fix: `doctor flags as warning, not error`,
                  });
                }
              }
            } catch {}
          }
        }
      } catch (e) {
        if (e.code !== "ENOENT")
          issues.push({
            level: "warning",
            message: `lstat error ${p}: ${e.message}`,
          });
      }
    }

    // legacy formats
    const legacy = path.join(abs, ".cursorrules");
    if (fs.existsSync(legacy)) {
      issues.push({
        level: "warning",
        message: `legacy .cursorrules found, should be .cursor/rules/`,
        fix: `move to .cursor/rules/`,
      });
    }

    // EXDEV fallback already surfaced in apply reports, check reports for it
    try {
      const reportsDir = path.join(h, "reports");
      const reportFile = path.join(reportsDir, `${path.basename(abs)}.json`);
      if (fs.existsSync(reportFile)) {
        const reports = JSON.parse(fs.readFileSync(reportFile, "utf8"));
        for (const r of reports) {
          for (const l of r.lossy || []) {
            if (l.field.includes("EXDEV"))
              issues.push({
                level: "warning",
                message: `${r.agent} EXDEV fallback: ${l.dropped}`,
                fix: `warning not error`,
              });
          }
        }
      }
    } catch {}
  }

  // stale hooks in settings.json (reuse install prune logic)
  try {
    const claudeHome =
      process.env.CLAUDE_HOME ||
      path.join(require("node:os").homedir(), ".claude");
    const settingsPath = path.join(claudeHome, "settings.json");
    if (fs.existsSync(settingsPath)) {
      const raw = fs.readFileSync(settingsPath, "utf8");
      if (raw.includes("base_project/dashboard/")) {
        issues.push({
          level: "warning",
          message: `stale dashboard hook in settings.json`,
          fix: `rerun install.ps1/.sh to prune`,
        });
      }
    }
  } catch {}

  const healthy = issues.filter((i) => i.level === "error").length === 0;
  return { healthy, issues, home: h, project: projectPath };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    help();
    process.exit(0);
  }
  const projIdx = args.indexOf("--project");
  const proj = projIdx !== -1 ? args[projIdx + 1] : null;
  const home =
    process.env.AGENTS_HOME || process.env.BASE_PROJECT_HOME
      ? process.env.AGENTS_HOME || process.env.BASE_PROJECT_HOME
      : undefined;
  const result = checkHealth({ projectPath: proj, home });
  if (args.includes("--json")) console.log(JSON.stringify(result, null, 2));
  else {
    if (result.healthy && result.issues.length === 0)
      console.log("doctor: healthy");
    else {
      for (const i of result.issues)
        console.log(
          `${i.level}: ${i.message}${i.fix ? ` (fix: ${i.fix})` : ""}`,
        );
      console.log(
        result.healthy ? "doctor: warnings only" : "doctor: issues found",
      );
    }
  }
  process.exit(result.healthy ? 0 : 1);
}

module.exports = { checkHealth };
