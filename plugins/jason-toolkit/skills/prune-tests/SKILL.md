---
name: prune-tests
description: "Sweep a repository's test suites for tautological and other low-value tests (tests that mirror the implementation, assert what a mock was told to return, only check that something was called, render-without-crashing checks, tests of the framework or of a fake, duplicates of another test or an end-to-end journey, snapshot and exact-wording change-detectors, DTO/getter/constructor tests, legacy or compat paths nobody uses), prove each removal leaves no real behaviour unguarded, delete them on a branch and open a PR with before/after test counts and run times. Use this whenever the user complains about test bloat, slow or expensive CI caused by too many tests, \"hundreds of pointless tests\", tautological or change-detector tests, wants a test audit, cleanup, sweep or prune, or asks which tests are worth keeping, even if they don't say \"prune\"."
---

Read [host execution guidance](references/host-runtime.md) before running this workflow.

# /prune-tests: keep the tests a principal engineer would keep

AI-written code tends to arrive with far more tests than a senior engineer would write: tests that restate the
implementation, tests of mocks, tests that pin exact wording, the same behaviour checked three ways. They cost CI
minutes on every push, slow every refactor (they break when nothing is wrong) and hide the few tests that matter.
This skill finds them, proves removing them is safe, and ships the removal as one reviewable pull request.

The bar for **keeping** a test is high, on purpose: it would catch a real mistake a person could plausibly make, in
behaviour someone relies on, that no other kept test (unit, integration, golden replay or end-to-end journey in CI)
would catch, and that catch is worth what the test costs to run and maintain. One good test per behaviour, not one
per variation. Everything else goes, including tests that are merely "nice to have", that check exact wording no
client parses, or that validate the test suite's own fixtures.

The bar for **deleting** one is evidence, not taste, but uncertainty is resolved by proving, not by keeping. A
doubtful test is a candidate, and Phase 2 settles it: a named, read survivor, or a break-it-on-purpose probe that a
remaining test catches. Only a test that turns out to be the sole guard of real behaviour stays. A sweep that deletes
the only guard of real behaviour is a failure; a sweep that keeps tests "to be safe" is also a failure, just a quieter
one, because those tests cost CI minutes and slow every refactor forever.

Repository records are inputs, not vetoes. Coverage or parity maps, test-audit ledgers, "retained" lists and byte or
hash pins say why a test was kept once; they don't make it valuable now. Judge the test itself. When a deleted test is
named in such a record, update the record in the same PR (point a map entry at the surviving test, re-record a pin,
amend the ledger), and say so in the PR. Re-recording a pin is mechanical and never a reason to keep a test. The one
exception is a check that a repository's owner has explicitly said must not change; ask before touching it.

## Arguments

| Argument | Effect |
|---|---|
| *(none)* | Sweep every test suite in the repository. |
| `path`, `project` or `suite` | Limit the sweep to it, e.g. `web/src`, `tests/App.Cli.Tests`, `e2e`. Several may be given. |
| `--report-only` | Classify and settle the list, but change nothing: stop after Phase 2 and present the report. |
| `--only <kinds>` | Remove only these rubric categories, comma-separated, e.g. `--only asserts-the-mock,implementation-mirror,trivial-render`. Everything else is still classified and reported, just not deleted. |
| `--auto-merge` / `--no-auto-merge` | Override the repository's own auto-merge rule for this PR (Phase 4). Without either, follow the repo's rule. |

If an argument doesn't match these, ask once what was meant rather than guessing, since a wrong scope deletes the
wrong tests.

## How this runs: a thin coordinator and two kinds of helper

The session that invoked the skill is the **coordinator**. Give every classifier the absolute path to this skill's `references/rubric.md`; role files are bundled for hosts without named Claude agents. In disclosed sequential mode, execute one bounded role/batch at a time with the same ledger and evidence; do not read every suite at once. With workers, the coordinator decides, records, merges and verifies; it doesn't read
test files in bulk or edit tests itself. Reading hundreds of tests and the code behind them would fill its context long
before the sweep ends, and a sweep's value depends on the coordinator still remembering every rule and decision at the
end. Two agent types do the work:

