<#
.SYNOPSIS
  base_project installer — populates GLOBAL config for Claude Code (~/.claude) and
  opencode (~/.config/opencode). Never touches any project repository.

.DESCRIPTION
  Run this once after cloning base_project. Re-run any time (e.g. after `git pull`)
  to pick up updates — it only touches the blocks/files it manages, so your own
  customizations elsewhere in those directories are left alone.

.PARAMETER ClaudeHome
  Override for ~/.claude (used for testing; do not set for real installs).

.PARAMETER OpencodeHome
  Override for ~/.config/opencode (used for testing; do not set for real installs).
#>

param(
    [string]$ClaudeHome = (Join-Path $HOME ".claude"),
    [string]$OpencodeHome = (Join-Path $HOME ".config\opencode")
)

$ErrorActionPreference = "Stop"

$repoRoot  = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$sourceDir = Join-Path $repoRoot "source"

$MARK_START = "<!-- base_project:start -->"
$MARK_END   = "<!-- base_project:end -->"

function Write-Step($msg) { Write-Host "-> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "  OK  $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "  !!  $msg" -ForegroundColor Yellow }

# PS 5.1's Get-Content mis-decodes BOM-less UTF-8 as the system codepage, and
# Set-Content -Encoding utf8 always adds a BOM (breaks strict JSON parsers).
# These two helpers read/write real BOM-less UTF-8 regardless of PS version.
function Read-Utf8NoBom([string]$Path) {
    return [System.IO.File]::ReadAllText($Path, [System.Text.Encoding]::UTF8)
}
function Write-Utf8NoBom([string]$Path, [string]$Content) {
    [System.IO.File]::WriteAllText($Path, $Content, [System.Text.UTF8Encoding]::new($false))
}

# ---------------------------------------------------------------------
# 1. Global CLI tools (host-wide, installed once regardless of project)
# ---------------------------------------------------------------------
Write-Step "Checking global CLI tools..."
Write-Warn "This step is best-effort: a missing/failed tool here is skipped, not fatal - the rest of base_project doesn't depend on it."

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Warn "GitHub CLI not found. Installing..."
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        try {
            winget install --id GitHub.cli --silent --accept-source-agreements --accept-package-agreements
        } catch {
            Write-Warn "Could not install gh automatically. Install manually: https://cli.github.com/"
        }
    } else {
        Write-Warn "winget not found. Install gh manually: https://cli.github.com/"
    }
} else {
    Write-Ok "gh"
}

if (-not (Get-Command graphify -ErrorAction SilentlyContinue)) {
    Write-Warn "graphify not found. Installing..."
    try {
        if (Get-Command pipx -ErrorAction SilentlyContinue) {
            pipx install graphifyy
        } elseif (Get-Command pip -ErrorAction SilentlyContinue) {
            pip install graphifyy
        } else {
            Write-Warn "Python/pipx not found. Install Python (https://python.org) then run: pip install graphifyy"
        }
    } catch {
        Write-Warn "Could not install graphify automatically. Install manually later: pip install graphifyy"
    }
} else {
    Write-Ok "graphify"
}

$npmTools = @(
    @{ Cmd = "repomix"; Pkg = "repomix" },
    @{ Cmd = "biome";   Pkg = "@biomejs/biome" },
    @{ Cmd = "tsc";     Pkg = "typescript" }
)
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Warn "npm not found (Node.js not installed) - skipping repomix/biome/tsc. Install Node.js (https://nodejs.org) then re-run this script."
} else {
    foreach ($tool in $npmTools) {
        if (-not (Get-Command $tool.Cmd -ErrorAction SilentlyContinue)) {
            Write-Warn "$($tool.Pkg) not found. Installing globally..."
            try {
                npm install -g $tool.Pkg
            } catch {
                Write-Warn "Could not install $($tool.Pkg) automatically. Install manually later: npm install -g $($tool.Pkg)"
            }
        } else {
            Write-Ok $tool.Cmd
        }
    }
}

