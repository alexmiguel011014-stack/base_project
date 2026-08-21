const assert = require("node:assert");
const test = require("node:test");

const {
  parseLedgerLines,
  resolveProjectRoot,
  isContainerOnly,
  projectName,
  localDay,
  activeDurationMs,
  formatDuration,
  extractFilePath,
  buildSource,
} = require("../scripts/diary-source.js");

/**
 * Fake git resolver so these tests never shell out to a real repository — the
 * grouping logic is what's under test, not git itself.
 */
function fakeGit({ repos = {}, commits = {} } = {}) {
  return {
    toplevel(dir) {
      for (const root of Object.keys(repos)) {
        if (dir === root || dir.startsWith(`${root}/`)) return root;
      }
      return null;
    },
    remoteName(dir) {
      return repos[dir] || null;
    },
    commits(dir) {
      return commits[dir] || [];
    },
  };
}

const iso = (s) => new Date(s).toISOString();

test("parseLedgerLines: a malformed line does not take down its neighbours", () => {
  const events = parseLedgerLines([
    JSON.stringify({ ts: "2026-08-17T10:00:00.000Z", cwd: "C:/a" }),
    "{ this is not json",
    "",
    JSON.stringify({ ts: "2026-08-17T10:05:00.000Z", cwd: "C:/a" }),
  ]);
  assert.strictEqual(events.length, 2);
});

test("parseLedgerLines: an entry without a timestamp is not an event", () => {
  assert.strictEqual(
    parseLedgerLines([JSON.stringify({ cwd: "C:/a" })]).length,
    0,
  );
});

test("resolveProjectRoot: a nested working directory resolves to the repository root", () => {
  const git = fakeGit({ repos: { "D:/Proj/ERP_HK": "ERP" } });
  assert.strictEqual(
    resolveProjectRoot("D:/Proj/ERP_HK/ERP/modules", git),
    "D:/Proj/ERP_HK",
  );
  assert.strictEqual(
    resolveProjectRoot("D:/Proj/ERP_HK", git),
    "D:/Proj/ERP_HK",
  );
});

test("resolveProjectRoot: a directory with no repository stands on its own", () => {
  const git = fakeGit();
  assert.strictEqual(resolveProjectRoot("D:/Proj/IC", git), "D:/Proj/IC");
});

test("resolveProjectRoot: backslashes normalize, so Windows paths group with themselves", () => {
  const git = fakeGit();
  assert.strictEqual(resolveProjectRoot("D:\\Proj\\IC", git), "D:/Proj/IC");
});

test("isContainerOnly: the folder that merely holds projects is not itself a project", () => {
  const git = fakeGit({ repos: { "D:/Proj/TunelSSH": "TunelSSH" } });
  const roots = ["D:/Proj", "D:/Proj/TunelSSH"];
  assert.strictEqual(isContainerOnly("D:/Proj", roots, git), true);
  assert.strictEqual(isContainerOnly("D:/Proj/TunelSSH", roots, git), false);
});

test("isContainerOnly: a repository that contains another observed path is still a project", () => {
  const git = fakeGit({ repos: { "D:/Proj/ERP_HK": "ERP" } });
  const roots = ["D:/Proj/ERP_HK", "D:/Proj/ERP_HK/ERP"];
  assert.strictEqual(isContainerOnly("D:/Proj/ERP_HK", roots, git), false);
});

test("projectName: the remote's repository name wins over the folder name", () => {
  const git = fakeGit({ repos: { "D:/Proj/ERP_HK": "ERP" } });
  assert.strictEqual(projectName("D:/Proj/ERP_HK", git), "ERP");
});

test("projectName: with no remote, the folder name is all there is", () => {
  assert.strictEqual(projectName("D:/Proj/IC", fakeGit()), "IC");
});

