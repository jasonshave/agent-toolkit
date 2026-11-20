---
name: orchestrate
description: "Delegate repository work to sub-agents in isolated worktrees, integrate into one feature branch, and drive one pull request through CI and auto-merge. Use when the user invokes orchestrate or asks for this delegated shipping workflow."
---

Read [host execution guidance](references/host-runtime.md) before running this workflow.

# Orchestrate

Act as the orchestrator. Delegate implementation, investigation, review, and fixes to sub-agents to keep your context clean. Own the plan, integration, verification, and delivery. Use your best judgment for routine decisions; involve the user only for important decisions or blockers you cannot resolve yourself.

Invoking this skill authorizes committing, pushing, opening one PR, and enabling auto-merge for the requested work, subject to the user's constraints and repository rules. Stay within the requested scope.

## Set up

- Discover the repository root, instructions (including AGENTS.md and CLAUDE.md where applicable), remote, intended base branch, build/test commands, and PR conventions. Do not assume a language, framework, branch name, OS, or hosting provider.
- Preserve existing changes, branches, and other sessions' worktrees. Create a uniquely named feature branch from the appropriate base in a dedicated integration worktree; do not switch or reset the user's checkout.
- Define what completion means and split work by ownership and dependencies. Delegate shared foundations first, then independent units in parallel within available agent limits.
- Keep a small ledger outside tracked files: base and feature branches, worktree paths, agents, tasks, commit IDs, validation, decisions, and PR URL. Resume from it after interruption or context compaction.

## Delegate and integrate

Use the host's available native worker tools (Claude Agent, Codex collaboration, Copilot tasks/custom agents or Grok subagents). Read the bundled [worker role](references/roles/parallel-worker.md), and state in the brief that this orchestrate workflow overrides its per-child PR instructions: workers commit to isolated branches and return commits; only the coordinator ships the integrated PR. If delegation is unavailable, disclose sequential execution and use the same bounded unit briefs, ownership, ledger and acceptance checks. Never claim independent review when the same session performed both passes.

Every agent that edits files gets a separate worktree and worker branch based on the relevant feature-branch commit. Use native worktree isolation when supported; otherwise create worktrees with git and give agents explicit absolute working paths. Never assume spawned agents have changed directories.

Give each worker the objective, acceptance checks, ownership, constraints, dependencies, worktree path, and starting commit. Require a committed result and a concise report containing commit IDs, changed paths, checks/results, and unresolved issues. Workers must not open PRs, merge the base branch, or mutate the shared integration branch. Ask for summaries rather than file dumps.

Integrate returned commits into the feature branch sequentially with cherry-pick or merge, following repository conventions. Delegate conflicts and cross-unit fixes to an agent based on the current feature tip. Avoid concurrent writers to the integration worktree. Delegate review of the combined diff and run appropriate combined checks; worker success alone does not prove integration works.

## Ship one PR and finish CI

- Push only the feature branch and create or reuse exactly one PR from it to the intended base. Write a concrete description of changes and validation. Do not create per-worker PRs.
- Open the PR as a draft (gh pr create --draft) and keep it in draft while work is still being integrated. Every push to a ready PR can start a full CI run that the user pays for; pushes to a draft do not where the repository's CI skips drafts (check the workflow triggers; if it doesn't skip drafts, don't push until the branch is final). Mark it ready (gh pr ready <number>) only once: after every unit is integrated and the combined local checks pass. Then enable auto-merge.
- After the PR is ready, push again only to fix a CI failure or resolve a real conflict with the base. Do not merge the base branch into the PR just to keep it current; the PR check already tests the merge result.
- For GitHub, use gh or an available connector to create the PR and enable auto-merge with a repository-supported merge method (for example, gh pr merge <number> --auto --squash when squash is allowed). Use the host's equivalent workflow elsewhere.
- Monitor required checks, reviews, mergeability, and merge state. Keep watching until the PR is actually merged; enabling auto-merge or seeing green checks is not completion.
- When CI fails, obtain the failed job's relevant logs and delegate diagnosis and fixes in a fresh or reused worker worktree based on the latest feature tip. Integrate, validate, push to the same PR, and repeat. Delegate base-branch conflicts the same way.
- Do not weaken checks, bypass branch protection, force-push others' work, or change repository settings to get a merge. If auto-merge is unavailable, merge through the normal permitted workflow after required checks and reviews pass. If access, required human approval, or an external outage blocks progress, preserve the PR and report the exact blocker.
- Retry while evidence supports progress. For repeated identical failures, delegate a deeper diagnosis or a different approach rather than looping blindly. Escalate only when there is no actionable path within your authority.

## Close out

Verify the PR's merged state and merge commit, and any task-required post-merge checks. Remove only this run's clean worktrees and branches whose commits are integrated or whose work is confirmed included in the merged PR; preserve unmerged or dirty work. Stop only processes this run started.

Give a concise final summary: work completed, significant decisions you made, validation results, and the single PR link and merge status. Clearly identify any genuine unfinished work. Do not claim success while the PR is still open.
