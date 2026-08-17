const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  contrastRatio,
  contrastVerdict,
  targetSizeVerdict,
  normalizeHex,
  parseArgs,
} = require("../scripts/contrast-check.js");

test("normalizeHex expands 3-digit hex and strips the leading #", () => {
  assert.equal(normalizeHex("#fff"), "ffffff");
  assert.equal(normalizeHex("abc"), "aabbcc");
  assert.equal(normalizeHex("#111111"), "111111");
});

test("normalizeHex rejects malformed input", () => {
  assert.equal(normalizeHex("not-a-color"), null);
  assert.equal(normalizeHex("#12345"), null);
});

test("contrastRatio: pure black on white is exactly 21:1, the WCAG maximum", () => {
  assert.equal(contrastRatio("#000000", "#ffffff"), 21);
});

test("contrastRatio: identical colors are 1:1, the WCAG minimum", () => {
  assert.equal(contrastRatio("#336699", "#336699"), 1);
});

test("contrastRatio: order of fg/bg doesn't matter", () => {
  assert.equal(
    contrastRatio("#000000", "#ffffff"),
    contrastRatio("#ffffff", "#000000"),
  );
});

test("contrastRatio returns null for an invalid color", () => {
  assert.equal(contrastRatio("nope", "#ffffff"), null);
});

test("contrastVerdict: 21:1 passes AA and AAA for normal and large text", () => {
  const v = contrastVerdict(21, false);
  assert.equal(v.aa, true);
  assert.equal(v.aaa, true);
});

test("contrastVerdict: 4.5:1 passes normal-text AA but not AAA", () => {
  const v = contrastVerdict(4.5, false);
  assert.equal(v.aa, true);
  assert.equal(v.aaa, false);
});

test("contrastVerdict: large-text thresholds are lower than normal-text", () => {
  const normal = contrastVerdict(3.5, false);
  const large = contrastVerdict(3.5, true);
  assert.equal(normal.aa, false);
  assert.equal(large.aa, true);
});

test("targetSizeVerdict: 44x44 passes the minimum, 43x44 fails", () => {
  assert.equal(targetSizeVerdict(44, 44).passes, true);
  assert.equal(targetSizeVerdict(43, 44).passes, false);
});

test("parseArgs: reads --key value pairs and bare flags", () => {
  const args = parseArgs(["--fg", "#111", "--bg", "#fff", "--large"]);
  assert.deepEqual(args, { fg: "#111", bg: "#fff", large: true });
});

test("parseArgs: a flag immediately followed by another flag is boolean", () => {
  const args = parseArgs(["--large", "--fg", "#111"]);
  assert.equal(args.large, true);
  assert.equal(args.fg, "#111");
});