# ---------------------------------------------------------------------
# 2. Ensure global directories exist
# ---------------------------------------------------------------------
$claudeAgentsDir      = Join-Path $ClaudeHome "agents"
$claudeCommandsDir    = Join-Path $ClaudeHome "commands"
$opencodeAgentDir     = Join-Path $OpencodeHome "agent"
$opencodeCommandDir   = Join-Path $OpencodeHome "command"
$claudeHooksDir       = Join-Path $ClaudeHome "base_project\hooks"
$claudeScriptsDir     = Join-Path $ClaudeHome "base_project\scripts"
$claudeReferencesDir  = Join-Path $ClaudeHome "base_project\references"
$opencodeReferencesDir = Join-Path $OpencodeHome "base_project\references"

foreach ($dir in @($ClaudeHome, $claudeAgentsDir, $claudeCommandsDir, $OpencodeHome, $opencodeAgentDir, $opencodeCommandDir, $claudeHooksDir, $claudeScriptsDir, $claudeReferencesDir, $opencodeReferencesDir)) {
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
}

# ---------------------------------------------------------------------
# 3. CLAUDE.md — inject a delimited, replaceable block
# ---------------------------------------------------------------------
Write-Step "Updating $ClaudeHome\CLAUDE.md..."

$blockContent   = (Read-Utf8NoBom (Join-Path $sourceDir "CLAUDE.md")).TrimEnd()
$block          = "$MARK_START`n$blockContent`n$MARK_END"

# Same rules block, written into whichever instruction file each engine reads. Everything
# outside the delimiters is the user's and is never touched - that is what makes the block
# safe to rewrite on every run.
function Sync-InstructionBlock([string]$Path, [string]$Label) {
    if (Test-Path $Path) {
        $existing = Read-Utf8NoBom $Path
    } else {
        $existing = ""
    }

    $startIdx = $existing.IndexOf($MARK_START)
    if ($startIdx -ge 0) {
        $endIdx = $existing.IndexOf($MARK_END, $startIdx)
        if ($endIdx -ge 0) {
            $endIdx += $MARK_END.Length
            $updated = $existing.Substring(0, $startIdx) + $block + $existing.Substring($endIdx)
        } else {
            $updated = $existing.TrimEnd() + "`n`n" + $block + "`n"
        }
    } elseif ($existing.Trim().Length -gt 0) {
        $updated = $existing.TrimEnd() + "`n`n" + $block + "`n"
    } else {
        $updated = $block + "`n"
    }

    Write-Utf8NoBom -Path $Path -Content $updated
    Write-Ok "$Label (your own content outside the base_project block is untouched)"
}

Sync-InstructionBlock -Path (Join-Path $ClaudeHome "CLAUDE.md") -Label "CLAUDE.md"

# ---------------------------------------------------------------------
# 3a. Same block for the other engines that read an AGENTS.md.
#     Codex CLI reads ~/.codex/AGENTS.md, Kimi Code CLI reads ~/.kimi/AGENTS.md
#     (both verified against their docs, Aug/2026). Only written when the tool's
#     home directory already exists: creating ~/.codex on a machine with no Codex
#     would be exactly the kind of surprise side effect this project avoids.
# ---------------------------------------------------------------------
foreach ($engine in @(
    @{ Home = (Join-Path $HOME ".codex"); Name = "Codex CLI" },
    @{ Home = (Join-Path $HOME ".kimi");  Name = "Kimi Code CLI" }
)) {
    if (Test-Path $engine.Home) {
        Sync-InstructionBlock -Path (Join-Path $engine.Home "AGENTS.md") -Label "$($engine.Name) AGENTS.md"
    } else {
        Write-Warn "$($engine.Name) not detected ($($engine.Home) missing) - skipped its AGENTS.md. Install it and re-run this script."
    }
}

# ---------------------------------------------------------------------
# 3b. settings.json — merge base_project's hooks, preserve the rest
# ---------------------------------------------------------------------
Write-Step "Updating $ClaudeHome\settings.json..."

$settingsPath = Join-Path $ClaudeHome "settings.json"

