// base_project:managed
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  formatGitContext,
} = require("../../source/hooks/session-start-git-context.js");

test("formatGitContext: returns null for a clean tree in sync with upstream", () => {
  const result = formatGitContext({
    branch: "main",
    statusPorcelain: "",
    diffStat: "",
    recentLog: "abc123 initial",
    aheadBehind: "0\t0",
  });
  assert.equal(result, null);
});

test("formatGitContext: returns null when there's no upstream and nothing uncommitted", () => {
  const result = formatGitContext({
    branch: "main",
    statusPorcelain: "",
    diffStat: "",
    recentLog: "abc123 initial",
    aheadBehind: "",
  });
  assert.equal(result, null);
});

test("formatGitContext: reports uncommitted changes with file count and diffstat", () => {
  const result = formatGitContext({
    branch: "main",
    statusPorcelain: " M a.js\n?? b.js\n",
    diffStat: " a.js | 2 +-",
    recentLog: "abc123 initial",
    aheadBehind: "0\t0",
  });
  assert.match(result, /branch: main/);
  assert.match(result, /2 file\(s\) with uncommitted changes/);
  assert.match(result, /a\.js \| 2 \+-/);
});

test("formatGitContext: reports ahead/behind divergence", () => {
  const result = formatGitContext({
    branch: "main",
    statusPorcelain: "",
    diffStat: "",
    recentLog: "abc123 initial",
    aheadBehind: "3\t2",
  });
  assert.match(result, /3 commit\(s\) ahead of upstream, not pushed/);
  assert.match(result, /2 commit\(s\) behind upstream, not pulled/);
});

test("formatGitContext: only reports the ahead side when behind is 0", () => {
  const result = formatGitContext({
    branch: "main",
    statusPorcelain: "",
    diffStat: "",
    recentLog: "",
    aheadBehind: "3\t0",
  });
  assert.match(result, /3 commit\(s\) ahead/);
  assert.doesNotMatch(result, /behind/);
});

test("formatGitContext: includes recent commit log when both uncommitted and divergence are present", () => {
  const result = formatGitContext({
    branch: "feature-x",
    statusPorcelain: " M x.js\n",
    diffStat: " x.js | 1 +",
    recentLog: "abc123 fix bug\ndef456 add feature",
    aheadBehind: "1\t0",
  });
  assert.match(result, /Recent commits:/);
  assert.match(result, /abc123 fix bug/);
});
