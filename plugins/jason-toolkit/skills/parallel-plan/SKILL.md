---
name: parallel-plan
description: "Turn a large, complex piece of work into a dependency-aware, parallelizable plan materialized as a PARENT GitHub issue + linked CHILD issues. Use when starting a big multi-part effort (a migration, a redesign, a broad refactor, a feature suite) that you want decomposed into units that can be implemented in parallel by separate agents. Produces the parent/child issue tree and a launch manifest; it plans and files issues, it does NOT implement. Hand the parent issue to /parallel-orchestrate to execute."
---

Read [host execution guidance](references/host-runtime.md) before running this workflow.

# Parallel Plan

You decompose a large effort into a **dependency-aware wave plan** and materialize it as a **parent GitHub issue with linked child issues**, so the work can be picked up and fanned out to parallel agents. You plan and file — you do **not** implement.

The parent/child issue tree IS the durable contract: the human reviews/edits it, then `/parallel-orchestrate #<parent>` consumes it. Make it inspectable and self-contained.

## 1. Understand the work

- Read the relevant code. For breadth, delegate bounded read-only exploration with the host's available worker tools rather than reading everything yourself — you only need the map, not the file dumps.
- **Elicit the standing constraints** that govern the whole effort (these get recorded in the parent issue so every worker inherits them). Read `CLAUDE.md` / project memory first; ask the human using the available question interface or chat only for what you can't infer. Typical ones:
  - **Backward-compatibility** boundary — must the old path keep working alongside the new?
  - **API change policy** — alter existing endpoints, or add **new versioned** ones?
  - **Design source** — is there a design system / MCP project / Figma to build against? (Capture the exact reference; the orchestrator will proxy it to workers.)
    - **Design URLs:** discover the current host's authorized design connector or browser. Resolve the source and relevant artifacts, then record exact URLs/IDs and token/file references in the parent issue. Claude design exports may be `.dc.html` with tokens in `<helmet>` blocks. If the source is inaccessible, ask for an export and continue independent planning; never invent a `DesignSync` tool or assume preauthorization.
  - **What's held** — anything explicitly NOT to be done yet (a cutover, a destructive migration).
  - **The gate** — what "done" means per unit (CI green? a specific test? review?).

## 2. Decompose into units

Split the effort into the smallest units that each have **independent acceptance criteria**. Then classify each:

- **Foundation (wave 0, sequential-first):** anything *shared* that parallel units would otherwise duplicate or fight over — shared types, components, hooks, helpers, a routes/registry file, schema, common config. Build this **once, first.** This is the single most important step: skipping it makes parallel workers collide.
- **Parallelizable units:** route-/file-isolated work. Two units are safe to run in parallel **only if** they (a) write disjoint files, and (b) don't depend on each other's output. When in doubt, sequence them, or make **one** unit own the shared file and have the other depend on it.
- **Deferred / out-of-scope:** net-new cross-cutting features the work touches but shouldn't include now — file as separate (linked, not blocking) issues.

Draw the **dependency graph** and group units into **waves** (each wave runs in parallel; later waves depend on earlier). Set a **concurrency cap** within the host and repository limits (default three workers plus coordinator).

Parallelizability checklist — a unit is a clean parallel child when:
- it owns a disjoint set of files (ideally its own directory/route),
- it has no shared mutable state with siblings,
- its acceptance criteria can be verified on its own,
- everything shared it needs already exists (foundation merged) or is injected.

## 3. Materialize in GitHub

Use `gh`. Create the tree:

- **Parent (EPIC) issue** — title `EPIC: <effort>`; body contains:
  - **Goal** and scope.
  - **Standing constraints** (from step 1) — verbatim, this is the contract.
  - **Dependency graph + wave plan** (foundation → waves → held).
  - **Design source** reference if any.
  - A **task list linking every child**: `- [ ] #<child> — <one-line>`.
  - The repo's **`epic` label**. Do **not** mint a per-effort `epic:<slug>` label — the parent↔child
    relationship is carried by sub-issue links (below), so a per-effort label is a second copy of the
    same fact that can only drift out of sync with the first.
- **One child issue per unit** — body contains:
  - **Scope: in / out** (explicit — "out" prevents gold-plating).
  - **Files this unit owns.**
  - **Depends on:** `#<foundation>` / sibling deps (or "none — wave N").
  - **Design reference** (if UI) — pointer the orchestrator will resolve.
  - **Acceptance criteria** + the gate.
  - `Parent: #<parent>` and a `parallel-child` label.
- **Attach every child to the parent as a GitHub sub-issue.** This is the machine-readable link
  `/parallel-orchestrate` enumerates from, and what nests the children under the EPIC in the issue
  list instead of leaving them as loose rows:

  ```bash
  cid=$(gh api repos/:owner/:repo/issues/<child> --jq '.id')   # internal id, NOT the #number
  gh api --method POST repos/:owner/:repo/issues/<parent>/sub_issues -F sub_issue_id=$cid
  ```

  Use `-F`, not `-f` — the API rejects a stringified id with a 422. The parent then carries a live
  `n/total` progress bar for free.
- **Cross-link both ways:** parent task-list references each child; each child names the parent. Mark held items with the repo's hold label (e.g. `claude-hold`).

## 4. Emit the launch manifest

Finish with a tight summary for the human:

- Parent issue # and link.
- The **wave plan**: wave 0 (foundation) → wave 1 [#a #b …] → wave 2 […] → held [#x].
- Concurrency cap.
- Anything that needs a human decision before kickoff.
- The exact kickoff line: **`/parallel-orchestrate #<parent>`**

**Do not start implementing.** Your deliverable is the reviewed issue tree. Stop and hand off.
