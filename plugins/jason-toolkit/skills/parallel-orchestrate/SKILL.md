---
name: parallel-orchestrate
description: "Execute a GitHub parent epic's dependency-linked child issues with isolated workers, one PR per child, local verification, auto-merge and cleanup. Use for an existing parent/child implementation plan; use orchestrate for one integrated PR."
---

Read [host execution guidance](references/host-runtime.md) before running this workflow.

# Parallel orchestrate

Own the requested parent epic through completion of every non-held child. Keep a ledger of issue
dependencies, worker handles, starting commits, owned files/worktrees, checks, PRs and final states.
Work in the coordinating session. Respect user and repository instructions over the plan.

1. Read the parent and enumerate all linked sub-issues with pagination
   (`gh api repos/<owner>/<repo>/issues/<parent>/sub_issues`). Read child acceptance checks and
   dependencies, current repository state and default branch. Respect held items. Preserve others'
   branches, worktrees and services. Never sweep all `claude/*` branches or all agent worktrees.
2. Build shared foundations first through their own checked PR. A dependency is ready only once
   integrated and verified, not when its worker says implementation is done. Re-evaluate the wave graph
   against the current base after each dependency lands. Resolve disjoint file ownership before launch.
3. Resolve design references with an available authorized connector/browser. Inline each child's needed
   tokens, structure and artifacts in its brief; record the source. If inaccessible, request an export
   and continue unaffected work. Use the project's actual design system and available design skills.
4. Start bounded workers with the bundled [parallel-worker role](references/roles/parallel-worker.md).
   Use at most repository/host capacity (default three workers plus coordinator). Create a unique
   branch and Git worktree at the current integrated base before launch, unless native isolation is
   available and verified. Pass absolute paths and starting SHA; require verification before edits.
   Never use `reset --hard` to align a worker or operate on another session's checkout.
5. Each brief gives child scope, owned paths, dependency commits, design, constraints, full local
   acceptance commands, PR/base conventions, docs-impact procedure and reporting format. Workers own
   one PR each and drive it to merge. The coordinator alone changes shared composition/config/contracts.
6. Track real task handles/completion events and PR states. As slots free, launch ready children. Route
   CI failures and conflicts to the same branch owner; never start competing writers. Re-run affected
   local checks before corrective pushes. Use normal authorized merges and preserve protections.
   If blocked by actual approval/access, keep independent children moving and report it plainly.
7. Verify each child's merged state and acceptance criteria, update parent progress, then run combined
   affected checks at the integrated base in the coordinator's task worktree. Fix cross-child failures
   through a checked PR. An open PR or unfinished non-held child is not completion.
8. Stop only task-owned processes by known handle/PID. Remove only verified clean task worktrees and
   branches whose work is proved included in merged PRs; preserve dirty/unmerged work. Remove recorded
   scratch/build paths. Report merged PRs, deferred/held items and retained paths with reasons.

If this host cannot run native workers, execute the same child briefs sequentially in isolated
worktrees and disclose that mode; preserve the dependency, evidence and shipping requirements.
