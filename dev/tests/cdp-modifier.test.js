// base_project:managed
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const smoke = require("../scripts/cdp-smoke.js");

const repoRoot = path.resolve(__dirname, "..", "..");

// GOALS 18: `cdp` is a word added to /execgoals or /fixproject, not a command. The procedure lives in
// one reference file read only when the word is present; each host cites its own runtime's copy.
const REFERENCE = {
  claude: "~/.claude/base_project/references/cdp-verification.md",
  opencode: "~/.config/opencode/base_project/references/cdp-verification.md",
  codex: "~/.codex/base_project/references/cdp-verification.md",
};

const HOSTS = [];
for (const command of ["execgoals", "fixproject"]) {
  HOSTS.push(
    {
      name: `claude ${command}`,
      command,
      dense: true,
      file: ["source", "claude", "commands", `${command}.md`],
      runtime: "claude",
    },
    {
      name: `opencode dense ${command}`,
      command,
      dense: true,
      file: ["source", "opencode", "command", `${command}.md`],
      runtime: "opencode",
    },
    {
      name: `opencode lite ${command}`,
      command,
      lite: true,
      file: ["source", "opencode", "command-lite", `${command}.md`],
      runtime: "opencode",
    },
    {
      name: `codex ${command}`,
      command,
      file: ["source", "codex", "skills", command, "SKILL.md"],
      runtime: "codex",
    },
  );
}

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, ...relativePath), "utf8");
}

function collapse(text) {
  return text.replace(/\s+/g, " ");
}

// The CDP-mode step: its first line plus the indented continuation lines that follow it.
function cdpSteps(content) {
  const lines = content.split("\n");
  const found = [];
  lines.forEach((line, index) => {
    if (!/^(\d+[a-z]\. |STEP \d+[a-z] — )\*{0,2}CDP mode/.test(line)) return;
    let end = index + 1;
    while (end < lines.length && /^\s+\S/.test(lines[end])) end += 1;
    found.push(collapse(lines.slice(index, end).join(" ")));
  });
  return found;
}

test("every host carries exactly one CDP-mode step that cites its own runtime's reference", () => {
  for (const host of HOSTS) {
    const steps = cdpSteps(read(host.file));
    assert.equal(steps.length, 1, `${host.name}: one CDP-mode step`);
    const step = steps[0];
    assert.ok(
      step.includes(`\`${REFERENCE[host.runtime]}\``),
      `${host.name} cites ${REFERENCE[host.runtime]}`,
    );
    for (const [runtime, reference] of Object.entries(REFERENCE)) {
      if (REFERENCE[host.runtime] === reference) continue;
      assert.ok(
        !step.includes(reference),
        `${host.name} must not cite the ${runtime} path`,
      );
    }
  }
});