$settingsObj = $null
if (Test-Path $settingsPath) {
    try {
        $settingsObj = Read-Utf8NoBom $settingsPath | ConvertFrom-Json
    } catch {
        $backupPath = "$settingsPath.bak"
        Copy-Item $settingsPath $backupPath -Force
        Write-Warn "settings.json could not be parsed - backed up to $backupPath and starting fresh"
        $settingsObj = $null
    }
}
if ($null -eq $settingsObj) { $settingsObj = [PSCustomObject]@{} }
if (-not $settingsObj.PSObject.Properties['hooks']) {
    $settingsObj | Add-Member -NotePropertyName hooks -NotePropertyValue ([PSCustomObject]@{}) -Force
}
if (-not $settingsObj.hooks.PSObject.Properties['PostToolUse']) {
    $settingsObj.hooks | Add-Member -NotePropertyName PostToolUse -NotePropertyValue @() -Force
}
if (-not $settingsObj.hooks.PSObject.Properties['SessionStart']) {
    $settingsObj.hooks | Add-Member -NotePropertyName SessionStart -NotePropertyValue @() -Force
}
if (-not $settingsObj.hooks.PSObject.Properties['UserPromptSubmit']) {
    $settingsObj.hooks | Add-Member -NotePropertyName UserPromptSubmit -NotePropertyValue @() -Force
}

# ---------------------------------------------------------------------
# 3c. Prune artifacts of features removed from the project (the dashboard,
#     ROADMAP item 13). Deleting a feature from source/ only stops it being
#     *installed* - a machine that installed an older base_project keeps the
#     old files on disk and keeps running the old hook against code that no
#     longer exists in the repo. Removal has to be an explicit step here, or
#     it never reaches a machine that already has it.
# ---------------------------------------------------------------------
$dashboardMarker = "base_project/dashboard/"
$prunedHookCount = 0
foreach ($hookEvent in @("PostToolUse", "SessionStart")) {
    if (-not $settingsObj.hooks.PSObject.Properties[$hookEvent]) { continue }
    $beforeCount = @($settingsObj.hooks.$hookEvent).Count
    $keptGroups = @($settingsObj.hooks.$hookEvent | Where-Object {
        -not ($_.hooks | Where-Object { $_.command -like "*$dashboardMarker*" })
    })
    $settingsObj.hooks.$hookEvent = $keptGroups
    $prunedHookCount += ($beforeCount - $keptGroups.Count)
}
if ($prunedHookCount -gt 0) {
    Write-Ok "removed $prunedHookCount stale dashboard hook(s) from settings.json"
}

# Same for the files themselves. Only deletes what carries the managed marker,
# mirroring Sync-Managed - a file the user wrote by hand at the same path is
# left alone even if the name matches.
foreach ($staleCmd in @((Join-Path $claudeCommandsDir "dashboard.md"), (Join-Path $opencodeCommandDir "dashboard.md"))) {
    if (-not (Test-Path $staleCmd)) { continue }
    if ((Read-Utf8NoBom $staleCmd) -match 'base_project:managed') {
        Remove-Item $staleCmd -Force
        Write-Ok "removed stale command: $staleCmd"
    } else {
        Write-Warn "Kept $staleCmd - not managed by base_project (looks like your own file)"
    }
}
foreach ($staleDir in @((Join-Path $ClaudeHome "base_project\dashboard"), (Join-Path $OpencodeHome "base_project\dashboard"))) {
    if (Test-Path $staleDir) {
        Remove-Item $staleDir -Recurse -Force
        Write-Ok "removed stale dashboard files: $staleDir"
    }
}

# Loop-detection and auto-format hooks — real behavior, not just logging (see
# ROADMAP.md item 2). Both are synchronous (not async) so their stderr output/
# side effect lands before the next tool call, but neither ever throws or
# blocks — see the scripts themselves for the swallow-all-errors guarantee.
$loopDetectPath   = (Join-Path $claudeHooksDir "loop-detect.js") -replace '\\', '/'
$loopDetectMarker = "base_project/hooks/loop-detect.js"
$loopDetectCommand = "node `"$loopDetectPath`""
$ourLoopEntry = [PSCustomObject]@{
    hooks = @(
        [PSCustomObject]@{ type = "command"; command = $loopDetectCommand; async = $false }
    )
}
$existingLoopGroups = @($settingsObj.hooks.PostToolUse | Where-Object {
    -not ($_.hooks | Where-Object { $_.command -like "*$loopDetectMarker*" })
})
$settingsObj.hooks.PostToolUse = @($existingLoopGroups) + @($ourLoopEntry)

$postEditFormatPath   = (Join-Path $claudeHooksDir "post-edit-format.js") -replace '\\', '/'
$postEditFormatMarker = "base_project/hooks/post-edit-format.js"
$postEditFormatCommand = "node `"$postEditFormatPath`""
$ourFormatEntry = [PSCustomObject]@{
    hooks = @(
        [PSCustomObject]@{ type = "command"; command = $postEditFormatCommand; async = $false }
    )
}
$existingFormatGroups = @($settingsObj.hooks.PostToolUse | Where-Object {
    -not ($_.hooks | Where-Object { $_.command -like "*$postEditFormatMarker*" })
})
$settingsObj.hooks.PostToolUse = @($existingFormatGroups) + @($ourFormatEntry)

