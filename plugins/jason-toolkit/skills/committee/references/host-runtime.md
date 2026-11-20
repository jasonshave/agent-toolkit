# Host capabilities and portable execution

Apply the workflow below on the current host. A tool name in older examples describes a capability;
it never grants permission or means a tool with that spelling exists. User instructions and repository
rules take precedence. Resolve resource paths from this skill's loaded directory, not from the current
project or a hardcoded home folder. Keep the working directory at the target project for commands.

| Capability | Claude Code | Codex | Copilot CLI | Grok Build |
|---|---|---|---|---|
| Invoke a skill | `/name` or plugin `/jason-toolkit:name` | `$name` | `/name` | `/name` or its plugin-qualified command |
| Delegate | `Agent` | exposed collaboration/spawn tool | available task/custom-agent tool | available subagent tool |
| Read/write/run/search | available native tools | available native tools | available native tools | available native tools |
| Clarify | available question tool or chat | available question tool or chat | available question tool or chat | available question tool or chat |

For a role named by this workflow, read the bundled `references/roles/<role>.md` and pass its entire
instructions plus the task brief to the host's native worker. Claude plugin agents are an optional
shortcut; their presence is not required on other hosts. Never assume a custom agent type, parameter,
model alias, or notification mechanism transfers between products. Inherit the host's model unless
the workflow deliberately requires an independent named provider, as `committee` does.

For concurrent editing, create a unique Git worktree and branch per worker before spawning it, unless
the host creates and confirms that isolation. Give each worker an absolute working path and exact
starting commit; require it to verify both. Respect the lower of the repository's concurrency cap and
the host's actual capacity. Prefer three workers plus a coordinator when no lower limit exists.
No nested delegation unless explicitly permitted. If native delegation is unavailable, run bounded
units sequentially with the same briefs, evidence files and verification; disclose the execution mode.
When independent judgment is required, use a separately launched, authorized reviewer session rather
than pretending the coordinator's second pass is independent. Report a concrete missing capability
if neither is possible; continue work that does not require it.

Tool restrictions are host-specific. YAML `allowed-tools` and a role prompt alone do not establish a
read-only security boundary. For untrusted reviews, use an actually restricted worker or verified CLI
runner. `committee` must not substitute a fully privileged general worker for a restricted reviewer.

Use the host's actual task handles and completion events. When there are no events or background
monitor tools, use short read-only status checks and yield between them; do not require `Monitor`,
`SendMessage`, `TaskOutput`, or a specific task API. Keep ownership until the requested terminal state.
Ask a clarifying question in ordinary chat if a structured question tool is unavailable.

Discover design, browser, image, GitHub and Azure integrations from tools actually available. For a
design URL, use an authorized connector or browser; if inaccessible, ask for an exported artifact.
Do not fabricate `DesignSync`, grant a connector preauthorization, or invent access. Use a local
design skill when installed (for example `impeccable` or `frontend-design`); otherwise apply the
project's existing design system directly. Resolve other referenced skills by name in the current
host; if not installed, read their bundled role or perform the documented equivalent workflow.

Use shell syntax for the shell actually running. `! command` is a Claude interface feature: on other
hosts, run permitted commands normally or give the user a plain terminal command. Never turn an old
permission-classifier anecdote into a requirement to bypass current approval controls. Install tools,
spend credits, deploy, or change credentials only within the user's actual authorization.

Before a push or PR, run all required affected local checks, including the full affected client suite,
lint, type check and production build for client changes. Re-run affected checks after corrections.
Discover the default branch; do not assume `main` or `master`. Enable auto-merge when authorized by
the task or repository, preserve required checks and reviews, verify it is enabled (or already merged),
and own the PR until merged. If auto-merge is unavailable, report the actual restriction and use the
normal permitted merge path once requirements pass; never weaken protections. Stage only task files;
use file arguments for multiline PR bodies and actual author information instead of invented attribution.

Record exact task-owned worktree, scratch, dependency and build paths. Stop only task-owned processes
by verified handle/PID. Verify absolute paths before cleanup; preserve dirty or unmerged work, user
data, other sessions' services, and durable review records. Remove task outputs after verification and
report any retained paths and reasons. On Windows use native filesystem operations or Git-managed
worktree removal, never compose deletion across shells.
