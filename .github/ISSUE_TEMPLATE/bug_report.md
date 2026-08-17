---
name: Bug report
about: Something in base_project doesn't work as documented
title: "[Bug] "
labels: bug
---

## What happened

A clear description of what went wrong.

## Expected behavior

What you expected to happen instead.

## Environment

- OS: <!-- Windows / macOS / Linux -->
- Engine: <!-- Claude Code / opencode / both -->
- base_project version: <!-- output of `/status`, or `git describe --tags` in your clone -->

## Steps to reproduce

1.
2.
3.

## Relevant output

<!-- Installer output, command output, or error text. Wrap in a code block.
     Never paste API keys, tokens, or other secrets here — if the bug involves
     a credential, describe it without the real value. -->

```

```

## Is this a security issue?

If this report involves a way to write outside `~/.claude`/`~/.config/opencode`, execute
something unintended, or otherwise compromise a machine running base_project — please don't
file it here. Use [SECURITY.md](../../SECURITY.md) instead.