# Usage ledger — one JSONL line per tool call, plus the prompt that opened the chain,
# so /reviewusage can answer whether an installed plugin/MCP/agent is actually used
# (see ROADMAP item 21). Registered on two events with the same script: the payload's
# own hook_event_name tells them apart, so there's no flag to keep in sync. Async
# because nothing in the turn waits on the write - unlike loop-detect, whose warning
# has to land before the next call.
$usageLogPath   = (Join-Path $claudeHooksDir "usage-log.js") -replace '\\', '/'
$usageLogMarker = "base_project/hooks/usage-log.js"
$usageLogCommand = "node `"$usageLogPath`""
foreach ($hookEvent in @("PostToolUse", "UserPromptSubmit")) {
    $ourUsageEntry = [PSCustomObject]@{
        hooks = @(
            [PSCustomObject]@{ type = "command"; command = $usageLogCommand; async = $true }
        )
    }
    $existingUsageGroups = @($settingsObj.hooks.$hookEvent | Where-Object {
        -not ($_.hooks | Where-Object { $_.command -like "*$usageLogMarker*" })
    })
    $settingsObj.hooks.$hookEvent = @($existingUsageGroups) + @($ourUsageEntry)
}

# SessionStart hook — injects compact git context (branch, uncommitted changes,
# recent commits) at the start of a session, so Claude doesn't spend tool calls
# rediscovering state on every fresh start/resume/clear. Matcher deliberately
# excludes "compact"/"fork" (see ROADMAP item: SessionStart git-context hook).
$sessionStartGitPath   = (Join-Path $claudeHooksDir "session-start-git-context.js") -replace '\\', '/'
$sessionStartGitMarker = "base_project/hooks/session-start-git-context.js"
$sessionStartGitCommand = "node `"$sessionStartGitPath`""
$ourSessionStartEntry = [PSCustomObject]@{
    matcher = "startup|resume|clear"
    hooks = @(
        [PSCustomObject]@{ type = "command"; command = $sessionStartGitCommand; timeout = 10 }
    )
}
$existingSessionStartGroups = @($settingsObj.hooks.SessionStart | Where-Object {
    -not ($_.hooks | Where-Object { $_.command -like "*$sessionStartGitMarker*" })
})
$settingsObj.hooks.SessionStart = @($existingSessionStartGroups) + @($ourSessionStartEntry)

Write-Utf8NoBom -Path $settingsPath -Content ($settingsObj | ConvertTo-Json -Depth 10)
Write-Ok "settings.json (base_project hooks merged, your other hooks/settings untouched)"

# Informational only - never written automatically. fallbackModel is a real Claude
# Code setting (up to 3 backup models tried in order on a 529/overload error) that
# reduces mid-task failures for zero cost - but it's a behavior change (which model
# answers your prompt), so base_project only suggests it, same as the plugin
# auto-suggestion rule: mention once, never silently edit settings.json for the user.
if (-not $settingsObj.PSObject.Properties['fallbackModel']) {
    Write-Warn "Tip: settings.json has no 'fallbackModel' set. Consider adding e.g. `"fallbackModel`": [`"claude-sonnet-4-6`", `"claude-haiku-4-5`"] to $settingsPath - Claude Code tries these in order if the primary model is overloaded. Not applied automatically."
}

