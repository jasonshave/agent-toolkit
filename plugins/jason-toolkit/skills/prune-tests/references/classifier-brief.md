# Repository brief template

The `test-classifier` and `test-prover` agents carry the generic instructions. This brief carries what is specific to
one repository. Copy it to the session scratchpad as `prune/BRIEF.md`, replace every `<…>` with what Phase 0 found, and
delete sections that don't apply. Each classifier then gets: "Brief: `<path to BRIEF.md>`. Batch: `<paths>`. Output
file: `<scratchpad>/prune/batch-<n>-<name>.jsonl`." Provers get the same brief path plus their task file.

Must include: which suites CI runs (and which only run locally), records that name tests and whether a test checks
them, pins over test files and how to re-record them, out-of-scope folders, and every owner decision so far, described
by what the affected tests do rather than by their names.

---

# Classifier brief: prune low-value tests in <repo name> (read-only)

You are one of several read-only classifiers. Repository: `<absolute path>`, branch `<branch>`. **Do not edit any
file in the repository.** Stop only processes you started, by PID; never broad kills (`taskkill /FI`,
`Stop-Process -Name`, `pkill`, killing by image or window title). You don't need to run tests; read code.

## Read first

1. `<skill path>/references/rubric.md`, in full. It defines the categories and the "looks like this, but keep it"
   counter-cues. Use its category ids.
2. The repository's own test rules: `<CLAUDE.md / CONTRIBUTING section>`.
3. `<any test-audit record, and which part of it covers which area>`. It explains why tests were kept once; it is an
   input to your judgement, not a veto.

## Repo-specific keep rules (these override the rubric)

- `<tests named in coverage or parity maps, and which files to search; the check that fails if they go>`. Being
  named there is not a reason to keep. If you mark one `delete`, put the map entry's new target (the surviving test)
  in `covered_by`, so the coordinator can update the map.
- **Out of scope, never classify as delete:** `<folders: imported or pinned suites, golden/oracle data, vendored code,
  end-to-end journeys with a fixed count, ...>`
- Tests that pin bytes or hashes of files or encodings are contracts (rubric 16), not change-detectors.
- A test that guards a bug fixed earlier (its name or comment says so, or `git log -S '<test name>' --oneline` shows it
  arrived with a "Fix ..." commit) is a regression test: delete it only with a named survivor; the coordinator probes it.
- Byte or hash pins over test files cost nothing to re-record; never keep a test because its file is pinned.

## What to produce

Read each test **and the production code it exercises**. For duplicates, find and read the survivor and name it as
`path:TestName`; a duplicate without a named, read survivor is a `keep`.

Write one JSON object per line (JSON Lines) to your output file, one row per test (or per parameterised group), with
exactly these fields:

```json
{"file": "<path>", "test": "<test name>", "lines": "40-52",
 "verdict": "delete", "category": "asserts-the-mock",
 "guards": "what behaviour it claims to protect, in plain words",
 "why": "one sentence: why it adds nothing (or why it stays)",
 "covered_by": "<path>:<survivor> (or null)", "confidence": "high"}
```

`verdict` is `delete`, `keep`, `collapse` (say in `why` which cases stay) or `flag` (valuable but defective: real-time
waits, flaky, slow per-test setup; say the fix). `confidence` is `high`, `medium` or `low`; use `high` for a delete
only when a principal engineer would agree without hesitation. Every test in your batch gets a row, including keeps.
Be aggressive: a test you doubt is a `delete` at `medium` confidence, and the coordinator's probes settle it. `keep`
needs a one-sentence statement of what plausible mistake only this test catches.

## What to return to the coordinator (short)

Do **not** paste rows or file contents back. Return only: the output file path; counts by verdict; counts of deletes
by category; the 5 deletions you're least sure of (one line each); anything surprising (a whole file that is
low-value, production code no test reaches). Under 250 words.
