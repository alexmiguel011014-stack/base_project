// base_project:managed

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..", "..");
const sourceRoot = path.join(repoRoot, "source");
const codexRoot = path.resolve(
  process.env.BASE_PROJECT_CODEX_ROOT ||
    process.env.CODEX_HOME ||
    path.join(os.homedir(), ".codex"),
);
const agentsRoot = path.resolve(
  process.env.BASE_PROJECT_AGENTS_ROOT ||
    process.env.AGENTS_HOME ||
    path.join(os.homedir(), ".agents"),
);
const claudeRoot = path.resolve(
  process.env.BASE_PROJECT_CLAUDE_ROOT || path.join(os.homedir(), ".claude"),
);

const START = "<!-- base_project:start -->";
const END = "<!-- base_project:end -->";

function ok(message) {
  process.stdout.write(`  OK  ${message}\n`);
}

function warn(message) {
  process.stderr.write(`  !!  ${message}\n`);
}

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, "utf8");
}

function syncManaged(source, destination) {
  if (
    fs.existsSync(destination) &&
    !read(destination).includes("base_project:managed")
  ) {
    warn(`${destination} exists and is not managed by base_project; skipped`);
    return false;
  }
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
  return true;
}

function walkMarkdown(root) {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(root, entry.name);
    return entry.isDirectory()
      ? walkMarkdown(absolute)
      : entry.name.endsWith(".md")
        ? [absolute]
        : [];
  });
}

function syncInstructionBlock() {
  const destination = path.join(codexRoot, "AGENTS.md");
  const body = read(path.join(sourceRoot, "codex", "AGENTS.md")).trimEnd();
  const block = `${START}\n${body}\n${END}`;
  const existing = fs.existsSync(destination) ? read(destination) : "";
  const start = existing.indexOf(START);
  const end = start >= 0 ? existing.indexOf(END, start) : -1;
  let updated;
  if (start >= 0 && end >= 0) {
    updated = `${existing.slice(0, start)}${block}${existing.slice(end + END.length)}`;
  } else if (existing.trim()) {
    updated = `${existing.trimEnd()}\n\n${block}\n`;
  } else {
    updated = `${block}\n`;
  }
  write(destination, updated);
  ok("Codex AGENTS.md managed block");
}

function syncSkills() {
  const skillsSource = path.join(sourceRoot, "codex", "skills");
  let count = 0;
  for (const entry of fs.readdirSync(skillsSource, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const source = path.join(skillsSource, entry.name, "SKILL.md");
    if (!fs.existsSync(source)) continue;
    const destination = path.join(agentsRoot, "skills", entry.name, "SKILL.md");
    if (syncManaged(source, destination)) count += 1;
  }
  ok(`${count} Codex skills synchronized`);
}

// Deleting a skill from source/codex/skills/ only stops it being *installed* — a machine
// that installed an older base_project keeps the old skill directory on disk. Explicit,
// named prune list, same pattern install.ps1/install.sh use for stale commands. Only
// removes a skill dir whose SKILL.md still carries the managed marker, so a user's own
// same-named skill is left alone.
function pruneStaleSkills() {
  const staleNames = ["newproject"];
  for (const name of staleNames) {
    const skillFile = path.join(agentsRoot, "skills", name, "SKILL.md");
    if (!fs.existsSync(skillFile)) continue;
    if (read(skillFile).includes("base_project:managed")) {
      fs.rmSync(path.join(agentsRoot, "skills", name), {
        recursive: true,
        force: true,
      });
      ok(`removed stale Codex skill: ${name}`);
    } else {
      warn(
        `Kept ${skillFile} - not managed by base_project (looks like your own file)`,
      );
    }
  }
}

function syncAgents() {
  const source = path.join(sourceRoot, "codex", "agents");
  let count = 0;
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".toml")) continue;
    if (
      syncManaged(
        path.join(source, entry.name),
        path.join(codexRoot, "agents", entry.name),
      )
    ) {
      count += 1;
    }
  }
  ok(`${count} Codex agents synchronized`);
}

