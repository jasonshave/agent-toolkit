# Jason's agent toolkit

Development, shipping, review, design and test-audit workflows shared by **Claude Code, Codex,
GitHub Copilot and Grok Build**.

The repository is the source of truth. Edit skills here, commit them, then update installations.
Do not edit marketplace caches or copy home-directory files back over the repository.

## Install on this or another computer

Requires Git and Node.js 20+. No npm dependencies, global npm installs, MCP servers or account
configuration are installed by the setup script. Install and authenticate your chosen assistant
separately. To use `new-azure-site`, supply a compatible GitHub template with a `BOOTSTRAP.md`
or set `JASON_TOOLKIT_AZURE_TEMPLATE` to its `owner/repo`.

```sh
git clone https://github.com/jasonshave/agent-toolkit.git
cd agent-toolkit
node scripts/install.mjs install
node scripts/install.mjs doctor
```

The default copies every toolkit skill into `~/.claude/skills` and `~/.agents/skills` and installs
Claude's optional named worker agents. Codex, Copilot CLI and Grok share the latter directory.
Skill folders include their references, scripts and portable worker prompts. No custom named
agent registration is required on other hosts.

For the authoring PC, link individual skill folders to the checkout:

```sh
node scripts/install.mjs install --mode link --replace --migrate-legacy --include-existing
```

`--replace` first preserves conflicting files in timestamped backups; it never silently deletes
a local master. A receipt and backups live at `~/.local/share/jason-toolkit/`. Existing unmodified
managed outputs can be upgraded without this option. Local edits cause a refusal until reviewed.
On Windows, directory links use junctions without requiring administrator privileges; standalone
Claude agent files are copied, so rerun the installer after editing agent definitions.

`--migrate-legacy` backs up duplicate toolkit copies in `~/.codex/skills`, `~/.copilot/skills` and
`~/.grok/skills` and removes their discoverable manifests. Compatibility directories link old
standard script/resource directories to the maintained skill.
`--include-existing` additionally exposes existing shared third-party skills to Claude through
links. It does not vendor, rewrite or update third-party content.

Choose specific hosts or skills:

```sh
node scripts/install.mjs install --agents codex,copilot,grok --skills prune-tests,ship
node scripts/install.mjs install --agents cursor,gemini,opencode
node scripts/install.mjs install --scope project --project /path/to/project --agents copilot
node scripts/install.mjs install --home /path/to/test-home --dry-run
```

Cursor, Gemini and OpenCode use their native skill folders; shared workflow instructions remain
the same. For another Agent Skills-compatible host, use `--skills-dir` inside `--home` or the
explicit project root. Check that host's current discovery conventions. Cloud sessions require
skills installed inside their own checkout/home; local installation does not configure a cloud VM.

Restart your assistant after installation if its skill list is already cached. Invoke skills with
`/prune-tests` in Claude/Copilot/Grok, `$prune-tests` in Codex, or ask for the skill by name.
Plugin installations can use qualified names such as `/jason-toolkit:prune-tests`.

## Update and uninstall

```sh
git pull --ff-only
node scripts/build.mjs
node scripts/install.mjs install
node scripts/install.mjs doctor
node scripts/install.mjs uninstall
```

Use the same `--home`, `--scope`, `--project`, `--agents`, `--skills` and migration/bridge options
when updating or uninstalling a selective installation. Uninstall restores backed-up originals;
it refuses to remove edited managed copies. It never removes unrelated skills, assistant settings,
credentials, or the source checkout. Backups are user data: review them before deleting them.
`restore.ps1`, `sync.ps1` and `doctor.ps1` are thin PowerShell entrypoints for the Node scripts.

To remove a skill entirely from discovery while keeping an older original inactive in the backup
archive, use `uninstall --skills <name> --archive-originals`. The receipt records the archived path.

## Marketplace installation

Use **either** direct installation **or** the plugin for a given host, to avoid duplicate entries.
Plugin installation is a snapshot: refresh it explicitly after repository changes.

Claude Code:

```text
/plugin marketplace add jasonshave/agent-toolkit
/plugin install jason-toolkit@jason-plugins
/plugin marketplace update jason-plugins
```

Codex CLI:

```sh
codex plugin marketplace add jasonshave/agent-toolkit
codex plugin add jason-toolkit@jason-plugins
codex plugin marketplace upgrade jason-plugins
```

Copilot CLI:

```sh
copilot plugin marketplace add jasonshave/agent-toolkit
copilot plugin install jason-toolkit@jason-plugins
copilot plugin update jason-toolkit
```

Grok Build accepts Claude-compatible marketplaces; use its `plugin marketplace` and `plugin install`
commands or the extensions UI. Direct installation into the shared directory is the simplest
option when using several hosts on one machine. See [host support](docs/hosts.md) for sources and limits.

## Skills

| Skill | Purpose |
|---|---|
| `brand-kit` | Create or extend a brand kit with approved artwork, variants, provenance and previews |
| `cinematic-scroll` | Design and implement scroll-driven cinematic websites |
| `committee` | Independent mixed-provider review rounds, checked evidence and recorded dissent |
| `new-azure-site` | Bootstrap an Azure app from an accessible starter template |
| `orchestrate` | Delegate isolated units, integrate and ship one verified PR |
| `parallel-orchestrate` | Execute dependency-linked child issues with one PR per child |
| `parallel-plan` | Create a dependency-aware parent/child issue plan |
| `prune-tests` | Classify low-value tests, prove safe removals and ship measured cleanup |
| `security-review` | Verify security boundaries and file actionable, evidenced findings |
| `ship` | Implement and locally verify a change, own its PR through merge and cleanup |

Each skill checks its own dependencies. `brand-kit` needs authorized fal.ai access and the image/font
tools it names; it asks before spending. `new-azure-site` needs Azure, .NET, Node and template access.
`committee` needs
the participating providers' installed, authenticated CLIs; existing shell helpers require Bash and
GNU coreutils (Git Bash on Windows; install coreutils on macOS and add its gnubin directory to PATH).

Third-party skills such as Aspire, Impeccable and dotnet-inspect remain managed by their upstream
installations. The optional local bridge makes already-installed shared skills visible to Claude.
Use upstream installers on another PC; their contents are not bundled or relicensed here.
Claude keybindings in `extras/` are optional and copied manually; setup never replaces your bindings.

## Maintain and validate

```sh
npm run check
```

This builds self-contained runtime/role resources, validates names and resource links, checks
JavaScript syntax and both marketplace layouts, and runs installer/packaging/helper regression
tests. Bash regressions and live reviewer lockdown checks are described in
[validation](docs/validation.md). No CI workflow is added: run the required checks locally before pushing.

Edit common host guidance in `authoring/host-runtime.md`, native role sources in
`plugins/jason-toolkit/agents/`, and skill-specific behavior in each `SKILL.md`. Run the build to
refresh bundled copies. Generated copies allow an individual skill to work even when installed
without the rest of the plugin.
