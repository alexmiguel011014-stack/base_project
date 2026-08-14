#!/usr/bin/env bash
# base_project installer — populates GLOBAL config for Claude Code (~/.claude) and
# opencode (~/.config/opencode). Never touches any project repository.
#
# Run once after cloning. Re-run any time (e.g. after `git pull`) to pick up
# updates — it only touches the blocks/files it manages.
#
# Env overrides (for testing only, do not set for real installs):
#   CLAUDE_HOME, OPENCODE_HOME
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
SOURCE_DIR="$REPO_ROOT/source"

CLAUDE_HOME="${CLAUDE_HOME:-$HOME/.claude}"
OPENCODE_HOME="${OPENCODE_HOME:-$HOME/.config/opencode}"

MARK_START="<!-- base_project:start -->"
MARK_END="<!-- base_project:end -->"

step() { echo -e "\033[36m-> $1\033[0m"; }
ok()   { echo -e "\033[32m  OK  $1\033[0m"; }
warn() { echo -e "\033[33m  !!  $1\033[0m"; }

# ---------------------------------------------------------------------
# 1. Global CLI tools
# ---------------------------------------------------------------------
step "Checking global CLI tools..."
warn "This step is best-effort: a missing/failed tool here is skipped, not fatal - the rest of base_project doesn't depend on it."

if ! command -v gh &>/dev/null; then
    warn "GitHub CLI not found. Installing..."
    if command -v brew &>/dev/null; then brew install gh || warn "Could not install gh automatically. Install manually: https://cli.github.com/"
    elif command -v apt &>/dev/null; then sudo apt install -y gh || warn "Could not install gh automatically. Install manually: https://cli.github.com/"
    else warn "Install manually: https://cli.github.com/"; fi
else
    ok "gh"
fi

if ! command -v graphify &>/dev/null; then
    warn "graphify not found. Installing..."
    if command -v pipx &>/dev/null; then pipx install graphifyy || warn "Could not install graphify automatically."
    elif command -v pip &>/dev/null; then pip install graphifyy || warn "Could not install graphify automatically."
    else warn "Python not found. Install it, then run: pip install graphifyy"; fi
else
    ok "graphify"
fi

if ! command -v npm &>/dev/null; then
    warn "npm not found (Node.js not installed) - skipping repomix/biome/tsc. Install Node.js (https://nodejs.org) then re-run this script."
else
    for pair in "repomix:repomix" "biome:@biomejs/biome" "tsc:typescript"; do
        cmd="${pair%%:*}"; pkg="${pair##*:}"
        if ! command -v "$cmd" &>/dev/null; then
            warn "$pkg not found. Installing globally..."
            npm install -g "$pkg" || warn "Could not install $pkg automatically. Install manually later: npm install -g $pkg"
        else
            ok "$cmd"
        fi
    done
fi

# ---------------------------------------------------------------------
# 2. Ensure global directories exist
# ---------------------------------------------------------------------
CLAUDE_AGENTS_DIR="$CLAUDE_HOME/agents"
CLAUDE_COMMANDS_DIR="$CLAUDE_HOME/commands"
OPENCODE_AGENT_DIR="$OPENCODE_HOME/agent"
OPENCODE_COMMAND_DIR="$OPENCODE_HOME/command"
CLAUDE_HOOKS_DIR="$CLAUDE_HOME/base_project/hooks"
CLAUDE_SCRIPTS_DIR="$CLAUDE_HOME/base_project/scripts"
CLAUDE_REFERENCES_DIR="$CLAUDE_HOME/base_project/references"
OPENCODE_REFERENCES_DIR="$OPENCODE_HOME/base_project/references"

mkdir -p "$CLAUDE_AGENTS_DIR" "$CLAUDE_COMMANDS_DIR" "$OPENCODE_AGENT_DIR" "$OPENCODE_COMMAND_DIR" \
    "$CLAUDE_HOOKS_DIR" "$CLAUDE_SCRIPTS_DIR" "$CLAUDE_REFERENCES_DIR" "$OPENCODE_REFERENCES_DIR"