# ---------------------------------------------------------------------
# 4. opencode.jsonc — inline instructions + mcp servers, preserve the rest
# ---------------------------------------------------------------------
Write-Step "Updating $OpencodeHome\opencode.jsonc..."

$opencodeConfigPath  = Join-Path $OpencodeHome "opencode.jsonc"
$instructionsPath    = (Join-Path $sourceDir "opencode-instructions.md") -replace '\\', '/'
$mcpSrcPathForConfig = Join-Path $sourceDir "opencode\mcp.json"

$configObj = $null
if (Test-Path $opencodeConfigPath) {
    try {
        $configObj = Read-Utf8NoBom $opencodeConfigPath | ConvertFrom-Json
    } catch {
        $backupPath = "$opencodeConfigPath.bak"
        Copy-Item $opencodeConfigPath $backupPath -Force
        Write-Warn "opencode.jsonc could not be parsed (comments or invalid JSON) - backed up to $backupPath and starting fresh"
        $configObj = $null
    }
}
if ($null -eq $configObj) {
    $configObj = [PSCustomObject]@{ '$schema' = "https://opencode.ai/config.json" }
}

# opencode's schema wants "instructions" as an array of paths, and "mcp" as a map of
# server name -> { type: "local", command: [...] } | { type: "remote", url, headers },
# defined inline - not a pointer to an external file (that "mcp.file" shape doesn't
# exist in opencode's config schema and fails validation on startup).
$configObj | Add-Member -NotePropertyName instructions -NotePropertyValue @($instructionsPath) -Force

$mcpSourceConfig = Read-Utf8NoBom $mcpSrcPathForConfig | ConvertFrom-Json
$mcpForOpencode = [PSCustomObject]@{}
foreach ($name in $mcpSourceConfig.mcpServers.PSObject.Properties.Name) {
    $server = $mcpSourceConfig.mcpServers.$name
    if ($server.type -eq 'remote') {
        $entry = [PSCustomObject]@{ type = 'remote'; url = $server.url }
        if ($server.headers) {
            $entry | Add-Member -NotePropertyName headers -NotePropertyValue $server.headers
        }
    } else {
        $entry = [PSCustomObject]@{ type = 'local'; command = @($server.command) + @($server.args) }
        if ($server.env) {
            $entry | Add-Member -NotePropertyName environment -NotePropertyValue $server.env
        }
    }
    $mcpForOpencode | Add-Member -NotePropertyName $name -NotePropertyValue $entry
}
$configObj | Add-Member -NotePropertyName mcp -NotePropertyValue $mcpForOpencode -Force

Write-Utf8NoBom -Path $opencodeConfigPath -Content ($configObj | ConvertTo-Json -Depth 10)
Write-Ok "opencode.jsonc (instructions + mcp servers inlined, other keys preserved)"

# ---------------------------------------------------------------------
# 5. Copy managed agent/command files (skip anything not ours)
# ---------------------------------------------------------------------
function Sync-Managed {
    param([string]$SrcFile, [string]$DestFile)

    if (Test-Path $DestFile) {
        $destContent = Read-Utf8NoBom $DestFile
        if ($destContent -notmatch 'base_project:managed') {
            Write-Warn "Skipped $(Split-Path $DestFile -Leaf) - exists and isn't managed by base_project (looks like your own file)"
            return
        }
    }
    Copy-Item $SrcFile $DestFile -Force
    Write-Ok (Split-Path $DestFile -Leaf)
}

Write-Step "Syncing opencode agents/commands..."
Get-ChildItem (Join-Path $sourceDir "opencode\agent") -Filter *.md | ForEach-Object {
    Sync-Managed -SrcFile $_.FullName -DestFile (Join-Path $opencodeAgentDir $_.Name)
}
Get-ChildItem (Join-Path $sourceDir "opencode\command") -Filter *.md | ForEach-Object {
    Sync-Managed -SrcFile $_.FullName -DestFile (Join-Path $opencodeCommandDir $_.Name)
}

Write-Step "Syncing Claude Code agents/commands..."
Get-ChildItem (Join-Path $sourceDir "claude\agents") -Filter *.md | ForEach-Object {
    Sync-Managed -SrcFile $_.FullName -DestFile (Join-Path $claudeAgentsDir $_.Name)
}
Get-ChildItem (Join-Path $sourceDir "claude\commands") -Filter *.md | ForEach-Object {
    Sync-Managed -SrcFile $_.FullName -DestFile (Join-Path $claudeCommandsDir $_.Name)
}

