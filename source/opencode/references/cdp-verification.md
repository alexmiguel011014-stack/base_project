# base_project:managed

# CDP verification — prove a UI in a real browser

Read this file in full only when the command you are running was invoked with the `cdp` modifier:
the word `cdp` (also `/cdp`, `$cdp` or `--cdp`) in the invocation arguments. The word inside
`GOALS.md`, code or any other file is never the modifier. Without the modifier none of this
applies, and you start no browser with a debug port.

## 1. What the modifier authorizes

`cdp` is the user's explicit go-ahead for exactly one thing: starting an isolated, loopback-only
browser, driving it, and closing it. It does not authorize using the user's real or default browser
profile, installing a tool or package, screen control or desktop screenshots, or visiting any site
other than the app under test.

## 2. Which items

Say once, before the first item, that CDP mode is on. Apply it to every item whose behavior is
reachable in a browser. For an item with no browser-reachable UI, say `cdp: not applicable` for
that item and verify it through the normal channels; that is never a failure.

## 3. Pick the driver

1. A tool that launches and manages its own browser — Claude Code's Browser pane, Codex's
   `@Browser`, or a Playwright MCP that starts its own browser — already drives a real browser
   through CDP. Use it, and never start a second browser beside it.
2. Otherwise start your own browser (section 4) and attach with a driver the environment already
   has: a Playwright MCP started with `--cdp-endpoint http://127.0.0.1:<port>`, or the project's own
   Playwright or Puppeteer when it already depends on one.
3. A tool attached to the user's own browser — Claude in Chrome, an extension bridge — is not a
   driver for this mode: it acts in the user's signed-in profile, which section 8 rules out. If it is
   the only tool available, say so and stop; the user can still use it without the modifier.
4. With no driver at all, say exactly what is missing (a Playwright MCP from the plugin catalog,
   the Browser pane) and stop for the user's choice. Do not install anything.

## 4. Start your own browser (only when you must)

- Find Chrome or Chromium: `CHROME_BIN` or `CHROME_PATH`, then `google-chrome` or `chromium` on
  PATH, macOS `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`, Windows
  `%ProgramFiles%\Google\Chrome\Application\chrome.exe`.
- Use a fresh temporary profile directory. Chrome 136 and later ignore the debug switches on the
  default profile, so this is also the only form that works.
- Start it with `--headless=new --remote-debugging-port=0 --user-data-dir=<temporary profile>
  --no-first-run --no-default-browser-check` and the app URL; headed only if the user asks to
  watch. Never add `--disable-web-security` or a `--remote-debugging-address`. Add `--no-sandbox`
  only where the platform forces it (for example when running as root) and say so.
- Read the port Chrome chose from the first line of `<profile>/DevToolsActivePort` (wait for the
  file to appear). If Chrome ends without writing it, read its exit status and stderr before
  trying again: on Linux and macOS it crashes at startup, silently, when `TMPDIR` is longer than
  50 characters (it binds a socket under it), so start it with `TMPDIR=/tmp` in that case.
- Confirm the port listens on loopback only (`127.0.0.1` or `::1`) by reading the listening
  sockets: Linux `/proc/net/tcp` and `/proc/net/tcp6` (do not assume `ss` exists), macOS
  `netstat -an -p tcp`, Windows `netstat -an -p TCP`. If any other address listens, close the
  browser and stop.
- Attach to `http://127.0.0.1:<port>`.

## 5. The app under test

Use the URL the item names, or the project's own documented dev or preview command (start it
yourself and stop it afterwards). When you cannot tell how to run the app, ask.

## 6. Evidence, as text

For each item record:

- an accessibility or DOM snapshot before and after the action (the page text counts);
- console messages, especially errors and warnings;
- failed network requests (status 400 or above, or no response);
- the result you expected and the result you got.

Write it where the command already keeps its proof: the item's Proof line for `execgoals`, the
fix's re-verification for `fixproject`. A page capture only when the check is visual by nature or
the user asked for one, never a desktop screenshot.

## 7. Clean up on every outcome

Arrange the cleanup so it runs when a step fails or you stop early (`finally`, `trap`, or an
explicit cleanup before reporting). Close the whole browser process tree, delete the temporary
profile and any throwaway script, stop any dev server you started, and confirm the debug port no
longer answers. When you cannot confirm the cleanup, say so in the report. A browser left running
is a defect.

## 8. Never

- use the user's real or default browser profile, or attach to a browser the user already runs
  with it;
- enter real credentials, or visit sites other than the app under test;
- start a browser with a debug port when the modifier is absent.

Report to the user in the language they are writing in, even though this file is in English: it
is an instruction to be executed, not text to be echoed verbatim.
