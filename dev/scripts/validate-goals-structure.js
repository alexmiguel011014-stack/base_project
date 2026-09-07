#!/usr/bin/env node
// base_project:managed

const fs = require("node:fs");
const path = require("node:path");

const ITEM_ID = /\*\*([A-Z]\.\d+[a-z]?)\*\*/g;
const MERMAID_OPEN = /^\s*```mermaid\s*$/i;
const FENCE_CLOSE = /^\s*```\s*$/;

function check(filePath) {
  const resolved = path.resolve(filePath);
  let text;
  try {
    text = fs.readFileSync(resolved, "utf8");
  } catch (error) {
    return {
      ok: false,
      findings: [
        {
          code: "read_error",
          message: `Could not read ${resolved}: ${error.message}`,
        },
      ],
    };
  }

  const findings = [];
  const seenIds = new Map();
  const lines = text.split(/\r?\n/);
  let mermaidStart = null;

  for (const [index, line] of lines.entries()) {
    const lineNumber = index + 1;
    for (const match of line.matchAll(ITEM_ID)) {
      const id = match[1];
      const firstLine = seenIds.get(id);
      if (firstLine) {
        findings.push({
          code: "duplicate_item_id",
          id,
          line: lineNumber,
          firstLine,
          message: `Duplicate item ID **${id}** at line ${lineNumber}; first used at line ${firstLine}.`,
        });
      } else {
        seenIds.set(id, lineNumber);
      }
    }

    if (mermaidStart === null && MERMAID_OPEN.test(line)) {
      mermaidStart = lineNumber;
    } else if (mermaidStart !== null && FENCE_CLOSE.test(line)) {
      mermaidStart = null;
    }
  }

  if (mermaidStart !== null) {
    findings.push({
      code: "unclosed_mermaid_fence",
      line: mermaidStart,
      message: `Mermaid fence opened at line ${mermaidStart} has no closing \`\`\` fence.`,
    });
  }

  return { ok: findings.length === 0, findings };
}

function main() {
  const [filePath] = process.argv.slice(2);
  if (!filePath) {
    process.stderr.write(
      "Usage: node dev/scripts/validate-goals-structure.js <GOALS.md>\n",
    );
    process.exitCode = 2;
    return;
  }

  const result = check(filePath);
  if (result.ok) {
    process.stdout.write(`${path.resolve(filePath)}: structure OK\n`);
    return;
  }

  for (const finding of result.findings) {
    process.stderr.write(`${finding.message}\n`);
  }
  process.exitCode = 1;
}

if (require.main === module) {
  main();
}

module.exports = { check };