function syncReferences() {
  const destinationRoot = path.join(codexRoot, "base_project", "references");
  const sharedRoot = path.join(sourceRoot, "claude", "references");
  let count = 0;
  for (const source of walkMarkdown(sharedRoot)) {
    const relative = path.relative(sharedRoot, source);
    if (relative === "command-menu.md") continue;
    if (syncManaged(source, path.join(destinationRoot, relative))) count += 1;
  }
  const codexReferences = path.join(sourceRoot, "codex", "references");
  for (const source of walkMarkdown(codexReferences)) {
    const relative = path.relative(codexReferences, source);
    if (syncManaged(source, path.join(destinationRoot, relative))) count += 1;
  }
  ok(`${count} Codex reference documents synchronized`);
}

function syncCatalog() {
  const source = path.join(sourceRoot, "plugins.json");
  const destination = path.join(codexRoot, "base_project", "plugins.json");
  if (fs.existsSync(destination)) {
    try {
      const current = JSON.parse(read(destination));
      if (!Object.hasOwn(current, "_managed_by")) {
        warn(`${destination} is not managed by base_project; skipped`);
        return;
      }
    } catch {
      warn(`${destination} is not valid managed JSON; skipped`);
      return;
    }
  }
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
  ok("Codex plugin catalog synchronized");
}

function commandFor(file) {
  return `node "${path.join(claudeRoot, "base_project", "hooks", file).replaceAll("\\", "/")}"`;
}

function removeManaged(groups, marker) {
  return groups.filter(
    (group) =>
      !Array.isArray(group?.hooks) ||
      !group.hooks.some((hook) => String(hook?.command || "").includes(marker)),
  );
}

function syncHooks() {
  const destination = path.join(codexRoot, "hooks.json");
  let config = {};
  if (fs.existsSync(destination)) {
    try {
      config = JSON.parse(read(destination));
    } catch {
      fs.copyFileSync(destination, `${destination}.bak`);
      warn(`Invalid hooks.json backed up to ${destination}.bak`);
    }
  }
  config.hooks =
    config.hooks && typeof config.hooks === "object" ? config.hooks : {};
  for (const event of ["PostToolUse", "UserPromptSubmit", "SessionStart"]) {
    config.hooks[event] = Array.isArray(config.hooks[event])
      ? config.hooks[event]
      : [];
  }

  const add = (event, file, options = {}) => {
    const marker = `base_project/hooks/${file}`;
    config.hooks[event] = removeManaged(config.hooks[event], marker);
    config.hooks[event].push({
      ...(options.matcher ? { matcher: options.matcher } : {}),
      hooks: [
        {
          type: "command",
          command: commandFor(file),
          ...(options.async === true ? { async: true } : {}),
          ...(options.timeout ? { timeout: options.timeout } : {}),
        },
      ],
    });
  };

  add("PostToolUse", "loop-detect.js");
  add("PostToolUse", "post-edit-format.js", {
    matcher: "apply_patch|Edit|Write|MultiEdit",
  });
  add("PostToolUse", "validate-goals.js", {
    matcher: "apply_patch|Edit|Write|MultiEdit",
  });
  add("PostToolUse", "usage-log.js", { async: true });
  add("UserPromptSubmit", "usage-log.js", { async: true });
  add("SessionStart", "session-start-git-context.js", {
    matcher: "startup|resume|clear",
    timeout: 10,
  });
  write(destination, `${JSON.stringify(config, null, 2)}\n`);
  ok("Codex hooks merged; existing unrelated hooks preserved");
}

function main() {
  if (!fs.existsSync(codexRoot)) {
    warn(
      `Codex not detected at ${codexRoot}; skipped native Codex integration`,
    );
    return;
  }
  syncInstructionBlock();
  syncSkills();
  pruneStaleSkills();
  syncAgents();
  syncReferences();
  syncCatalog();
  syncHooks();
}

main();