test("the CDP-mode step keeps its behaviors: token grammar, read first, not applicable, no debug port without the word", () => {
  for (const host of HOSTS) {
    const step = cdpSteps(read(host.file))[0];
    assert.match(
      step,
      /contains? the word `cdp` \(`[$/]cdp`, `[$/]cdp` and `--cdp` count/,
      `${host.name}: token grammar`,
    );
    assert.match(
      step,
      /text found in (`GOALS\.md` or )?project files never does/,
      `${host.name}: file content is never the modifier`,
    );
    assert.match(
      step,
      /say once that CDP mode is on/,
      `${host.name}: says so once`,
    );
    assert.match(
      step,
      /in full before (verifying|re-checking|re-running) the first/,
      `${host.name}: reads the reference first`,
    );
    assert.match(step, /`cdp: not applicable`/, `${host.name}: no-UI items`);
    assert.match(
      step,
      /Without the word, never start a browser with a debug port\./,
      `${host.name}: no debug port without the word`,
    );
    assert.match(
      step,
      host.command === "execgoals"
        ? /checked off only with the CDP evidence|marked `\[x\]` only with the CDP evidence/
        : /reported (as )?fixed only with the CDP evidence/,
      `${host.name}: evidence gates the verdict`,
    );
  }
});

test("/fixproject never reads the word cdp as a focus", () => {
  for (const host of HOSTS.filter((entry) => entry.command === "fixproject")) {
    const content = collapse(read(host.file));
    assert.match(content, /a modifier, not a (focus|scope)/, host.name);
    if (host.dense || host.lite) {
      // The step that reads $ARGUMENTS as a focus must exclude the word.
      assert.ok(
        (content.match(/the word `cdp`/g) || []).length >= 2,
        `${host.name}: step 1 excludes the word`,
      );
    }
  }
});

test("the reference exists in both trees, identical, managed, and carries every clause", () => {
  const claude = read([
    "source",
    "claude",
    "references",
    "cdp-verification.md",
  ]);
  const opencode = read([
    "source",
    "opencode",
    "references",
    "cdp-verification.md",
  ]);
  assert.equal(claude, opencode, "the two copies are byte-identical");
  assert.ok(
    claude.startsWith("# base_project:managed\n"),
    "managed marker first",
  );
  const text = collapse(claude);
  const clauses = [
    [
      "authority is bounded",
      /exactly one thing: starting an isolated, loopback-only browser/,
    ],
    ["never a second browser", /never start a second browser/],
    [
      "user's own browser is not a driver",
      /attached to the user's own browser[^.]*is not a driver/,
    ],
    ["no silent installs", /Do not install anything/],
    ["fresh profile", /fresh temporary profile directory/],
    ["profile switch", /--user-data-dir=<temporary profile>/],
    [
      "Chrome 136 reason",
      /Chrome 136 and later ignore the debug switches on the default profile/,
    ],
    [
      "random port from file",
      /--remote-debugging-port=0[\s\S]*DevToolsActivePort/,
    ],
    [
      "no wide bind",
      /Never add `--disable-web-security` or a `--remote-debugging-address`/,
    ],
    [
      "sandbox flag is conditional",
      /`--no-sandbox` only where the platform forces it/,
    ],
    ["loopback check", /listens on loopback only \(`127\.0\.0\.1` or `::1`\)/],
    ["no ss assumption", /do not assume `ss` exists/],
    [
      "a long TMPDIR crashes Chrome",
      /`TMPDIR` is longer than \d+ characters[^.]*start it with `TMPDIR=\/tmp`/,
    ],
    [
      "evidence as text",
      /accessibility or DOM snapshot[\s\S]*console messages[\s\S]*failed network requests/,
    ],
    ["no desktop screenshot", /never a desktop screenshot/],
    ["cleanup on every outcome", /Clean up on every outcome/],
    ["cleanup survives failure", /`finally`, `trap`/],
    ["whole process tree", /whole browser process tree/],
    ["port confirmed closed", /debug port no longer answers/],
    ["no-UI items", /`cdp: not applicable`/],
    ["real profile excluded", /user's real or default browser profile/],
    ["no real credentials", /never[\s\S]*enter real credentials/i],
    ["user's language", /in the language they are writing in/],
  ];
  for (const [name, pattern] of clauses) {
    assert.match(text, pattern, `reference clause: ${name}`);
  }
  assert.doesNotMatch(
    claude,
    /\b(não|para|você|projeto|arquivo)\b/,
    "the reference is English (model-executed text)",
  );
});

test("the modifier is not a command: no cdp command, skill or menu line exists", () => {
  for (const file of [
    ["source", "claude", "commands", "cdp.md"],
    ["source", "opencode", "command", "cdp.md"],
    ["source", "opencode", "command-lite", "cdp.md"],
    ["source", "codex", "skills", "cdp"],
  ]) {
    assert.equal(
      fs.existsSync(path.join(repoRoot, ...file)),
      false,
      file.join("/"),
    );
  }
  for (const menu of [
    ["source", "claude", "references", "command-menu.md"],
    ["source", "opencode", "references", "command-menu.md"],
    ["source", "codex", "references", "command-menu.md"],
  ]) {
    assert.doesNotMatch(
      read(menu),
      /^- `[/$]cdp`/m,
      `${menu.join("/")} lists no cdp command`,
    );
  }
});

// ---------------------------------------------------------------------------
// Registration: menus, README, ARCHITECTURE (C18.12, C18.13).
// ---------------------------------------------------------------------------

test("every menu says /execgoals and /fixproject accept cdp, on the lines they already had", () => {
  for (const [menu, prefix] of [
    [["source", "claude", "references", "command-menu.md"], "/"],
    [["source", "opencode", "references", "command-menu.md"], "/"],
    [["source", "codex", "references", "command-menu.md"], "$"],
  ]) {
    const lines = read(menu).split("\n");
    for (const name of ["execgoals", "fixproject"]) {
      const line = lines.find((candidate) =>
        candidate.startsWith(`- \`${prefix}${name}\``),
      );
      assert.ok(line, `${menu.join("/")} lists ${prefix}${name}`);
      assert.match(line, /modificador `cdp`/, `${menu.join("/")} ${name}`);
      assert.match(
        line,
        /navegador real e isolado/,
        `${menu.join("/")} ${name}`,
      );
    }
  }
});

test("README and ARCHITECTURE register the modifier and keep the command count at 21", () => {
  const readme = read(["README.md"]);
  const architecture = read(["ARCHITECTURE.md"]);
  const row = (text, name) =>
    text.split("\n").find((line) => line.startsWith(`| \`/${name}\` |`));

  for (const name of ["execgoals", "fixproject"]) {
    assert.match(row(readme, name) || "", /`cdp`/, `README /${name} row`);
    assert.match(
      row(architecture, name) || "",
      /modificador `cdp`/,
      `ARCHITECTURE /${name} row`,
    );
  }
  assert.match(
    readme,
    /\*\*Modifiers\.\*\* A modifier is a word you add to a command/,
  );
  assert.match(readme, /\| \*\*Debug ports are opt-in\*\* \|/);
  const unreleased = readme.slice(readme.indexOf("### Unreleased"));
  assert.match(
    unreleased.slice(0, unreleased.indexOf("\n### ", 5)),
    /`cdp` modifier/,
    "the changelog's Unreleased section mentions it",
  );

  // One regex per engine: the three references lists each name the reference.
  for (const [engine, pattern] of [
    [
      "Claude",
      /→ ~\/\.claude\/base_project\/references\/ \([\s\S]{0,300}?cdp-verification\.md/,
    ],
    [
      "opencode",
      /→ ~\/\.config\/opencode\/base_project\/references\/ \([\s\S]{0,200}?cdp-verification\.md/,
    ],
    [
      "Codex",
      /→ ~\/\.codex\/base_project\/references\/ +\([^\n]*cdp-verification\.md/,
    ],
  ]) {
    assert.match(architecture, pattern, `${engine} references list`);
  }
  assert.match(architecture, /cdp-smoke\.js +← CLI/, "the scripts map");
  assert.match(architecture, /`cdp-modifier\.test\.js` —/, "the tests list");
  const ci = architecture.slice(architecture.indexOf("## 9. CI"));
  assert.match(
    ci.slice(0, ci.indexOf("\n## 10.")),
    /npm run smoke:cdp/,
    "the CI description",
  );
  assert.match(
    architecture,
    /Um \*\*modificador\*\* é um token que o comando-hospedeiro reconhece/,
    "the pattern is named",
  );
  assert.match(
    architecture,
    /o mesmo mecanismo que `\/newgoal \/repertoire` já usa/,
    "and tied to the precedent",
  );

  // A modifier is not a command: no document counts a 22nd one.
  for (const [name, text] of [
    ["README", readme],
    ["ARCHITECTURE", architecture],
  ]) {
    assert.doesNotMatch(
      text,
      /\b22 (comandos|commands|skills|workflows)\b/,
      `${name} still counts 21`,
    );
  }
  assert.match(architecture, /## 4\. Os 21 comandos/);
});

// ---------------------------------------------------------------------------
// The smoke's loopback classifier, from the listing format of each OS (C18.8).
// ---------------------------------------------------------------------------

const PORT = 9222; // 0x2406

const PROC_TCP_HEADER =
  "  sl  local_address rem_address   st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode\n";
const procLine = (index, local, state = "0A") =>
  `   ${index}: ${local} 00000000:0000 ${state} 00000000:00000000 00:00000000 00000000     0        0 1${index} 1 0000000000000000 100 0 0 10 0\n`;

test("linux /proc/net/tcp: a loopback listener is accepted, a wildcard or LAN listener is not", () => {
  const loopbackOnly =
    PROC_TCP_HEADER +
    procLine(0, "0100007F:2406") +
    procLine(1, "0100007F:2406", "01") + // an established connection is not a listener
    procLine(2, "00000000:1F90"); // a wildcard listener, but on another port
  assert.deepEqual(smoke.parseProcNet(loopbackOnly, PORT), ["127.0.0.1"]);
  assert.equal(
    smoke.isLoopbackOnly(smoke.parseProcNet(loopbackOnly, PORT)),
    true,
  );

  const wildcard = loopbackOnly + procLine(3, "00000000:2406");
  assert.deepEqual(smoke.parseProcNet(wildcard, PORT), [
    "127.0.0.1",
    "0.0.0.0",
  ]);
  assert.equal(smoke.isLoopbackOnly(smoke.parseProcNet(wildcard, PORT)), false);

  const lan = PROC_TCP_HEADER + procLine(0, "0100A8C0:2406"); // 192.168.0.1
  assert.deepEqual(smoke.parseProcNet(lan, PORT), ["192.168.0.1"]);
  assert.equal(smoke.isLoopbackOnly(smoke.parseProcNet(lan, PORT)), false);
});

test("linux /proc/net/tcp6: ::1 and mapped 127.0.0.1 are loopback; :: and a mapped LAN address are not", () => {
  const tcp6 = (...locals) =>
    PROC_TCP_HEADER +
    locals.map((local, index) => procLine(index, local)).join("");
  const loopback = tcp6(
    "00000000000000000000000001000000:2406",
    "0000000000000000FFFF00000100007F:2406",
  );
  assert.deepEqual(smoke.parseProcNet(loopback, PORT), ["::1", "127.0.0.1"]);
  assert.equal(smoke.isLoopbackOnly(smoke.parseProcNet(loopback, PORT)), true);

  const wildcard = tcp6("00000000000000000000000000000000:2406");
  assert.deepEqual(smoke.parseProcNet(wildcard, PORT), ["::"]);
  assert.equal(smoke.isLoopbackOnly(smoke.parseProcNet(wildcard, PORT)), false);

  const mappedLan = tcp6("0000000000000000FFFF00000100A8C0:2406");
  assert.deepEqual(smoke.parseProcNet(mappedLan, PORT), ["192.168.0.1"]);
  assert.equal(
    smoke.isLoopbackOnly(smoke.parseProcNet(mappedLan, PORT)),
    false,
  );
});

test("macOS netstat: 127.0.0.1.9222 and ::1.9222 are loopback; *.9222 is not", () => {
  const header =
    "Active Internet connections (including servers)\n" +
    "Proto Recv-Q Send-Q  Local Address          Foreign Address        (state)\n";
  const loopback =
    header +
    "tcp4       0      0  127.0.0.1.9222         *.*                    LISTEN\n" +
    "tcp6       0      0  ::1.9222               *.*                    LISTEN\n" +
    "tcp4       0      0  127.0.0.1.9222         127.0.0.1.52000        ESTABLISHED\n" +
    "tcp4       0      0  192.168.0.5.9222       10.0.0.9.52001         ESTABLISHED\n" + // a connection, not a listener
    "tcp4       0      0  *.8080                 *.*                    LISTEN\n";
  assert.deepEqual(smoke.parseNetstat(loopback, PORT), ["127.0.0.1", "::1"]);
  assert.equal(smoke.isLoopbackOnly(smoke.parseNetstat(loopback, PORT)), true);

  const wildcard =
    loopback +
    "tcp46      0      0  *.9222                 *.*                    LISTEN\n";
  assert.deepEqual(smoke.parseNetstat(wildcard, PORT), [
    "127.0.0.1",
    "::1",
    "*",
  ]);
  assert.equal(smoke.isLoopbackOnly(smoke.parseNetstat(wildcard, PORT)), false);
});

test("windows netstat: 127.0.0.1:9222 and [::1]:9222 are loopback; 0.0.0.0:9222 and [::]:9222 are not", () => {
  const header =
    "\r\nActive Connections\r\n\r\n  Proto  Local Address          Foreign Address        State\r\n";
  const loopback =
    header +
    "  TCP    0.0.0.0:135            0.0.0.0:0              LISTENING\r\n" +
    "  TCP    127.0.0.1:9222         0.0.0.0:0              LISTENING\r\n" +
    "  TCP    [::1]:9222             [::]:0                 LISTENING\r\n" +
    "  TCP    127.0.0.1:9222         127.0.0.1:50000        ESTABLISHED\r\n" +
    "  TCP    192.168.0.5:9222       10.0.0.9:50001         ESTABLISHED\r\n"; // a connection, not a listener
  assert.deepEqual(smoke.parseNetstat(loopback, PORT), ["127.0.0.1", "::1"]);
  assert.equal(smoke.isLoopbackOnly(smoke.parseNetstat(loopback, PORT)), true);

  const wildcard =
    loopback +
    "  TCP    0.0.0.0:9222           0.0.0.0:0              LISTENING\r\n" +
    "  TCP    [::]:9222              [::]:0                 LISTENING\r\n";
  assert.deepEqual(smoke.parseNetstat(wildcard, PORT), [
    "127.0.0.1",
    "::1",
    "0.0.0.0",
    "::",
  ]);
  assert.equal(smoke.isLoopbackOnly(smoke.parseNetstat(wildcard, PORT)), false);
});

test("no listener at all is never 'loopback only', and addresses classify as documented", () => {
  assert.equal(smoke.isLoopbackOnly([]), false);
  for (const address of [
    "127.0.0.1",
    "127.1.2.3",
    "::1",
    "localhost",
    "::ffff:127.0.0.1",
  ]) {
    assert.equal(smoke.classifyAddress(address), "loopback", address);
  }
  for (const address of ["0.0.0.0", "::", "*", "[::]"]) {
    assert.equal(smoke.classifyAddress(address), "wildcard", address);
  }
  for (const address of [
    "192.168.0.1",
    "10.0.0.5",
    "::ffff:192.168.0.1",
    "fe80::1%lo0",
  ]) {
    assert.equal(smoke.classifyAddress(address), "other", address);
  }
});

test("the smoke starts Chrome exactly as the reference documents", () => {
  const reference = collapse(
    read(["source", "claude", "references", "cdp-verification.md"]),
  );
  const args = smoke.chromeArgs({
    profile: "/tmp/profile",
    url: "http://127.0.0.1:1/",
    noSandbox: false,
  });
  for (const flag of [
    "--headless=new",
    "--remote-debugging-port=0",
    "--no-first-run",
    "--no-default-browser-check",
  ]) {
    assert.ok(args.includes(flag), `smoke passes ${flag}`);
    assert.ok(reference.includes(flag), `reference documents ${flag}`);
  }
  assert.ok(args.includes("--user-data-dir=/tmp/profile"));
  assert.equal(args.at(-1), "http://127.0.0.1:1/");
  assert.ok(!args.includes("--no-sandbox"), "the sandbox stays on by default");
  assert.ok(
    smoke
      .chromeArgs({ profile: "/p", url: "u", noSandbox: true })
      .includes("--no-sandbox"),
  );
  for (const forbidden of [
    "--disable-web-security",
    "--remote-debugging-address",
  ]) {
    assert.ok(!args.some((arg) => arg.startsWith(forbidden)), forbidden);
  }
});

test("the smoke starts Chrome with a short TMPDIR past the length the reference names", () => {
  const reference = collapse(
    read(["source", "claude", "references", "cdp-verification.md"]),
  );
  assert.ok(
    reference.includes(`longer than ${smoke.TMPDIR_LIMIT} characters`),
    "the reference names the same limit the smoke applies",
  );
  const long = { HOME: "/home/u", TMPDIR: "x".repeat(smoke.TMPDIR_LIMIT + 1) };
  const overridden = smoke.browserEnv(long, "linux");
  assert.equal(overridden.TMPDIR, "/tmp");
  assert.equal(overridden.HOME, "/home/u", "everything else is kept");
  assert.equal(
    long.TMPDIR.length,
    smoke.TMPDIR_LIMIT + 1,
    "the caller's environment is not mutated",
  );
  assert.equal(smoke.browserEnv(long, "darwin").TMPDIR, "/tmp");
  const atLimit = { TMPDIR: "x".repeat(smoke.TMPDIR_LIMIT) };
  assert.equal(smoke.browserEnv(atLimit, "linux"), atLimit, "at the limit");
  const unset = { HOME: "/home/u" };
  assert.equal(smoke.browserEnv(unset, "linux"), unset, "no TMPDIR");
  assert.equal(
    smoke.browserEnv(long, "win32"),
    long,
    "Windows has no socket path limit",
  );
});

test("the browser is spawned with its own process group, the short TMPDIR and a readable stderr", () => {
  const want = {
    chrome: "/opt/chrome",
    profile: "/tmp/profile",
    url: "http://127.0.0.1:1/",
    noSandbox: false,
  };
  const long = { TMPDIR: "x".repeat(smoke.TMPDIR_LIMIT + 1) };
  const posix = smoke.spawnSpec(want, long, "linux");
  assert.equal(posix.command, "/opt/chrome");
  assert.deepEqual(posix.args, smoke.chromeArgs(want));
  assert.equal(posix.options.env?.TMPDIR, "/tmp");
  assert.equal(
    posix.options.detached,
    true,
    "a process group of its own, or the tree kill cannot reach the renderers",
  );
  assert.deepEqual(posix.options.stdio, ["ignore", "ignore", "pipe"]);
  const windows = smoke.spawnSpec(want, long, "win32");
  assert.equal(windows.options.detached, false);
  assert.equal(windows.options.env, long);
  assert.equal(windows.options.windowsHide, true);
});

test("Chrome is found through CHROME_BIN first, then the standard paths of each OS", () => {
  const only = (wanted) => (candidate) => candidate === wanted;
  assert.equal(
    smoke.findChrome(
      { CHROME_BIN: "/opt/chrome" },
      "linux",
      only("/opt/chrome"),
    ),
    "/opt/chrome",
  );
  assert.equal(
    smoke.findChrome(
      { PATH: "/usr/local/bin:/usr/bin" },
      "linux",
      only("/usr/bin/chromium"),
    ),
    "/usr/bin/chromium",
  );
  assert.equal(
    smoke.findChrome(
      {},
      "darwin",
      only("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"),
    ),
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  );
  const windowsChrome =
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  assert.equal(
    smoke.findChrome(
      { ProgramFiles: "C:\\Program Files" },
      "win32",
      only(windowsChrome),
    ),
    windowsChrome,
  );
  assert.equal(
    smoke.findChrome({ PATH: "/usr/bin" }, "linux", () => false),
    null,
  );
  assert.equal(
    smoke.findChrome(
      { CHROME_BIN: "/opt/a", CHROME_PATH: "/opt/b", PATH: "/usr/bin" },
      "linux",
      () => true,
    ),
    "/opt/a",
    "CHROME_BIN wins over CHROME_PATH and the PATH names when all exist",
  );
  assert.equal(
    smoke.findChrome(
      { CHROME_BIN: "/opt/missing", CHROME_PATH: "/opt/b", PATH: "/usr/bin" },
      "linux",
      (candidate) => candidate !== "/opt/missing",
    ),
    "/opt/b",
    "CHROME_PATH is tried before the PATH names",
  );
});
