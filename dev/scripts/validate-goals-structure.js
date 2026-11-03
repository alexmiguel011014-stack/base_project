#!/usr/bin/env node
// base_project:managed

const fs = require("node:fs");
const path = require("node:path");

// An item is *defined* by a checklist line whose bold text starts with its ID —
// "- [ ] **H.1 Title**", "- [x] **A.2a**", "  - [ ] **S16.1 Title**" (plans since GOALS 14
// prefix the plan number). Matching `**ID**` anywhere instead used to miss every real item
// written with its title inside the bold, while flagging mere mentions in prose.
const ITEM_DEFINITION = /^\s*[-*] \[[ xX]\] \*\*([A-Z]\d*\.\d+[a-z]?)(?=[\s*])/;
const MERMAID_OPEN = /^\s*```mermaid\s*$/i;
const FENCE_CLOSE = /^\s*```\s*$/;

// Executor-v1 sections (GOALS 19): a `## ` section holding the line `Format: executor-v1`.
// Its items carry fields an executor and the dispatcher rely on; old-format sections are
// left exactly as before.
const V1_MARKER = "Format: executor-v1";
const V1_REQUIRED = ["tier", "gate", "after", "files", "do", "check"];
const V1_FIELD = /^\s+- (tier|gate|after|files|do|check|stop-if):\s*(.*)$/;
const V1_TIER =
  /^(?:(?:light|standard|strong) · (?:low|medium|high|xhigh)|user)$/;
const V1_GATE = /^(?:auto|notify|ask)$/;
const HEADING = /^#{1,6} /;

function checkExecutorV1(lines, definedIds) {
  const findings = [];
  const starts = [];
  for (const [index, line] of lines.entries()) {
    if (line.startsWith("## ")) starts.push(index);
  }
  const sections = starts.map((start, i) => ({
    start,
    end: starts[i + 1] ?? lines.length,
  }));

  const edges = new Map();
  for (const { start, end } of sections) {
    const body = lines.slice(start, end);
    if (!body.some((line) => line.trim() === V1_MARKER)) continue;

    let current = null;
    const items = [];
    for (let index = start; index < end; index += 1) {
      const line = lines[index];
      const lineNumber = index + 1;
      if (MERMAID_OPEN.test(line) || line.startsWith("Suggested:")) {
        findings.push({
          code: "v1_forbidden_block",
          line: lineNumber,
          message: `Executor-v1 section has a Mermaid fence or a Suggested: line at line ${lineNumber}; use after: and tier: instead.`,
        });
      }
      const definition = line.match(ITEM_DEFINITION);
      if (definition) {
        current = { id: definition[1], line: lineNumber, fields: new Map() };
        items.push(current);
        continue;
      }
      if (HEADING.test(line)) {
        current = null;
        continue;
      }
      const field = current && line.match(V1_FIELD);
      if (field && !current.fields.has(field[1])) {
        current.fields.set(field[1], field[2].trim());
      }
    }

    for (const item of items) {
      const missing = V1_REQUIRED.filter((name) => !item.fields.has(name));
      if (missing.length > 0) {
        findings.push({
          code: "v1_missing_field",
          id: item.id,
          line: item.line,
          message: `Executor-v1 item **${item.id}** at line ${item.line} lacks: ${missing.join(", ")}.`,
        });
      }
      const tier = item.fields.get("tier");
      if (tier !== undefined && !V1_TIER.test(tier)) {
        findings.push({
          code: "v1_bad_tier",
          id: item.id,
          line: item.line,
          message: `Executor-v1 item **${item.id}** has tier "${tier}"; expected light|standard|strong · low|medium|high|xhigh, or user.`,
        });
      }
      const gate = item.fields.get("gate");
      if (gate !== undefined && !V1_GATE.test(gate)) {
        findings.push({
          code: "v1_bad_gate",
          id: item.id,
          line: item.line,
          message: `Executor-v1 item **${item.id}** has gate "${gate}"; expected auto, notify or ask.`,
        });
      }
      const after = item.fields.get("after");
      const targets =
        after === undefined || after === "none"
          ? []
          : after
              .split(",")
              .map((id) => id.trim())
              .filter(Boolean);
      for (const target of targets) {
        if (!definedIds.has(target)) {
          findings.push({
            code: "v1_unknown_after",
            id: item.id,
            line: item.line,
            message: `Executor-v1 item **${item.id}** depends on unknown item ${target}.`,
          });
        }
      }
      edges.set(item.id, { line: item.line, targets });
    }
  }

  const state = new Map();
  const visit = (id) => {
    if (state.get(id) === "done") return false;
    if (state.get(id) === "active") return true;
    state.set(id, "active");
    const node = edges.get(id);
    const cyclic = node ? node.targets.some((target) => visit(target)) : false;
    state.set(id, "done");
    return cyclic;
  };
  for (const [id, node] of edges) {
    if (state.has(id)) continue;
    if (visit(id)) {
      findings.push({
        code: "v1_cycle",
        id,
        line: node.line,
        message: `Executor-v1 item **${id}** is part of an after: cycle.`,
      });
    }
  }

  return findings;
}

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
    const definition = line.match(ITEM_DEFINITION);
    if (definition) {
      const id = definition[1];
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

  findings.push(...checkExecutorV1(lines, seenIds));

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