# ---------------------------------------------------------------------
# 6. MCP servers for Claude Code (via CLI) - opencode already got these
#    inlined into opencode.jsonc directly in step 4, above.
# ---------------------------------------------------------------------
$mcpSrcPath = Join-Path $sourceDir "opencode\mcp.json"

Write-Step "Registering MCP servers with Claude Code (if 'claude' CLI is available)..."
if (Get-Command claude -ErrorAction SilentlyContinue) {
    $mcpConfig = Read-Utf8NoBom $mcpSrcPath | ConvertFrom-Json
    foreach ($name in $mcpConfig.mcpServers.PSObject.Properties.Name) {
        $server = $mcpConfig.mcpServers.$name
        if ($server.type -eq 'remote') {
            $headerArgs = @()
            if ($server.headers) {
                foreach ($headerName in $server.headers.PSObject.Properties.Name) {
                    $headerArgs += @('--header', "${headerName}: $($server.headers.$headerName)")
                }
            }
            $callArgs = @('mcp', 'add', '--scope', 'user', '--transport', 'http', $name, $server.url) + $headerArgs
            $manualHint = "claude mcp add --scope user --transport http $name $($server.url) $($headerArgs -join ' ')"
        } else {
            $envArgs = @()
            if ($server.env) {
                foreach ($envName in $server.env.PSObject.Properties.Name) {
                    $envArgs += @('--env', "$envName=$($server.env.$envName)")
                }
            }
            $callArgs = @('mcp', 'add', '--scope', 'user', $name) + $envArgs + @('--') + @($server.command) + @($server.args)
            $manualHint = "claude mcp add --scope user $name $($envArgs -join ' ') -- $($server.command) $($server.args -join ' ')"
        }
        # Remove any existing registration first so re-running the installer always applies the
        # latest catalog values instead of erroring on "already exists" for unrelated servers.
        # Wrapped in try/catch: PowerShell 5.1 treats a native command's stderr as a terminating
        # error under $ErrorActionPreference = "Stop", even when redirected with *> $null — this
        # is expected to "fail" (nothing to remove) on a first install, so it must never abort.
        try { & claude mcp remove $name --scope user *> $null } catch {}
        try {
            & claude @callArgs *> $null
            if ($LASTEXITCODE -eq 0) {
                Write-Ok "registered '$name'"
            } else {
                Write-Warn "Could not auto-register '$name' (exit $LASTEXITCODE). Add manually: $manualHint"
            }
        } catch {
            Write-Warn "Could not auto-register '$name'. Add manually: $manualHint"
        }
    }
} else {
    Write-Warn "'claude' CLI not found on PATH - skipping Claude Code MCP registration. Re-run this script after installing Claude Code."
}

