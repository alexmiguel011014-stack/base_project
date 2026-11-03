# base_project:managed

# CDP verification

Use this reference only for `/execgoals` and `/fixproject` in Claude Code, opencode dense, opencode lite, and Codex (`$execgoals`, `$fixproject`).

## Invocation gate

Recognize one standalone, case-insensitive invocation token: `cdp`, `/cdp`, `$cdp`, or `--cdp`. Read it only from the current `/execgoals` or `/fixproject` invocation arguments. Never detect it in `GOALS.md`, code, or other file content.

When a token matches, say once that CDP mode is on for this invocation. Apply CDP verification to each item with a browser-reachable UI. For an item without a browser-reachable UI, say `cdp: not applicable` and verify it through the normal channels. When no token matches, run the command normally and never start a browser with a debug port. Do not enable CDP for another command.

## Safety contract

1. **Scope and authority:** Treat the modifier as the user's explicit permission for this invocation to start an isolated browser that listens only on loopback, then close it. Do not use a real browser profile, install tools, use screen control, or visit third-party sites.
2. **Driver order:** Use an already-connected app-driving tool (Browser pane, Claude in Chrome, or Playwright MCP) only in its own isolated, approved test context. Never connect to or drive a real Chrome profile or an existing user session. If the available connected tool is a real user session, stop and ask the user; do not use it or silently launch a second browser. Otherwise, start your own browser and attach with an available driver. If no driver is available, name what is missing (Playwright MCP through `/plugins`, Claude in Chrome, or the Browser pane) and stop for the user's choice. Do not install tools silently.
3. **Launch:** Start your own browser with a fresh temporary `--user-data-dir`. For regular Chrome 136 and later, do not rely on `--remote-debugging-port` or `--remote-debugging-pipe` with the default data directory; those switches are not honored there. Chrome for Testing retains its prior behavior. Start with `--remote-debugging-port=0` and read the chosen port from `<profile>/DevToolsActivePort`. Run headless unless the user asks to watch. Confirm that the debug port listens only on loopback and stop if it does not. Never use `--disable-web-security`. Use `--no-sandbox` only where the platform forces it (for example, when running as root), and say when you use it.
4. **Evidence:** Record an accessibility/DOM snapshot before and after the action, console messages, failed requests with status 400 or higher, and page text. Before writing this evidence to Proof or re-verification, redact credentials, tokens, cookies, authorization headers, and sensitive request or response data. Keep only sanitized details needed to verify behavior. Put the sanitized text in the item's Proof for `/execgoals` or the re-verification for `/fixproject`. Capture a page only when the check is visual by nature or the user asks.
5. **Cleanup:** In a `finally` block or shell trap on every outcome, close the browser process, remove the temporary profile, and confirm that the port is closed. Do not leave a browser running after a failed step.
6. **Language:** Keep this model-executed reference in English and end it with the user-language footer below.

## Sources

- Invocation grammar: `GOALS.md`, GOALS 18 C18.1.
- Clause 1: the owner's choice and rationale in `GOALS.md`, GOALS 18; the shared screen-control rule in `source/CLAUDE.md` under “UI verification & screen control.”
- Clause 2: the app-driving order in the shared UI-verification rule in `source/CLAUDE.md`.
- Clause 3: Chrome 136 and the Chrome for Testing exception in [Chrome for Developers](https://developer.chrome.com/blog/remote-debugging-port); port 0 in the [Headless debugging guide](https://developer.chrome.com/docs/automation-and-testing/debug-headless); loopback and `DevToolsActivePort` in Chromium's [remote debugging server source](https://chromium.googlesource.com/chromium/src/+/HEAD/chrome/browser/devtools/remote_debugging_server.cc); the `--no-sandbox` observation in the 2026-09-29 probe note recorded in GOALS 18.
- Clause 4: the evidence/capture policy in the shared UI-verification rule and the Security rule against committing or hardcoding credentials/tokens in `source/CLAUDE.md`.
- Clause 5: the failed-attempt cleanup observation in the 2026-09-29 probe note recorded in GOALS 18.
- Clause 6: `source/claude/references/project-standards.md`.

Report findings to the user in the language they are writing in, even though this reference is in English: this file is an instruction to be executed, not text to be echoed verbatim.
