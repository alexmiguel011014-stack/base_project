#!/usr/bin/env node
// base_project:managed
// Deterministic pre-check layer for /designreview, run before any LLM judgment pass.
// Two checks with a single objectively-correct answer, so spending a model call on them
// would be wasted: WCAG contrast ratio between two colors, and a minimum tap-target size.
// See GOALS.md's "Methodology" section (base_project repo root) for why this layer exists.
//
// Usage:
//   node contrast-check.js --fg <hex> --bg <hex> [--large]
//   node contrast-check.js --target <widthxheight>
// Exit code 0 = every check run passed. Exit code 1 = at least one failed.

const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

function normalizeHex(hex) {
  const m = HEX_RE.exec(String(hex).trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  return h.toLowerCase();
}

function relativeLuminance(hex) {
  const h = normalizeHex(hex);
  if (!h) return null;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const linear = (c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  const [rl, gl, bl] = [r, g, b].map(linear);
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
}

// WCAG relative-luminance contrast formula (2.x, unchanged from 2.0 through 2.2).
function contrastRatio(fgHex, bgHex) {
  const l1 = relativeLuminance(fgHex);
  const l2 = relativeLuminance(bgHex);
  if (l1 === null || l2 === null) return null;
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// SC 1.4.3 Contrast (Minimum, AA) and 1.4.6 Contrast (Enhanced, AAA).
function contrastVerdict(ratio, large) {
  if (ratio === null) return null;
  const aaThreshold = large ? 3 : 4.5;
  const aaaThreshold = large ? 4.5 : 7;
  return {
    ratio: Math.round(ratio * 100) / 100,
    aa: ratio >= aaThreshold,
    aaa: ratio >= aaaThreshold,
  };
}

// WCAG 2.2 SC 2.5.8 sets the AA floor at 24x24 CSS px; this check uses the stricter
// 44x44 baseline (SC 2.5.5 AAA, also Apple HIG's touch-target guidance) since a target
// that only clears the 24px floor still reads as cramped in practice.
const MIN_TARGET_PX = 44;

function targetSizeVerdict(widthPx, heightPx) {
  return {
    width: widthPx,
    height: heightPx,
    passes: widthPx >= MIN_TARGET_PX && heightPx >= MIN_TARGET_PX,
    minimum: MIN_TARGET_PX,
  };
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const key = argv[i].slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        out[key] = next;
        i++;
      } else {
        out[key] = true;
      }
    }
  }
  return out;
}

if (require.main === module) {
  const args = parseArgs(process.argv.slice(2));
  let failed = false;
  let ranSomething = false;

  if (args.fg && args.bg) {
    ranSomething = true;
    const ratio = contrastRatio(args.fg, args.bg);
    if (ratio === null) {
      console.error(
        `Invalid color(s): --fg ${args.fg} --bg ${args.bg} (expected hex, e.g. #111111)`,
      );
      process.exit(2);
    }
    const v = contrastVerdict(ratio, Boolean(args.large));
    console.log(
      `Contrast ratio ${v.ratio}:1 — AA ${v.aa ? "pass" : "FAIL"}, AAA ${v.aaa ? "pass" : "FAIL"}${args.large ? " (large-text thresholds)" : ""}`,
    );
    if (!v.aa) failed = true;
  }

  if (args.target) {
    ranSomething = true;
    const m = /^(\d+)x(\d+)$/i.exec(String(args.target));
    if (!m) {
      console.error(
        `Invalid --target ${args.target} (expected WIDTHxHEIGHT, e.g. 32x32)`,
      );
      process.exit(2);
    }
    const v = targetSizeVerdict(Number(m[1]), Number(m[2]));
    console.log(
      `Tap target ${v.width}x${v.height}px — ${v.passes ? "pass" : "FAIL"} (minimum ${v.minimum}x${v.minimum}px)`,
    );
    if (!v.passes) failed = true;
  }

  if (!ranSomething) {
    console.error(
      "Usage: node contrast-check.js --fg <hex> --bg <hex> [--large] | --target <WxH>",
    );
    process.exit(2);
  }

  process.exit(failed ? 1 : 0);
}

module.exports = {
  contrastRatio,
  contrastVerdict,
  targetSizeVerdict,
  normalizeHex,
  relativeLuminance,
  parseArgs,
};
