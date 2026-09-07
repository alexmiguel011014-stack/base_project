# Codex integration

This directory is the Codex-native projection of base_project. It preserves the same behavior as the Claude Code and opencode integrations while using Codex's supported customization layers.

## Invocation

Base_project workflows are Codex skills. Invoke one explicitly as `$wpp`, `$scanproject`, `$newgoal`, and so on. Enabled skills also appear in Codex's slash-command selector, but Codex does not expose arbitrary top-level custom commands such as `/wpp`; custom prompt files would instead appear under `/prompts:`.

This mapping follows Codex's documented extension model:

- [Customization overview](https://learn.chatgpt.com/docs/customization/overview)
- [Build skills](https://learn.chatgpt.com/docs/build-skills)
- [Slash commands](https://learn.chatgpt.com/docs/reference/slash-commands)
- [AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md)
- [Subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents)
- [Hooks](https://learn.chatgpt.com/docs/hooks)

## Layers

- `AGENTS.md` — always-on global operating rules installed as a managed block in `~/.codex/AGENTS.md`.
- `skills/<name>/SKILL.md` — the 21 user-invoked workflows installed under `~/.agents/skills/`.
- `agents/*.toml` — the architect, coder, and reviewer subagents installed under `~/.codex/agents/`.
- `references/` — shared standards, goal types, and the literal command menu installed under `~/.codex/base_project/references/`.
- Shared JavaScript helpers remain in the existing `~/.claude/base_project/` namespace so the contribution diary keeps one uninterrupted ledger across Claude and Codex.

The installer copies only files marked `base_project:managed` and replaces only the delimited base_project block in `AGENTS.md`; user-owned content outside that boundary is preserved.