// The ledger stores `input` as a JSON string and truncates long ones. Reading it as an
// object silently found zero files against the real ledger — caught only by running the
// script on real data, which is why these cases exist.
test("extractFilePath: reads the path out of the JSON string the ledger actually stores", () => {
  const input = JSON.stringify({
    file_path: "D:\\Proj\\App\\src\\index.js",
    old_string: "x",
  });
  assert.strictEqual(extractFilePath(input), "D:\\Proj\\App\\src\\index.js");
});

test("extractFilePath: still finds the path when truncation broke the JSON", () => {
  const truncated =
    '{"file_path":"D:\\\\Proj\\\\App\\\\.gitignore","old_string":"<<<<<<< Updated up';
  assert.strictEqual(extractFilePath(truncated), "D:\\Proj\\App\\.gitignore");
});

test("extractFilePath: a notebook path counts as an edited file too", () => {
  assert.strictEqual(
    extractFilePath(JSON.stringify({ notebook_path: "/a/b.ipynb" })),
    "/a/b.ipynb",
  );
});

test("extractFilePath: an object input still works, and junk yields null not a crash", () => {
  assert.strictEqual(extractFilePath({ file_path: "/a/b.js" }), "/a/b.js");
  assert.strictEqual(extractFilePath('{"command":"ls"}'), null);
  assert.strictEqual(extractFilePath("not json at all"), null);
  assert.strictEqual(extractFilePath(null), null);
  assert.strictEqual(extractFilePath(42), null);
});

test("localDay: grouping follows the local calendar, not UTC", () => {
  const d = new Date(2026, 7, 17, 21, 30, 0);
  assert.strictEqual(localDay(d.toISOString()), "2026-08-17");
});

test("localDay: an unparseable timestamp yields no day rather than a wrong one", () => {
  assert.strictEqual(localDay("not-a-date"), null);
});

test("activeDurationMs: a single event is zero, because a moment is not a duration", () => {
  assert.strictEqual(activeDurationMs([iso("2026-08-17T10:00:00Z")]), 0);
  assert.strictEqual(activeDurationMs([]), 0);
});

test("activeDurationMs: consecutive gaps under the cap are summed", () => {
  const ms = activeDurationMs([
    iso("2026-08-17T10:00:00Z"),
    iso("2026-08-17T10:10:00Z"),
    iso("2026-08-17T10:25:00Z"),
  ]);
  assert.strictEqual(ms, 25 * 60 * 1000);
});

test("activeDurationMs: an idle gap over 30 minutes is excluded, not counted", () => {
  const ms = activeDurationMs([
    iso("2026-08-17T10:00:00Z"),
    iso("2026-08-17T10:10:00Z"),
    iso("2026-08-17T18:00:00Z"),
    iso("2026-08-17T18:05:00Z"),
  ]);
  assert.strictEqual(ms, 15 * 60 * 1000);
});

test("activeDurationMs: out-of-order timestamps are sorted before measuring", () => {
  const ms = activeDurationMs([
    iso("2026-08-17T10:20:00Z"),
    iso("2026-08-17T10:00:00Z"),
  ]);
  assert.strictEqual(ms, 20 * 60 * 1000);
});

test("formatDuration: renders as HH:MM, the shape the diary's summary table uses", () => {
  assert.strictEqual(formatDuration(0), "00:00");
  assert.strictEqual(formatDuration(90 * 60 * 1000), "01:30");
  assert.strictEqual(formatDuration(30 * 60 * 60 * 1000), "30:00");
});

test("buildSource: work either side of midnight lands on two different days", () => {
  const git = fakeGit({ repos: { "D:/Proj/App": "App" } });
  const before = new Date(2026, 7, 17, 23, 50, 0).toISOString();
  const after = new Date(2026, 7, 18, 0, 5, 0).toISOString();
  const result = buildSource(
    [
      { ts: before, cwd: "D:/Proj/App", tool: "Edit", session: "s1" },
      { ts: after, cwd: "D:/Proj/App", tool: "Edit", session: "s1" },
    ],
    { git },
  );
  assert.strictEqual(result.projects.length, 1);
  assert.deepStrictEqual(
    result.projects[0].days.map((d) => d.date),
    ["2026-08-17", "2026-08-18"],
  );
});

