#!/usr/bin/env node
// base_project:managed
// Lightweight pre-trust scan for a third-party skill/plugin directory before
// installing it. NOT a full security scanner (no AgentShield-style 100+ rule
// engine) — this is deliberately the same scope ECC's own
// the-security-guide.md documents: a handful of cheap, high-signal checks
// (zero-width Unicode hiding text, curl|bash-style remote-exec patterns, raw
// exec of eval/child_process against untrusted input) run over every text
// file in a directory tree, in plain Node (no ripgrep dependency — base_project
// doesn't require any external CLI beyond Node/git elsewhere, so this doesn't
// either).
//
// Usage: node scripts/scan-skill.js <path-to-skill-or-plugin-dir>
// Exit code 0 = no findings. Exit code 1 = at least one suspicious pattern
// found (printed to stderr with file + line). This is advisory, not a gate —
// nothing currently calls this automatically before an install; it's a tool
// a human runs before trusting a new skill.

const fs = require("fs");
const path = require("path");

const SKIP_DIRS = new Set([".git", "node_modules", ".venv", "__pycache__"]);
const MAX_FILE_BYTES = 2 * 1024 * 1024; // skip anything bigger — binaries/lockfiles, not skill logic

// [pattern, human-readable reason]. Deliberately few and high-signal — the
// goal is catching obvious hostile intent, not linting code style.
const ZERO_WIDTH_CHARS = [
  "​", // zero-width space
  "‌", // zero-width non-joiner
  "‍", // zero-width joiner
  "⁠", // word joiner
  "﻿", // zero-width no-break space / BOM
];
const ZERO_WIDTH_PATTERN = new RegExp(ZERO_WIDTH_CHARS.join("|"));

const RULES = [
  [
    ZERO_WIDTH_PATTERN,
    "zero-width Unicode character (can hide instructions from a human reviewer skimming the file)",
  ],
  [
    /curl\s+[^\n|]*\|\s*(sh|bash|zsh)\b/i,
    "curl | sh style remote-script execution",
  ],
  [
    /wget\s+[^\n|]*\|\s*(sh|bash|zsh)\b/i,
    "wget | sh style remote-script execution",
  ],
  [
    /\bpowershell\b[^\n]*-e(nc(odedcommand)?)?\s+[A-Za-z0-9+/=]{20,}/i,
    "PowerShell -EncodedCommand with a base64 blob (common obfuscated-payload pattern)",
  ],
  [
    /\beval\s*\(\s*(atob|Buffer\.from)\s*\(/,
    "eval() of a decoded string (base64/atob) — obfuscated code execution",
  ],
  [
    /require\(['"]child_process['"]\)[\s\S]{0,80}exec(?:Sync)?\s*\(\s*[`'"][^`'"]*\$\{/,
    "child_process exec() with string interpolation — potential command injection if the interpolated value is ever untrusted input",
  ],
];

function shouldSkipDir(name) {
  return SKIP_DIRS.has(name);
}

function isProbablyText(buf) {
  const len = Math.min(buf.length, 1024);
  for (let i = 0; i < len; i++) {
    if (buf[i] === 0) return false; // NUL byte — treat as binary
  }
  return true;
}

function walk(dir, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!shouldSkipDir(entry.name)) walk(full, out);
    } else if (entry.isFile()) {
      out.push(full);
    }
  }
}

function scanFile(filePath) {
  const findings = [];
  let stat;
  try {
    stat = fs.statSync(filePath);
  } catch {
    return findings;
  }
  if (stat.size > MAX_FILE_BYTES) return findings;

  let buf;
  try {
    buf = fs.readFileSync(filePath);
  } catch {
    return findings;
  }
  if (!isProbablyText(buf)) return findings;

  const text = buf.toString("utf8");
  const lines = text.split("\n");
  for (const [pattern, reason] of RULES) {
    lines.forEach((line, idx) => {
      if (pattern.test(line)) {
        findings.push({ file: filePath, line: idx + 1, reason });
      }
    });
  }
  return findings;
}

function scanDir(targetDir) {
  const files = [];
  walk(targetDir, files);
  const findings = [];
  for (const file of files) {
    findings.push(...scanFile(file));
  }
  return findings;
}

if (require.main === module) {
  const target = process.argv[2];
  if (!target) {
    console.error(
      "Usage: node scripts/scan-skill.js <path-to-skill-or-plugin-dir>",
    );
    process.exit(2);
  }
  if (!fs.existsSync(target)) {
    console.error(`Path not found: ${target}`);
    process.exit(2);
  }
  const findings = scanDir(target);
  if (findings.length === 0) {
    console.log(`No suspicious patterns found in ${target}.`);
    process.exit(0);
  }
  console.error(`${findings.length} suspicious pattern(s) found in ${target}:`);
  for (const f of findings) {
    console.error(`  ${f.file}:${f.line} — ${f.reason}`);
  }
  console.error(
    "\nThis is an advisory scan, not proof of malice — review each finding yourself before deciding.",
  );
  process.exit(1);
}

module.exports = { scanDir, scanFile, RULES };
