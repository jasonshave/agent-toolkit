# Host support

Skills share Agent Skills frontmatter (`name`, `description`) and normal Markdown, scripts and
references. The build packages common host guidance and worker prompts inside each skill, so a
standalone skill does not require a neighboring plugin or another user's filesystem.

| Host | Personal discovery used by installer | Invocation | Worker adaptation |
|---|---|---|---|
| Claude Code | `~/.claude/skills` | `/name`; plugin `/jason-toolkit:name` | Optional native agents plus bundled role prompts |
| Codex | `~/.agents/skills` | `$name` | Available collaboration tools with bundled prompts and explicit Git worktrees |
| GitHub Copilot CLI | `~/.agents/skills` | `/name` | Available task/custom-agent tools with bundled prompts |
| Grok Build | `~/.agents/skills` | `/name` | Available subagent tools with bundled prompts |
| Cursor | `~/.cursor/skills` | Host skill interface | Capability guidance, bundled prompts, sequential fallback |
| Gemini CLI | `~/.gemini/skills` | Host skill interface | Capability guidance, bundled prompts, sequential fallback |
| OpenCode | `~/.config/opencode/skills` | Host skill interface | Capability guidance, bundled prompts, sequential fallback |

Project installs use `.claude/skills`, `.agents/skills`, `.github/skills` for Copilot and
`.grok/skills` for Grok. Use project scope for a cloud agent's checked-out repository; files in your
PC's home are not automatically present on remote hosts. IDE discovery can differ from CLI discovery.

Host APIs and permissions are not interchangeable. Do not interpret `allowed-tools` as a portable
permission grant/restriction, assume that a tool such as `DesignSync`/`Monitor` exists, or pass Claude
agent parameters to another runtime. Worker briefs carry exact paths and commits. On hosts without
workers, ordinary units execute sequentially with the same scope and evidence requirements; an
independence requirement still needs a separate restricted reviewer session.

## Committee on a non-Claude chair

Claude seats can use `run-claude-member.mjs` on **any** chair host. It launches Claude with an actual
built-in tool allowlist, restricted and safe modes, no external MCP servers, no automatic permission
approval and no writable tools. Native restricted Claude agents remain an option on Claude hosts.
Do not substitute privileged Codex/Copilot/Grok workers and call them Claude reviewers.

Run `node <skill>/self-test-claude.mjs` before first use and after its tool version or lockdown
scripts change. `--check` compares that exact identity with the last successful fresh/resumed smoke
check. The durable record is `~/.local/share/jason-toolkit/committee-claude-verified.json`.
The test verifies an unchanged disposable repository and real structured answers; its report states
when operations were unavailable because the allowlist exposed no mutation tool, rather than claiming
an operating-system sandbox refused attempted writes. Managed administrator policies still apply.

The existing Codex/Grok runners retain their own versioned lockdown self-tests. They require Bash
and GNU coreutils. Grok is deliberately not seated in a trusted review folder where project hooks
could run; the committee records its restricted Claude replacement. Provider-specific model choices
belong to this mixed-provider workflow, not to generic worker roles.

## Third-party skills

Existing Aspire, Impeccable and dotnet-inspect installs remain upstream-managed. `--include-existing`
can bridge a shared skill into Claude without copying its source into this repository. On a fresh
machine install those packages from their upstream distributions before running the bridge. Synced
cloud/document skills belong to their host integrations and are not copied or republished here.

## Current source references

- [Codex skill discovery and symlink support](https://learn.chatgpt.com/docs/build-skills)
- [OpenAI plugin packaging and private marketplaces](https://developers.openai.com/plugins/build/plugins)
- [Claude Code skills](https://code.claude.com/docs/en/skills)
- [Claude plugin manifests](https://code.claude.com/docs/en/plugins-reference)
- [Copilot CLI skill discovery](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-skills)
- [Copilot plugin formats and precedence](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference)
- [Grok skills, plugins, marketplaces and Claude compatibility](https://docs.x.ai/build/features/skills-plugins-marketplaces)
- [Cursor skill locations](https://cursor.com/docs/skills)
- [Gemini CLI skills](https://geminicli.com/docs/cli/skills/)
- [OpenCode skill locations](https://docs.opencode.ai/docs/skills/)

Use local CLI help as the authority for the version actually installed. Plugin manifests include the
portable Agent Plugins layout and Claude/Codex compatibility manifests. This repository is privately
distributed; no public plugin-directory submission, publication or repository visibility change is implied.