- **`test-classifier`** ([bundled role](references/roles/test-classifier.md), read-only): reads a batch of tests and the code they exercise, writes one JSON Lines verdict
  per test to the scratchpad, returns a short summary. On a plugin install the type is `jason-toolkit:test-classifier`.
- **`test-prover`** ([bundled role](references/roles/test-prover.md), in its own verified Git worktree): applies one batch's deletions, re-points records
  in its folders, breaks production code on purpose to prove each removal, restores any test that turns out to be the
  only guard, commits test-side changes only. Plugin type `jason-toolkit:test-prover`.

Around them:

- **Results go to files.** The coordinator reads rows with scripts (count, filter, join, sample), never by pasting.
- **One repository brief.** Write the repository's rules once to the scratchpad from `references/classifier-brief.md`
  (audit records, maps, pins, out-of-scope folders, which suites CI runs, owner decisions) and pass its path to every
  helper with its batch and output file.
- **A ledger on disk.** Keep `prune-ledger.md` in the scratchpad: baseline, rules found, each batch's status and result,
  owner decisions, and what the coordinator still owes (shared files, stale names). Long sessions get summarised; the
  file doesn't.
- **Bounded helpers.** Use the lower of host/repository limits, default three workers plus coordinator. Start the next batch as one finishes; on a host without delegation, execute the same role briefs sequentially and disclose that mode.
- **No nested delegation.** If started inside a worker, hand fan-out back to the coordinator. Do not silently reduce the requested scope. Preserve the batch ledger and finish the authorized scope sequentially where the host lacks workers.

## Phase 0: Understand the repository and take a baseline

1. **Read the rules that already exist.** `CLAUDE.md`, `AGENTS.md`, `CONTRIBUTING`, the test folders' READMEs and any
   test-audit record. Note the PR and merge rules (auto-merge, branch names, required checks, docs or PR-description
   gates) for Phase 4.
2. **Map every suite, and what CI really runs.** Unit, integration, end-to-end, snapshot, property-based; which command
   runs each locally; which CI jobs run which (read the workflow files and the scripts they call). A survivor only
   counts as coverage if it runs in CI; end-to-end journeys that run only locally are the usual trap. Put this in the
   brief. `references/ecosystems.md` has per-language commands.
3. **Find records that name tests.** Coverage or parity maps, inventories, provenance or evidence files, READMEs that
   list tests, and byte or hash pins over test files (grep for test names and `sha256` outside the tests). Note which
   ones a test actually checks (deleting a named test then fails it) and which are historical. Plan to re-point and
   re-pin, not to keep tests because of them.
4. **Start clean.** A new branch from the up-to-date default branch; if the working tree has someone's uncommitted
   changes, use a separate worktree instead of stashing or committing their work.
5. **Baseline.** Run every suite in scope once: test count, wall-clock time, pass/fail per suite. A red suite stops the
   sweep: removal can't be shown safe against it. Record coverage too if a tool is already set up; don't install one
   without asking.

## Phase 1: Classify

List every test file in scope with its test count and split them into batches of roughly 20 to 40 files by folder (one
batch for a small repo). Start a `test-classifier` for each batch with the brief path, the batch and an output file,
and record it in the ledger. When all are back, tally with a script.

## Phase 2: Settle the list before anything is deleted