# ---------------------------------------------------------------------
# 6b. MCP servers for Codex CLI - appended as [mcp_servers.NAME] tables to
#     ~/.codex/config.toml. Append-only and guarded by an existence check: this
#     script has no TOML parser, so it must never rewrite a file it can't fully
#     understand. A table appended at the end of a TOML file cannot alter the
#     tables above it, which is what makes append the safe operation here - and
#     why an already-present server is skipped rather than "updated".
# ---------------------------------------------------------------------
$codexHome = Join-Path $HOME ".codex"
if ((Test-Path $codexHome) -and (Test-Path $mcpSrcPath)) {
    Write-Step "Registering MCP servers with Codex CLI..."
    $codexConfig = Join-Path $codexHome "config.toml"
    $codexExisting = if (Test-Path $codexConfig) { Read-Utf8NoBom $codexConfig } else { "" }
    $mcpForCodex = Read-Utf8NoBom $mcpSrcPath | ConvertFrom-Json
    $appended = @()
    foreach ($name in $mcpForCodex.mcpServers.PSObject.Properties.Name) {
        $server = $mcpForCodex.mcpServers.$name
        if ($codexExisting -match [regex]::Escape("[mcp_servers.$name]")) {
            Write-Ok "'$name' already in config.toml - left as is"
            continue
        }
        # Remote (url-based) servers use a different key set; only stdio servers are
        # emitted here, since that is the shape verified against Codex's docs.
        if (-not $server.command) {
            Write-Warn "'$name' is a remote MCP server - add it to $codexConfig manually (url-based syntax not emitted here)."
            continue
        }
        $argsToml = ($server.args | ForEach-Object { '"' + ($_ -replace '"', '\"') + '"' }) -join ", "
        $block = "`n[mcp_servers.$name]`ncommand = `"$($server.command)`"`nargs = [$argsToml]`n"
        if ($server.env) {
            $block += "[mcp_servers.$name.env]`n"
            foreach ($envName in $server.env.PSObject.Properties.Name) {
                $block += "$envName = `"$($server.env.$envName)`"`n"
            }
        }
        $appended += $block
        Write-Ok "queued '$name' for config.toml"
    }
    if ($appended.Count -gt 0) {
        $header = "`n# --- base_project managed MCP servers (safe to edit; re-added if removed) ---"
        Write-Utf8NoBom -Path $codexConfig -Content ($codexExisting.TrimEnd() + $header + ($appended -join ""))
        Write-Ok "config.toml ($($appended.Count) server(s) appended, existing keys untouched)"
    }
} elseif (-not (Test-Path $codexHome)) {
    Write-Warn "Codex CLI not detected ($codexHome missing) - skipped its MCP registration."
}

