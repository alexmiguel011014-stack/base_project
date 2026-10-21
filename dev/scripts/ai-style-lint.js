#!/usr/bin/env node
// base_project:managed

// Mechanical checks for the AI-facing writing standard
// (source/claude/references/ai-writing-standard.md, GOALS 19). It cannot judge word choice;
// it flags what a regex can see. `--enforce` gates the files already converted to the
// standard; `--report` counts findings across every model-executed file as the rollout
// baseline.

const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..", "..");

const ENFORCED = [
  "source/claude/references/ai-writing-standard.md",
  "source/opencode/references/ai-writing-standard.md",
];

const BANNED =
  /\b(?:verify|verified|verifying|ensure|ensures|execute|executes|executed|executing|abort|halt|stuck|make sure|double-check|bail out|prompt the user|check with the user)\b/gi;
const MODAL = /\b(?:should|may|try to)\b/gi;
const DASH = /—/g;
const MAX_SENTENCE_WORDS = 25;
const FENCE = /^\s*(?:```|~~~)/;
const LIST_ITEM = /^\s*(?:[-*+]|\d+\.)\s+/;

function stripInline(line) {
  return line.replace(/`[^`]*`/g, "").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");
}

function countWords(sentence) {
  return sentence.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word))
    .length;
}

function lintText(text) {
  const findings = [];
  const lines = text.split(/\r?\n/);
  let inFence = false;
  let block = null;
  const blocks = [];

  const closeBlock = () => {
    if (block) blocks.push(block);
    block = null;
  };

  for (const [index, raw] of lines.entries()) {
    const lineNumber = index + 1;
    if (FENCE.test(raw)) {
      inFence = !inFence;
      closeBlock();
      continue;
    }
    if (inFence) continue;
    const trimmed = raw.trim();
    if (
      trimmed === "" ||
      trimmed.startsWith("|") ||
      /^#{1,6}\s/.test(trimmed)
    ) {
      closeBlock();
      continue;
    }

    const prose = stripInline(raw);
    for (const [rule, pattern] of [
      ["banned-term", BANNED],
      ["modal", MODAL],
      ["dash-aside", DASH],
    ]) {
      for (const match of prose.matchAll(pattern)) {
        findings.push({ line: lineNumber, rule, text: match[0] });
      }
    }

    if (LIST_ITEM.test(raw) || !block) {
      closeBlock();
      block = { line: lineNumber, text: prose.replace(LIST_ITEM, "") };
    } else {
      block.text += ` ${prose.trim()}`;
    }
  }
  closeBlock();

  for (const { line, text: blockText } of blocks) {
    for (const sentence of blockText.split(/(?<=[.!?])\s+/)) {
      const words = countWords(sentence);
      if (words > MAX_SENTENCE_WORDS) {
        findings.push({ line, rule: "long-sentence", text: `${words} words` });
      }
    }
  }

  return findings.sort((a, b) => a.line - b.line);
}

function listMarkdown(relativeDir, { recursive = false, name = null } = {}) {
  const dir = path.join(repoRoot, relativeDir);
  if (!fs.existsSync(dir)) return [];
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const relative = path.posix.join(relativeDir, entry.name);
    if (entry.isDirectory()) {
      if (recursive)
        result.push(...listMarkdown(relative, { recursive, name }));
      else if (name && fs.existsSync(path.join(dir, entry.name, name))) {
        result.push(path.posix.join(relative, name));
      }
    } else if (!name && entry.name.endsWith(".md")) {
      result.push(relative);
    }
  }
  return result;
}

function modelExecutedFiles() {
  return [
    ...listMarkdown("source/claude/commands"),
    ...listMarkdown("source/opencode/command"),
    ...listMarkdown("source/opencode/command-lite"),
    ...listMarkdown("source/codex/skills", { name: "SKILL.md" }),
    ...listMarkdown("source/claude/agents"),
    ...listMarkdown("source/opencode/agent"),
    "source/CLAUDE.md",
    "source/opencode-instructions.md",
    "source/codex/AGENTS.md",
    ...listMarkdown("source/claude/references", { recursive: true }).filter(
      (file) => path.posix.basename(file) !== "command-menu.md",
    ),
  ];
}

function lintFile(relative) {
  const text = fs.readFileSync(path.join(repoRoot, relative), "utf8");
  return lintText(text).map((finding) => ({ file: relative, ...finding }));
}

function main() {
  const mode = process.argv[2];
  if (mode === "--enforce") {
    const findings = ENFORCED.flatMap(lintFile);
    for (const { file, line, rule, text } of findings) {
      process.stdout.write(`${file}:${line} ${rule} ${text}\n`);
    }
    if (findings.length > 0) process.exitCode = 1;
    return;
  }
  if (mode === "--report") {
    const findings = modelExecutedFiles().flatMap(lintFile);
    const perRule = new Map();
    for (const { rule } of findings)
      perRule.set(rule, (perRule.get(rule) ?? 0) + 1);
    for (const [rule, count] of [...perRule].sort()) {
      process.stdout.write(`${rule}: ${count}\n`);
    }
    const files = new Set(findings.map(({ file }) => file));
    process.stdout.write(
      `findings: ${findings.length} in ${files.size} files\n`,
    );
    return;
  }
  process.stderr.write(
    "Usage: node dev/scripts/ai-style-lint.js --enforce | --report\n",
  );
  process.exitCode = 2;
}

if (require.main === module) {
  main();
}

module.exports = { lintText, ENFORCED };
