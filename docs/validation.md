# Validation and acceptance

Run `npm run check` before pushing. There is no dependency install or generated dependency tree.
The build refreshes portable runtime/role resources, validation checks names, links and JavaScript
syntax, and the Node suites exercise real filesystem install/upgrade/uninstall operations, backup
restoration, edited-file refusal, links/junctions, project installs, legacy aliases and standalone
resource packaging. Tests use unique system-temp roots and remove them after each case.

Also run the existing committee regressions:

```sh
node plugins/jason-toolkit/skills/committee/test-trust-check.js
bash plugins/jason-toolkit/skills/committee/test-verified-record.sh
```

Check all committee shell scripts with `bash -n`. On Windows explicitly use Git Bash, not the
unrelated Windows/WSL `bash.exe`. Bash runners need GNU `timeout`, `sha1sum` and ordinary coreutils;
on macOS add Homebrew coreutils' `gnubin` directory to PATH.

Live reviewer checks use authenticated providers and consume a small amount of plan/API usage:

```sh
bash plugins/jason-toolkit/skills/committee/self-test.sh codex grok
node plugins/jason-toolkit/skills/committee/self-test-claude.mjs
```

These exercise fresh and resumed reviewer sessions against an owned disposable Git repository.
They clean fixture files and preserve only version/fingerprint verification records. A failed or
inconclusive run is not a newly verified provider. Never bypass the tool restrictions to get a pass.

For an installable archive run `npm pack --pack-destination <task-artifact-directory>` and test the
extracted package in a new home using the same installer. Do not publish to npm. Test a copy rather
than linking the source so missing packaged references are observable. Record and clean the archive,
extraction, disposable homes, CLI caches and smoke fixtures individually.

Acceptance for a host means checking its actual discovery (`grok inspect --json`, Copilot's skill
listing, Codex's prompt input or a real session, and Claude's native validation/session) and running
a representative bounded workflow. A manifest validator alone is not evidence of model behavior,
authentication, provider availability, deployments or all future host versions. Keep those limits
explicit in validation results.
