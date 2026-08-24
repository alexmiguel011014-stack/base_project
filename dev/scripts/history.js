#!/usr/bin/env node
// base_project:managed
const fs = require("node:fs");
const path = require("node:path");
const { canonicalHome } = require("./paths");

function help() {
  console.log(`history — view recent agent activity
Usage:
  node dev/scripts/history.js --project <path> [--since 7d] [--json]
  Reads from tasks/history + usage-log ledger where available
`);
}

function parseSince(s) {
  if (!s) return 0;
  const m = s.match(/^(\d+)(d|h|m)$/);
  if (!m) return 0;
  const n = parseInt(m[1], 10);
  const unit = m[2];
  const mult = unit === "d" ? 86400000 : unit === "h" ? 3600000 : 60000;
  return Date.now() - n * mult;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    help();
    process.exit(0);
  }
  const projIdx = args.indexOf("--project");
  const sinceIdx = args.indexOf("--since");
  const proj = projIdx !== -1 ? args[projIdx + 1] : null;
  const sinceStr = sinceIdx !== -1 ? args[sinceIdx + 1] : null;
  const home =
    process.env.AGENTS_HOME || process.env.BASE_PROJECT_HOME
      ? process.env.AGENTS_HOME || process.env.BASE_PROJECT_HOME
      : canonicalHome();
  const cutoff = parseSince(sinceStr);

  const entries = [];
  // read history/*.jsonl for project
  if (proj) {
    const name = path.basename(path.resolve(proj));
    const hFile = path.join(home, "history", `${name}.jsonl`);
    if (fs.existsSync(hFile)) {
      for (const line of fs
        .readFileSync(hFile, "utf8")
        .split("\n")
        .filter(Boolean)) {
        try {
          const e = JSON.parse(line);
          const ts = new Date(e.ts || e.created || 0).getTime();
          if (ts >= cutoff) entries.push(e);
        } catch {}
      }
    }
    // also read usage ledger if present
    try {
      const ledgerDir = path.join(
        require("node:os").homedir(),
        ".claude",
        "base_project",
        "usage",
      );
      if (fs.existsSync(ledgerDir)) {
        for (const f of fs
          .readdirSync(ledgerDir)
          .filter((x) => x.endsWith(".jsonl"))
          .slice(-5)) {
          for (const line of fs
            .readFileSync(path.join(ledgerDir, f), "utf8")
            .split("\n")
            .filter(Boolean)
            .slice(-20)) {
            try {
              const e = JSON.parse(line);
              if (e.cwd && path.resolve(e.cwd) === path.resolve(proj)) {
                const ts = new Date(e.ts || 0).getTime();
                if (ts >= cutoff)
                  entries.push({
                    ts: e.ts,
                    action: `tool:${e.tool}`,
                    cwd: e.cwd,
                  });
              }
            } catch {}
          }
        }
      }
    } catch {}
  }

  entries.sort((a, b) => new Date(a.ts || 0) - new Date(b.ts || 0));
  if (args.includes("--json")) console.log(JSON.stringify(entries, null, 2));
  else {
    if (entries.length === 0) console.log("(no history)");
    else
      for (const e of entries.slice(-50))
        console.log(
          `${e.ts || ""} ${e.action || e.tool || ""} ${e.title || ""}`,
        );
  }
  process.exit(0);
}
