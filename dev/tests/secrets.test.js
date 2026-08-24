// base_project:managed
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execSync } = require("node:child_process");

function tmpHome() {
  const h = fs.mkdtempSync(path.join(os.tmpdir(), "bp-secrets-home-"));
  execSync(`node dev/scripts/config-store.js --init`, {
    env: { ...process.env, AGENTS_HOME: h },
    encoding: "utf8",
  });
  return h;
}

test("secrets plaintext invariant: fails when plaintext API_KEY in canonical, passes when encrypted", () => {
  const home = tmpHome();
  const mcpPath = path.join(home, "mcp", "mcp.json");
  // write plaintext secret
  fs.writeFileSync(
    mcpPath,
    JSON.stringify(
      {
        mcpServers: {
          test: {
            command: "npx",
            args: [],
            env: { OPENAI_API_KEY: "sk-plaintext1234567890" },
          },
        },
      },
      null,
      2,
    ),
    "utf8",
  );
  let failed = false;
  try {
    execSync(`node dev/scripts/secrets.js --check --project "${home}"`, {
      env: { ...process.env, AGENTS_HOME: home },
      encoding: "utf8",
    });
  } catch (e) {
    failed = true;
    assert.equal(e.status, 1);
  }
  assert.ok(failed, "should fail on plaintext");
  // encrypt and re-check should pass
  const enc = execSync(
    `node dev/scripts/secrets.js --encrypt "sk-plaintext1234567890"`,
    { env: { ...process.env, AGENTS_HOME: home }, encoding: "utf8" },
  )
    .toString()
    .trim();
  assert.ok(enc.startsWith("age1"));
  // write encrypted
  fs.writeFileSync(
    mcpPath,
    JSON.stringify(
      {
        mcpServers: {
          test: { command: "npx", args: [], env: { OPENAI_API_KEY: enc } },
        },
      },
      null,
      2,
    ),
    "utf8",
  );
  execSync(`node dev/scripts/secrets.js --check --project "${home}"`, {
    env: { ...process.env, AGENTS_HOME: home },
    encoding: "utf8",
  });
  // decrypt round-trip
  const dec = execSync(`node dev/scripts/secrets.js --decrypt "${enc}"`, {
    env: { ...process.env, AGENTS_HOME: home },
    encoding: "utf8",
  })
    .toString()
    .trim();
  assert.equal(dec, "sk-plaintext1234567890");
  fs.rmSync(home, { recursive: true, force: true });
});

test("secrets encrypt/decrypt round-trip with thrown-away keypair", () => {
  const home = tmpHome();
  const val = "my-secret-value-123";
  const enc = execSync(`node dev/scripts/secrets.js --encrypt "${val}"`, {
    env: { ...process.env, AGENTS_HOME: home },
    encoding: "utf8",
  })
    .toString()
    .trim();
  const dec = execSync(`node dev/scripts/secrets.js --decrypt "${enc}"`, {
    env: { ...process.env, AGENTS_HOME: home },
    encoding: "utf8",
  })
    .toString()
    .trim();
  assert.equal(dec, val);
  assert.ok(fs.existsSync(path.join(home, "keys", "age.txt")));
  fs.rmSync(home, { recursive: true, force: true });
});
