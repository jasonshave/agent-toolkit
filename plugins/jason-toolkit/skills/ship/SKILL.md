---
name: ship
description: "Implement and ship a requested feature or fix through a locally verified pull request, enable auto-merge, resolve CI failures and conflicts, and verify the merge. Use when asked to ship work or take a change through to merged."
---

Read [host execution guidance](references/host-runtime.md) before running this workflow.

# Ship

Take the requested change through a merged PR. Invoking this workflow authorizes the branch, commit,
push, PR and auto-merge for that task, within the user's constraints and repository rules.

1. Discover instructions, the target repository and default branch, existing changes, the actual build
   and test commands, and any documentation requirements. Preserve the user's checkout and unrelated
   changes; create a task branch/worktree where necessary. Do not hardcode a branch prefix or provider.
2. Implement the request using the repository's patterns and meaningful regression coverage. Run every
   required affected local check before pushing. Client changes require the full client suite, lint,
   type checking and production build; run affected backend and E2E suites too. Fix failures and rerun.
   If a user's service holds build outputs, use an isolated task build; stop only processes you own.
3. For repositories with `.claude/docs.json` or an equivalent docs policy, read that configuration and
   perform its docs-impact procedure. Resolve the named skill if available; otherwise inspect the
   procedure in the repository and produce the same updates and required PR fields. Respect actual
   owner-review requirements. Do not treat a Claude-specific hook as the only enforcement of the policy.
4. Inspect the diff and stage explicit task paths. Follow repository authorship conventions. Check
   suspicious credential/binary paths by content without printing secrets; do not invent model trailers
   or vendor footers. Commit, fetch the current base, and integrate it when repository rules require it
   or conflicts exist. Rerun affected checks after any correction or integration.
5. Push the task branch. Create or reuse its PR with a concise outcome and actual validation evidence.
   Use a body file for multiline text. Keep drafts while work is incomplete if that saves CI runs.
6. Enable auto-merge using an allowed merge method, e.g. `gh pr merge <number> --auto --squash`. Inspect
   `autoMergeRequest`, state, required checks and mergeability; the command can merge immediately when
   requirements already pass. Never report auto-merge as armed without checking. Do not bypass reviews,
   protections or checks. If auto-merge is unavailable, use the normal authorized merge path after checks
   and reviews pass, or report the exact access/approval blocker. Do not change settings silently.
7. Own the PR until merged. Use the host's completion events or short status checks. A failed required
   check needs its real logs, a correction, all affected local checks and one batched push. Resolve
   conflicts while preserving both sides' behavior. A closed, unmerged PR is not success. Don't depend
   on a `Monitor` tool or edit the user's tool permissions to keep a watcher running.
8. Verify the merged state and commit and any required post-merge validation. Stop task-owned services,
   remove verified clean task worktrees and build/scratch outputs, and preserve durable records and
   any unmerged/user work. Report the merged PR link, checks, and any concrete retained paths.

If delegating the shipping step, use the bundled [ship-pr role](references/roles/ship-pr.md); that
worker has the same local verification and merge ownership obligations. Escalate only decisions or
external access that cannot be resolved within the authorized scope; continue independent work.