1. **Apply owner decisions by purpose, not by name.** When the owner decides something about a kind of test ("keep the
   checks that a coverage map binds existing tests"), find every test that does that job, whatever it's called, and
   fix its verdict. Matching on names misses variants.
2. **Separate the owner's calls.** Group rows whose only survivor doesn't run in CI, rows that would retire a check the
   repository relies on, and anything touching a legal or contractual guarantee; ask the owner once, with a
   recommendation, then apply the answer.
3. **Resolve survivor conflicts.** With a script, find any candidate whose named survivor is itself a candidate (chains
   and loops across batches). Keep one test in each loop, and keep any candidate whose survivor is going.
4. **Low confidence stays.** Low-confidence rows go to "kept, worth a look". High and medium rows go to the provers;
   their probes decide.
5. **Argue the other side** on large sweeps: give an independent sub-agent a random 10 to 20 percent of the remaining
   candidates with the code but not the reasoning, and ask it to argue for keeping each. A concrete mistake only that
   test would catch wins; then look again at the rest of that classifier's rows in the same category.

Write one task file per batch (JSON Lines of the surviving `delete` and `collapse` rows). With `--report-only`, stop here
and present the report (Phase 4's structure) without proving or deleting; with `--only`, keep only rows in those
categories.

## Phase 3: Prove, apply and merge

1. **Provers.** Create and verify a unique Git worktree for each `test-prover` batch (or use verified native isolation), giving it the task file, its batch folders
   and test commands, a probe-log path, the shared files it must not touch, the package setup to use, and the owner
   decisions. Each returns a branch with test-side commits, its before/after counts and times, and what it restored.
2. **Merge as they land.** Merge each prover's branch into the sweep branch, check its diff touches no production code
   (`git diff --stat <base> <branch> -- <source folders>` minus tests), then remove its worktree and branch.
3. **Shared records, once, at the end.** Re-record cross-suite pins, re-point map bindings that live outside the batch
   folders (point each at the surviving test, keeping the file's formatting, and never edit a record a test fingerprints
   without updating that test's expectation), update the test-audit record with this pass, and list historical records
   that still name removed tests rather than rewriting history.
4. **Verify everything.** The full build with the repository's warning rules, every suite in scope, lint, type check
   and format check, plus end-to-end suites if any product or journey code changed. Everything passes. Record the
   final counts and times, and the actual removed tests (diff test names between the base and the branch, not the
   task files: restores and merges change the list).
5. **Production code never changes in this PR.** Dead code the probes found goes in the report.

## Phase 4: Open the pull request

Write the PR for a principal engineer who will skim it. Plain language; lead with the outcome.

```markdown
Removes <N> low-value tests (<before> → <after>) from <suites>. Local run time <before> → <after>.

## What was removed, by kind
- **Tests that check what a mock was told to return** (<count>): e.g. `OrderServiceTests.Get_returns_order`, ...
- **Duplicates of another test** (<count>), each still covered by the test named in the list below.
- ...

## How each removal was checked
<survivors read; N break-it-on-purpose probes, all caught by a remaining test except: ...; coverage change if measured>

## Kept, but worth a look
<medium-confidence rows, and `flag` rows: real-time waits, flaky or slow tests, with one line each>

## Dead code the sweep found
<production code no remaining test reaches and nothing calls; not removed here>

<details><summary>Every removed test</summary>

| Test | Kind | Why it adds nothing | Still covered by |
|---|---|---|---|

</details>
```

GitHub limits a PR body or comment to 65,536 characters: keep the summary in the body and post the full table as follow-up
comments, split so each stays under the limit. If the repository gates PR descriptions with a hook (a required
"Docs impact" or similar line), write the body to a file and pass it with a literal `--body-file <path>`: hooks that
read the command can't see a shell variable or standard input.

`--auto-merge` or `--no-auto-merge` decide it when given. Otherwise follow the repo's merge rules from Phase 0. Where the repo grants standing permission for auto-merge, enable it;
where it doesn't, leave it off and say so, because a large test deletion is exactly the kind of change an owner may
want to read first. Then own the PR to merged: fix CI, resolve conflicts, rerun the affected suites before pushing a
fix, and confirm the merged state.

## Things that look deletable but usually aren't

The rubric covers these in detail; the short version, so they come to mind while classifying:

- A test named after a bug or issue (`Regression_1234`, a comment linking an incident) guards a mistake someone
  already made once. Keep unless a named survivor asserts the same thing.
- Contract and format tests (serialization round-trips, wire formats, stored-data compatibility, migrations, public
  API shapes) look like change-detectors but protect other systems and old data.
- Security boundaries (authorization per role, input validation, escaping) are worth a test per boundary even when
  repetitive.
- Property-based and concurrency tests look odd and slow; they are often the only tests that find real defects.
- An end-to-end journey that overlaps unit tests: keep the journey; remove the unit test only when the journey truly
  asserts the same outcome.