# ---------------------------------------------------------------------
# 3. CLAUDE.md — inject a delimited, replaceable block
# ---------------------------------------------------------------------
step "Updating $CLAUDE_HOME/CLAUDE.md..."

CLAUDE_MD_PATH="$CLAUDE_HOME/CLAUDE.md"
BLOCK_FILE="$(mktemp)"
{
    echo "$MARK_START"
    cat "$SOURCE_DIR/CLAUDE.md"
    echo "$MARK_END"
} > "$BLOCK_FILE"

if [ -f "$CLAUDE_MD_PATH" ] && grep -qF "$MARK_START" "$CLAUDE_MD_PATH" && grep -qF "$MARK_END" "$CLAUDE_MD_PATH"; then
    UPDATED="$(mktemp)"
    awk -v start="$MARK_START" -v end="$MARK_END" -v blockfile="$BLOCK_FILE" '
        $0 == start { print_block=1; while ((getline line < blockfile) > 0) print line; close(blockfile); skip=1; next }
        skip && $0 == end { skip=0; next }
        skip { next }
        { print }
    ' "$CLAUDE_MD_PATH" > "$UPDATED"
    mv "$UPDATED" "$CLAUDE_MD_PATH"
elif [ -f "$CLAUDE_MD_PATH" ] && [ -s "$CLAUDE_MD_PATH" ]; then
    { cat "$CLAUDE_MD_PATH"; echo ""; cat "$BLOCK_FILE"; } > "${CLAUDE_MD_PATH}.tmp"
    mv "${CLAUDE_MD_PATH}.tmp" "$CLAUDE_MD_PATH"
else
    cp "$BLOCK_FILE" "$CLAUDE_MD_PATH"
fi
rm -f "$BLOCK_FILE"
ok "CLAUDE.md (your own content outside the base_project block is untouched)"

# ---------------------------------------------------------------------
# 3b. settings.json — merge base_project's hooks, preserve the rest
# ---------------------------------------------------------------------
step "Updating $CLAUDE_HOME/settings.json..."

SETTINGS_PATH="$CLAUDE_HOME/settings.json"