# ---------------------------------------------------------------------
# 6c. MCP servers for Kimi Code CLI. Kimi reads a standard mcpServers JSON via
#     `--mcp-config-file`, which is exactly the shape base_project already keeps,
#     so the file is written verbatim. Deliberately NOT wired into ~/.kimi/config.toml:
#     that file's MCP schema was not verifiable from the docs, and guessing at the
#     shape of a config the user depends on is how you corrupt it. The flag is
#     printed instead so the choice stays with them.
# ---------------------------------------------------------------------
$kimiHome = Join-Path $HOME ".kimi"
if ((Test-Path $kimiHome) -and (Test-Path $mcpSrcPath)) {
    Write-Step "Writing MCP config for Kimi Code CLI..."
    $kimiMcpPath = Join-Path $kimiHome "mcp.json"
    Copy-Item $mcpSrcPath $kimiMcpPath -Force
    Write-Ok "mcp.json -> $kimiMcpPath"
    Write-Warn "Kimi: start it with ``kimi --mcp-config-file `"$kimiMcpPath`"`` (or run ``kimi mcp add`` yourself) - not auto-registered."
} elseif (-not (Test-Path $kimiHome)) {
    Write-Warn "Kimi Code CLI not detected ($kimiHome missing) - skipped its MCP config."
}

# ---------------------------------------------------------------------
# 7. Plugin catalog - read by the /plugins command in either engine
# ---------------------------------------------------------------------
Write-Step "Syncing plugin catalog..."
$pluginsSrcPath = Join-Path $sourceDir "plugins.json"

function Sync-Catalog([string]$DestPath) {
    New-Item -ItemType Directory -Force -Path (Split-Path $DestPath -Parent) | Out-Null
    $destObj = $null
    if (Test-Path $DestPath) {
        try { $destObj = Read-Utf8NoBom $DestPath | ConvertFrom-Json } catch { $destObj = $null }
    }
    $isOurs = ($null -eq $destObj) -or ($destObj.PSObject.Properties.Name -contains '_managed_by')
    if ($isOurs) {
        Copy-Item $pluginsSrcPath $DestPath -Force
        Write-Ok "plugins.json -> $DestPath"
    } else {
        Write-Warn "Skipped $DestPath - exists and isn't managed by base_project."
    }
}

Sync-Catalog (Join-Path $ClaudeHome "base_project\plugins.json")
Sync-Catalog (Join-Path $OpencodeHome "base_project\plugins.json")

# ---------------------------------------------------------------------
# 8b. Hooks with real behavior (loop-detect, post-edit-format) - see ROADMAP item 2
# ---------------------------------------------------------------------
Write-Step "Syncing hook scripts..."
$hooksSrcDir = Join-Path $sourceDir "hooks"
if (Test-Path $hooksSrcDir) {
    Get-ChildItem $hooksSrcDir -Filter *.js | ForEach-Object {
        Sync-Managed -SrcFile $_.FullName -DestFile (Join-Path $claudeHooksDir $_.Name)
    }
}

# ---------------------------------------------------------------------
# 8c. scan-skill.js - lightweight pre-trust scan, used by /plugins before
# installing a third-party skill. See ROADMAP item 10.
# ---------------------------------------------------------------------
$scanSkillSrc = Join-Path $repoRoot "dev\scripts\scan-skill.js"
if (Test-Path $scanSkillSrc) {
    Sync-Managed -SrcFile $scanSkillSrc -DestFile (Join-Path $claudeScriptsDir "scan-skill.js")
}

# ---------------------------------------------------------------------
# 8c-2. contrast-check.js - deterministic WCAG contrast/tap-target pre-check used
# by /designreview before spending an LLM pass on judgment calls. See ROADMAP item 28.
# ---------------------------------------------------------------------
$contrastCheckSrc = Join-Path $repoRoot "dev\scripts\contrast-check.js"
if (Test-Path $contrastCheckSrc) {
    Sync-Managed -SrcFile $contrastCheckSrc -DestFile (Join-Path $claudeScriptsDir "contrast-check.js")
}

# ---------------------------------------------------------------------
# 8d. Reference docs read by commands (project-standards.md, command-menu.md)
# ---------------------------------------------------------------------
Write-Step "Syncing reference docs..."
$claudeReferencesSrcDir   = Join-Path $sourceDir "claude\references"
$opencodeReferencesSrcDir = Join-Path $sourceDir "opencode\references"
if (Test-Path $claudeReferencesSrcDir) {
    Get-ChildItem $claudeReferencesSrcDir -Filter *.md | ForEach-Object {
        Sync-Managed -SrcFile $_.FullName -DestFile (Join-Path $claudeReferencesDir $_.Name)
    }
}
if (Test-Path $opencodeReferencesSrcDir) {
    Get-ChildItem $opencodeReferencesSrcDir -Filter *.md | ForEach-Object {
        Sync-Managed -SrcFile $_.FullName -DestFile (Join-Path $opencodeReferencesDir $_.Name)
    }
}

# ---------------------------------------------------------------------
# 9. Record the repo path (used to check for base_project updates later)
# ---------------------------------------------------------------------
$stateDir = Join-Path $HOME ".base_project"
New-Item -ItemType Directory -Force -Path $stateDir | Out-Null
Write-Utf8NoBom -Path (Join-Path $stateDir "repo-path.txt") -Content $repoRoot
Write-Ok "recorded repo path for update checks: $repoRoot"

# ---------------------------------------------------------------------
# 10. Custom folder icon for this repo's own folders (Windows Explorer only —
#     desktop.ini has no equivalent on macOS/Linux, so this step is skipped
#     there; the .sh installer doesn't attempt it).
# ---------------------------------------------------------------------
$iconPath = Join-Path $repoRoot "assets\icone.ico"
if (Test-Path $iconPath) {
    Write-Step "Applying folder icon to source/, dev/, assets/..."
    foreach ($folder in @("source", "dev", "assets")) {
        $folderPath = Join-Path $repoRoot $folder
        if (-not (Test-Path $folderPath)) { continue }
        $iniPath = Join-Path $folderPath "desktop.ini"
        # Clear hidden/system attrs first so re-running the installer (e.g. after
        # git pull) can overwrite a desktop.ini left marked hidden by a prior run.
        if (Test-Path $iniPath) { attrib -h -s $iniPath 2>$null }
        $iniContent = "[.ShellClassInfo]`r`nIconResource=..\assets\icone.ico,0`r`n"
        Write-Utf8NoBom -Path $iniPath -Content $iniContent
        attrib +h $iniPath 2>$null
        attrib +s $folderPath 2>$null
    }
    Write-Ok "folder icons applied (Explorer may need a refresh/relaunch to show them)"
}

Write-Host ""
Write-Host "base_project installed. Open any project - Claude Code and opencode now load these rules automatically." -ForegroundColor Green
Write-Host "Nothing was written inside any project repository." -ForegroundColor Green
