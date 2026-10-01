// base_project:managed
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const sourceRoot = path.join(__dirname, "..", "..", "source");

function shippedDocs(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) return shippedDocs(absolute);
    return /\.(md|toml)$/.test(entry.name) ? [absolute] : [];
  });
}

// Commands run inside the user's project, where `dev/scripts/` does not exist. Every
// script path must go through the base_project clone recorded in repo-path.txt — the
// unified-layer commands once ran `node dev/scripts/doctor.js` relative to the user's
// project and only worked inside this repository (dev/auditoria-2026-09-24.md, F4).
test("shipped commands never run base_project scripts relative to the current project", () => {
  const offenders = [];
  for (const file of shippedDocs(sourceRoot)) {
    const lines = fs.readFileSync(file, "utf8").split("\n");
    for (const [index, line] of lines.entries()) {
      for (const match of line.matchAll(/(?<!>\/)dev\/scripts\/[\w.-]+\.js/g)) {
        offenders.push(
          `${path.relative(sourceRoot, file)}:${index + 1}: ${match[0]}`,
        );
      }
    }
  }
  assert.deepEqual(offenders, []);
});

test("every command that uses the <repo> placeholder says where it comes from", () => {
  for (const file of shippedDocs(sourceRoot)) {
    const text = fs.readFileSync(file, "utf8");
    if (/<(repo|base_project-repo)>\/dev\/scripts\//.test(text)) {
      assert.match(
        text,
        /~\/\.base_project\/repo-path\.txt/,
        `${path.relative(sourceRoot, file)} uses <repo> without resolving it`,
      );
    }
  }
});