if command -v jq &>/dev/null; then
    if [ -f "$SETTINGS_PATH" ] && jq empty "$SETTINGS_PATH" 2>/dev/null; then
        BASE_SETTINGS="$(cat "$SETTINGS_PATH")"
    else
        if [ -f "$SETTINGS_PATH" ]; then
            cp "$SETTINGS_PATH" "$SETTINGS_PATH.bak"
            warn "settings.json could not be parsed - backed up to settings.json.bak and starting fresh"
        fi
        BASE_SETTINGS='{}'
    fi

    # Loop-detection and auto-format hooks — real behavior, not just logging
    # (see ROADMAP.md item 2). Synchronous (not async): loop-detect's stderr
    # warning and post-edit-format's write need to land before the next tool
    # call, but neither ever throws or blocks (swallow-all-errors by design).
    LOOP_DETECT_PATH="$CLAUDE_HOOKS_DIR/loop-detect.js"
    LOOP_DETECT_MARKER="base_project/hooks/loop-detect.js"
    POST_EDIT_FORMAT_PATH="$CLAUDE_HOOKS_DIR/post-edit-format.js"
    POST_EDIT_FORMAT_MARKER="base_project/hooks/post-edit-format.js"
    BASE_SETTINGS="$(cat "$SETTINGS_PATH")"
    echo "$BASE_SETTINGS" | jq \
        --arg loopCmd "node \"$LOOP_DETECT_PATH\"" \
        --arg loopMarker "$LOOP_DETECT_MARKER" \
        --arg formatCmd "node \"$POST_EDIT_FORMAT_PATH\"" \
        --arg formatMarker "$POST_EDIT_FORMAT_MARKER" \
        '.hooks.PostToolUse = ((.hooks.PostToolUse // []) | map(select((.hooks // []) | map(.command // "") | any(contains($loopMarker)) | not))) + [{"hooks": [{"type": "command", "command": $loopCmd, "async": false}]}]
         | .hooks.PostToolUse = ((.hooks.PostToolUse // []) | map(select((.hooks // []) | map(.command // "") | any(contains($formatMarker)) | not))) + [{"hooks": [{"type": "command", "command": $formatCmd, "async": false}]}]' \
        > "$SETTINGS_PATH"
    ok "settings.json (loop-detect + post-edit-format hooks merged)"

    # SessionStart hook — injects compact git context (branch, uncommitted
    # changes, recent commits) at the start of a session, so Claude doesn't
    # spend tool calls rediscovering state on every fresh start/resume/clear.
    # Matcher deliberately excludes "compact"/"fork".
    SESSION_START_GIT_PATH="$CLAUDE_HOOKS_DIR/session-start-git-context.js"
    SESSION_START_GIT_MARKER="base_project/hooks/session-start-git-context.js"
    BASE_SETTINGS="$(cat "$SETTINGS_PATH")"
    echo "$BASE_SETTINGS" | jq \
        --arg cmd "node \"$SESSION_START_GIT_PATH\"" \
        --arg marker "$SESSION_START_GIT_MARKER" \
        '.hooks.SessionStart = ((.hooks.SessionStart // []) | map(select((.hooks // []) | map(.command // "") | any(contains($marker)) | not))) + [{"matcher": "startup|resume|clear", "hooks": [{"type": "command", "command": $cmd, "timeout": 10}]}]' \
        > "$SETTINGS_PATH"
    ok "settings.json (session-start git-context hook merged)"

    # Informational only - never written automatically. fallbackModel is a real
    # Claude Code setting (up to 3 backup models tried in order on a 529/overload
    # error) that reduces mid-task failures for zero cost - but it's a behavior
    # change (which model answers your prompt), so base_project only suggests it,
    # same as the plugin auto-suggestion rule: mention once, never silently edit
    # settings.json for the user.
    if ! jq -e 'has("fallbackModel")' "$SETTINGS_PATH" &>/dev/null; then
        warn "Tip: settings.json has no 'fallbackModel' set. Consider adding e.g. \"fallbackModel\": [\"claude-sonnet-4-6\", \"claude-haiku-4-5\"] to $SETTINGS_PATH - Claude Code tries these in order if the primary model is overloaded. Not applied automatically."
    fi
else
    warn "'jq' not found - skipping settings.json hook merge. Install jq, then re-run this script."
fi

# ---------------------------------------------------------------------
# 4. opencode.jsonc — inline instructions + mcp servers, preserve the rest
# ---------------------------------------------------------------------
step "Updating $OPENCODE_HOME/opencode.jsonc..."

OPENCODE_CONFIG_PATH="$OPENCODE_HOME/opencode.jsonc"
INSTRUCTIONS_PATH="$SOURCE_DIR/opencode-instructions.md"
MCP_SRC_PATH_FOR_CONFIG="$SOURCE_DIR/opencode/mcp.json"

if command -v jq &>/dev/null; then
    if [ -f "$OPENCODE_CONFIG_PATH" ] && jq empty "$OPENCODE_CONFIG_PATH" 2>/dev/null; then
        BASE_JSON="$(cat "$OPENCODE_CONFIG_PATH")"
    else
        if [ -f "$OPENCODE_CONFIG_PATH" ]; then
            cp "$OPENCODE_CONFIG_PATH" "$OPENCODE_CONFIG_PATH.bak"
            warn "opencode.jsonc could not be parsed (comments or invalid JSON) - backed up to opencode.jsonc.bak and starting fresh"
        fi
        BASE_JSON='{"$schema": "https://opencode.ai/config.json"}'
    fi
    # opencode's schema wants "instructions" as an array of paths, and "mcp" as a map
    # of server name -> { type: "local", command: [...] } | { type: "remote", url,
    # headers }, defined inline - not a pointer to an external file (that "mcp.file"
    # shape doesn't exist in opencode's config schema and fails validation on startup).
    echo "$BASE_JSON" | jq \
        --arg instr "$INSTRUCTIONS_PATH" \
        --argjson mcpsrc "$(cat "$MCP_SRC_PATH_FOR_CONFIG")" \
        '.instructions = [$instr]
         | .mcp = ($mcpsrc.mcpServers | with_entries(
             .value = (
               if .value.type == "remote" then
                 {type: "remote", url: .value.url} + (if .value.headers then {headers: .value.headers} else {} end)
               else
                 {type: "local", command: ([.value.command] + (.value.args // []))} + (if .value.env then {environment: .value.env} else {} end)
               end
             )
           ))' \
        > "$OPENCODE_CONFIG_PATH"
    ok "opencode.jsonc (instructions + mcp servers inlined, other keys preserved)"
else
    warn "'jq' not found - skipping opencode.jsonc merge. Install jq, then re-run this script."
fi

# ---------------------------------------------------------------------
# 5. Copy managed agent/command files (skip anything not ours)
# ---------------------------------------------------------------------
sync_managed() {
    local src="$1" dest="$2"
    if [ -f "$dest" ] && ! grep -qF "base_project:managed" "$dest"; then
        warn "Skipped $(basename "$dest") - exists and isn't managed by base_project (looks like your own file)"
        return
    fi
    cp "$src" "$dest"
    ok "$(basename "$dest")"
}

step "Syncing opencode agents/commands..."
for f in "$SOURCE_DIR"/opencode/agent/*.md; do
    sync_managed "$f" "$OPENCODE_AGENT_DIR/$(basename "$f")"
done
for f in "$SOURCE_DIR"/opencode/command/*.md; do
    sync_managed "$f" "$OPENCODE_COMMAND_DIR/$(basename "$f")"
done

step "Syncing Claude Code agents/commands..."
for f in "$SOURCE_DIR"/claude/agents/*.md; do
    sync_managed "$f" "$CLAUDE_AGENTS_DIR/$(basename "$f")"
done
for f in "$SOURCE_DIR"/claude/commands/*.md; do
    sync_managed "$f" "$CLAUDE_COMMANDS_DIR/$(basename "$f")"
done

# ---------------------------------------------------------------------
# 6. MCP servers for Claude Code (via CLI) - opencode already got these
#    inlined into opencode.jsonc directly in step 4, above.
# ---------------------------------------------------------------------
MCP_SRC_PATH="$SOURCE_DIR/opencode/mcp.json"

step "Registering MCP servers with Claude Code (if 'claude' CLI is available)..."
if command -v claude &>/dev/null && command -v jq &>/dev/null; then
    for name in $(jq -r '.mcpServers | keys[]' "$MCP_SRC_PATH"); do
        # Remove any existing registration first so re-running the installer always applies the
        # latest catalog values instead of erroring on "already exists" for unrelated servers.
        # This is expected to "fail" (nothing to remove) on a first install, so it must never
        # abort under `set -e` - mirrors the try/catch around the equivalent call in install.ps1.
        claude mcp remove "$name" --scope user &>/dev/null || true
        is_remote="$(jq -r ".mcpServers[\"$name\"].type // empty" "$MCP_SRC_PATH")"
        if [ "$is_remote" = "remote" ]; then
            url="$(jq -r ".mcpServers[\"$name\"].url" "$MCP_SRC_PATH")"
            header_args=()
            while IFS= read -r kv; do [ -n "$kv" ] && header_args+=(--header "$kv"); done \
                < <(jq -r ".mcpServers[\"$name\"].headers // {} | to_entries[] | \"\(.key): \(.value)\"" "$MCP_SRC_PATH")
            if claude mcp add --scope user --transport http "$name" "$url" "${header_args[@]}" &>/dev/null; then
                ok "registered '$name'"
            else
                warn "Could not auto-register '$name'. Add manually: claude mcp add --scope user --transport http $name $url ${header_args[*]}"
            fi
            continue
        fi
        cmd="$(jq -r ".mcpServers[\"$name\"].command" "$MCP_SRC_PATH")"
        # while-read instead of mapfile: mapfile needs bash 4+, macOS ships bash 3.2 by default.
        args=()
        while IFS= read -r line; do [ -n "$line" ] && args+=("$line"); done \
            < <(jq -r ".mcpServers[\"$name\"].args[]?" "$MCP_SRC_PATH")
        env_args=()
        while IFS= read -r kv; do [ -n "$kv" ] && env_args+=(--env "$kv"); done \
            < <(jq -r ".mcpServers[\"$name\"].env // {} | to_entries[] | \"\(.key)=\(.value)\"" "$MCP_SRC_PATH")
        if claude mcp add --scope user "$name" "${env_args[@]}" -- "$cmd" "${args[@]}" &>/dev/null; then
            ok "registered '$name'"
        else
            warn "Could not auto-register '$name'. Add manually: claude mcp add --scope user $name ${env_args[*]} -- $cmd ${args[*]}"
        fi
    done
else
    warn "'claude' CLI or 'jq' not found - skipping Claude Code MCP registration."
fi

# ---------------------------------------------------------------------
# 7. Plugin catalog - read by the /plugins command in either engine
# ---------------------------------------------------------------------
step "Syncing plugin catalog..."
PLUGINS_SRC_PATH="$SOURCE_DIR/plugins.json"

sync_catalog() {
    local dest="$1"
    mkdir -p "$(dirname "$dest")"
    local is_ours=1
    if [ -f "$dest" ] && command -v jq &>/dev/null; then
        if ! jq -e 'has("_managed_by")' "$dest" &>/dev/null; then
            is_ours=0
        fi
    fi
    if [ "$is_ours" -eq 1 ]; then
        cp "$PLUGINS_SRC_PATH" "$dest"
        ok "plugins.json -> $dest"
    else
        warn "Skipped $dest - exists and isn't managed by base_project."
    fi
}

sync_catalog "$CLAUDE_HOME/base_project/plugins.json"
sync_catalog "$OPENCODE_HOME/base_project/plugins.json"

# ---------------------------------------------------------------------
# 8b. Hooks with real behavior (loop-detect, post-edit-format) - see ROADMAP item 2
# ---------------------------------------------------------------------
step "Syncing hook scripts..."
HOOKS_SRC_DIR="$SOURCE_DIR/hooks"
if [ -d "$HOOKS_SRC_DIR" ]; then
    for f in "$HOOKS_SRC_DIR"/*.js; do
        sync_managed "$f" "$CLAUDE_HOOKS_DIR/$(basename "$f")"
    done
fi

# ---------------------------------------------------------------------
# 8c. scan-skill.js - lightweight pre-trust scan, used by /plugins before
# installing a third-party skill. See ROADMAP item 10.
# ---------------------------------------------------------------------
SCAN_SKILL_SRC="$SCRIPT_DIR/scan-skill.js"
if [ -f "$SCAN_SKILL_SRC" ]; then
    sync_managed "$SCAN_SKILL_SRC" "$CLAUDE_SCRIPTS_DIR/scan-skill.js"
fi

# ---------------------------------------------------------------------
# 8d. Reference docs read by commands (project-standards.md, command-menu.md)
# ---------------------------------------------------------------------
step "Syncing reference docs..."
CLAUDE_REFERENCES_SRC_DIR="$SOURCE_DIR/claude/references"
OPENCODE_REFERENCES_SRC_DIR="$SOURCE_DIR/opencode/references"
if [ -d "$CLAUDE_REFERENCES_SRC_DIR" ]; then
    for f in "$CLAUDE_REFERENCES_SRC_DIR"/*.md; do
        sync_managed "$f" "$CLAUDE_REFERENCES_DIR/$(basename "$f")"
    done
fi
if [ -d "$OPENCODE_REFERENCES_SRC_DIR" ]; then
    for f in "$OPENCODE_REFERENCES_SRC_DIR"/*.md; do
        sync_managed "$f" "$OPENCODE_REFERENCES_DIR/$(basename "$f")"
    done
fi

# ---------------------------------------------------------------------
# 9. Record the repo path (used to check for base_project updates later)
# ---------------------------------------------------------------------
STATE_DIR="$HOME/.base_project"
mkdir -p "$STATE_DIR"
printf '%s' "$REPO_ROOT" > "$STATE_DIR/repo-path.txt"
ok "recorded repo path for update checks: $REPO_ROOT"

echo ""
echo -e "\033[32mbase_project installed. Open any project - Claude Code and opencode now load these rules automatically.\033[0m"
echo -e "\033[32mNothing was written inside any project repository.\033[0m"