test("buildSource: nested paths collapse into one project, container is dropped", () => {
  const git = fakeGit({ repos: { "D:/Proj/ERP_HK": "ERP" } });
  const result = buildSource(
    [
      { ts: iso("2026-08-17T10:00:00Z"), cwd: "D:/Proj/ERP_HK", tool: "Read" },
      {
        ts: iso("2026-08-17T10:05:00Z"),
        cwd: "D:/Proj/ERP_HK/ERP/modules",
        tool: "Edit",
      },
      { ts: iso("2026-08-17T10:06:00Z"), cwd: "D:/Proj", tool: "Bash" },
    ],
    { git },
  );
  assert.strictEqual(result.projects.length, 1);
  assert.strictEqual(result.projects[0].name, "ERP");
});

test("buildSource: commits merge into the same day structure as ledger events", () => {
  const git = fakeGit({
    repos: { "D:/Proj/App": "App" },
    commits: {
      "D:/Proj/App": [
        { date: "2026-08-17", hash: "abc1234", subject: "feat: thing" },
        { date: "2026-08-19", hash: "def5678", subject: "fix: other" },
      ],
    },
  });
  const result = buildSource(
    [
      {
        ts: new Date(2026, 7, 17, 10, 0, 0).toISOString(),
        cwd: "D:/Proj/App",
        tool: "Edit",
      },
    ],
    { git },
  );
  const days = result.projects[0].days;
  assert.deepStrictEqual(
    days.map((d) => d.date),
    ["2026-08-17", "2026-08-19"],
  );
  assert.strictEqual(days[0].commits.length, 1);
  assert.strictEqual(days[1].commits[0].subject, "fix: other");
  assert.strictEqual(days[1].events, 0);
});

test("buildSource: a non-repository project still gets its days, just no commits", () => {
  const result = buildSource(
    [
      {
        ts: new Date(2026, 7, 17, 10, 0, 0).toISOString(),
        cwd: "D:/Proj/IC",
        tool: "Edit",
      },
    ],
    { git: fakeGit() },
  );
  assert.strictEqual(result.projects[0].isRepo, false);
  assert.strictEqual(result.projects[0].days[0].commits.length, 0);
});

test("buildSource: --since drops earlier days from both sources", () => {
  const git = fakeGit({
    repos: { "D:/Proj/App": "App" },
    commits: {
      "D:/Proj/App": [
        { date: "2026-08-10", hash: "old1234", subject: "old commit" },
      ],
    },
  });
  const result = buildSource(
    [
      {
        ts: new Date(2026, 7, 10, 10, 0, 0).toISOString(),
        cwd: "D:/Proj/App",
        tool: "Edit",
      },
      {
        ts: new Date(2026, 7, 18, 10, 0, 0).toISOString(),
        cwd: "D:/Proj/App",
        tool: "Edit",
      },
    ],
    { git, since: "2026-08-15" },
  );
  assert.deepStrictEqual(
    result.projects[0].days.map((d) => d.date),
    ["2026-08-18"],
  );
});

test("buildSource: file paths and prompts are collected for the narrative pass", () => {
  const git = fakeGit({ repos: { "D:/Proj/App": "App" } });
  const result = buildSource(
    [
      {
        ts: new Date(2026, 7, 17, 10, 0, 0).toISOString(),
        cwd: "D:/Proj/App",
        tool: "Edit",
        input: JSON.stringify({ file_path: "D:\\Proj\\App\\src\\index.js" }),
      },
      {
        ts: new Date(2026, 7, 17, 10, 1, 0).toISOString(),
        cwd: "D:/Proj/App",
        prompt: "arruma o login",
      },
    ],
    { git },
  );
  const day = result.projects[0].days[0];
  assert.deepStrictEqual(day.files, ["D:/Proj/App/src/index.js"]);
  assert.deepStrictEqual(day.prompts, ["arruma o login"]);
});
