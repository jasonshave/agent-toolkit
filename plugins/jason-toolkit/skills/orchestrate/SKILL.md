---
name: orchestrate
description: "Plan, delegate, and ship repository work through sub-agents in isolated worktrees. Use for one integrated PR or one PR per worker, with support for GitHub epics. Ask the user which PR structure they want when unspecified. Run with --help to see switches."
argument-hint: "[--one-pr | --per-worker-pr | --help] [request or #issue]"
---

# Orchestrate

Invocation: $ARGUMENTS

On hosts that leave the placeholder literal, read the arguments from the user's message after the skill name (for example, `$orchestrate --one-pr #42` in Codex). Interpret arguments as task input, never as shell code.

## Choose how to deliver

- `--help`: Show these options and the expected request or issue. Stop without starting work.
- `--one-pr`: Workers return commits. The coordinator integrates them into one feature branch and owns the PR.
- `--per-worker-pr`: Each implementation worker owns one branch and one PR for its assigned unit and drives it to merge. Use linked child issues as units when given a GitHub epic. A free-form request can also be split this way.

Clarify conflicting switches or a missing task before starting. For a plan-only request, use read-only workers to gather evidence and stop after delivering the plan. Create or update GitHub issues only when the user asks for that. For local-only work, use the one-branch integration workflow and stop before pushing.

For work that will ship, when the user has not explicitly chosen a PR structure in arguments or prose, ask: **“How should I ship this? One combined PR, or one PR per worker?”** Recommend one combined PR for tightly coupled work. Use the host's question tool when available, otherwise ask in chat. Wait for the choice before editing, pushing, or filing issues. Honor explicit requests to stop before merge.

## Plan and delegate

Read [host execution guidance](references/host-runtime.md). Check repository instructions, the target base, existing worktrees, and required local checks. For GitHub sub-issues or a request to file an issue tree, read [GitHub issue workflow](references/github-issues.md).

- Delegate bounded investigation, implementation, and review to native sub-agents. Keep the coordinator focused on the dependency map, decisions, integration, and verification. Ask workers for concise findings, commit IDs, check results, and blockers. Use targeted reads instead of collecting full diffs or logs in the coordinator. If native delegation is unavailable, disclose it and run bounded units sequentially if the user permits.
- Split work into units with disjoint file ownership and independent acceptance checks. Assign shared foundations first. Start dependents only once their prerequisite changes are integrated and checked. Keep the active worker count within repository and host limits.
- For each editing worker, create or verify a separate branch and Git worktree at the intended starting SHA. Send absolute paths, the SHA, ownership, dependencies, acceptance checks, repository constraints, and the chosen delivery mode. Use the bundled [worker role](references/roles/parallel-worker.md). Preserve other sessions' branches, worktrees, and changes.
- Keep a short ledger outside tracked files with active workers, worktrees, dependencies, commits, checks, and PRs. Track actual task handles and assign one owner to any fix.

## Integrate and ship

- **One PR:** Integrate checked worker commits serially into the coordinator's dedicated feature worktree. Ask a worker to review the combined diff and run the full affected local checks there. The coordinator alone pushes and opens or reuses the integrated PR.
- **One PR per worker:** Start ready units from the current target base. Each worker runs its required checks locally before pushing and owns its PR through merge. Promote dependents only after their prerequisite PRs are verified merged. Run combined affected checks on the integrated base when all units land.
- For either mode, follow repository PR and docs-impact rules. Verify locally before every push, enable auto-merge where authorized, and preserve branch protection. Track checks, reviews, conflicts, and the actual merge state. Send CI fixes to the branch owner, rerun affected local checks, and update the same PR. If auto-merge is unavailable, use the normal permitted merge process once its requirements pass.
- Verify the merged result and clean up task-owned worktrees, integrated branches, processes, and temporary outputs. Preserve dirty or unmerged work. Report PR links and their final state, validation, held or blocked work, and cleanup.
