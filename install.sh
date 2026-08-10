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

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
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
CLAUDE_DASHBOARD_DIR="$CLAUDE_HOME/base_project/dashboard"
OPENCODE_DASHBOARD_DIR="$OPENCODE_HOME/base_project/dashboard"
OPENCODE_PLUGINS_DIR="$OPENCODE_HOME/plugins"

mkdir -p "$CLAUDE_AGENTS_DIR" "$CLAUDE_COMMANDS_DIR" "$OPENCODE_AGENT_DIR" "$OPENCODE_COMMAND_DIR" \
    "$CLAUDE_DASHBOARD_DIR" "$OPENCODE_DASHBOARD_DIR" "$OPENCODE_PLUGINS_DIR"

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
# 3b. settings.json — merge the usage-dashboard PostToolUse hook, preserve the rest
# ---------------------------------------------------------------------
step "Updating $CLAUDE_HOME/settings.json..."

SETTINGS_PATH="$CLAUDE_HOME/settings.json"
HOOK_LOGGER_PATH="$CLAUDE_DASHBOARD_DIR/log-usage.js"
HOOK_MARKER="base_project/dashboard/log-usage.js"

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
    echo "$BASE_SETTINGS" | jq \
        --arg cmd "node \"$HOOK_LOGGER_PATH\"" \
        --arg marker "$HOOK_MARKER" \
        '.hooks.PostToolUse = ((.hooks.PostToolUse // []) | map(select((.hooks // []) | map(.command // "") | any(contains($marker)) | not))) + [{"hooks": [{"type": "command", "command": $cmd, "async": true}]}]' \
        > "$SETTINGS_PATH"
    ok "settings.json (usage-dashboard hook merged, your other hooks/settings untouched)"
else
    warn "'jq' not found - skipping settings.json hook merge. Install jq, then re-run this script."
fi

# ---------------------------------------------------------------------
# 4. opencode.jsonc — link instructions + mcp file, preserve the rest
# ---------------------------------------------------------------------
step "Updating $OPENCODE_HOME/opencode.jsonc..."

OPENCODE_CONFIG_PATH="$OPENCODE_HOME/opencode.jsonc"
INSTRUCTIONS_PATH="$SOURCE_DIR/opencode-instructions.md"
MCP_DEST_PATH="$OPENCODE_HOME/mcp.json"

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
    echo "$BASE_JSON" | jq --arg instr "$INSTRUCTIONS_PATH" --arg mcp "$MCP_DEST_PATH" \
        '.instructions = $instr | .mcp = {file: $mcp}' > "$OPENCODE_CONFIG_PATH"
    ok "opencode.jsonc (instructions + mcp linked, other keys preserved)"
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
# 6. MCP servers - opencode (file-based) + Claude Code (via CLI)
# ---------------------------------------------------------------------
step "Syncing MCP servers for opencode..."
MCP_SRC_PATH="$SOURCE_DIR/opencode/mcp.json"

MCP_IS_OURS=1
if [ -f "$MCP_DEST_PATH" ] && command -v jq &>/dev/null; then
    if ! jq -e 'has("_managed_by")' "$MCP_DEST_PATH" &>/dev/null; then
        MCP_IS_OURS=0
    fi
fi

if [ "$MCP_IS_OURS" -eq 1 ]; then
    cp "$MCP_SRC_PATH" "$MCP_DEST_PATH"
    ok "mcp.json -> $MCP_DEST_PATH"
else
    warn "Skipped mcp.json - exists and isn't managed by base_project. Merge new servers manually if wanted."
fi

step "Registering MCP servers with Claude Code (if 'claude' CLI is available)..."
if command -v claude &>/dev/null && command -v jq &>/dev/null; then
    for name in $(jq -r '.mcpServers | keys[]' "$MCP_SRC_PATH"); do
        # Remove any existing registration first so re-running the installer always applies the
        # latest catalog values instead of erroring on "already exists" for unrelated servers.
        claude mcp remove "$name" --scope user &>/dev/null
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
# 8. Usage dashboard - shared logger, server, launcher, and the opencode plugin
# ---------------------------------------------------------------------
step "Syncing usage dashboard files..."
DASHBOARD_SRC_DIR="$SOURCE_DIR/dashboard"

for f in "$DASHBOARD_SRC_DIR"/*.js; do
    base="$(basename "$f")"
    [ "$base" = "opencode-usage-logger.js" ] && continue
    sync_managed "$f" "$CLAUDE_DASHBOARD_DIR/$base"
    sync_managed "$f" "$OPENCODE_DASHBOARD_DIR/$base"
done
sync_managed "$DASHBOARD_SRC_DIR/opencode-usage-logger.js" "$OPENCODE_PLUGINS_DIR/opencode-usage-logger.js"

# ---------------------------------------------------------------------
# 9. Record the repo path so the dashboard can check for updates later
# ---------------------------------------------------------------------
STATE_DIR="$HOME/.base_project"
mkdir -p "$STATE_DIR"
printf '%s' "$REPO_ROOT" > "$STATE_DIR/repo-path.txt"
ok "recorded repo path for update checks: $REPO_ROOT"

echo ""
echo -e "\033[32mbase_project installed. Open any project - Claude Code and opencode now load these rules automatically.\033[0m"
echo -e "\033[32mNothing was written inside any project repository.\033[0m"
