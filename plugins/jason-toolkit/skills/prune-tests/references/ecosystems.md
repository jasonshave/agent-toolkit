# Counting, timing and probing tests by ecosystem

Use the repo's own scripts first (`package.json` scripts, `validate.ps1`, `Makefile`, CI workflow steps). These are
fallbacks for counting tests and timing a run when the repo doesn't say.

## .NET (xUnit, NUnit, MSTest)

- List tests: `dotnet test <proj> --list-tests` (VSTest), or for Microsoft.Testing.Platform projects
  `dotnet run --project <proj> -- --list-tests`.
- Run and count: the summary line (`total: N`, `Passed!`); `--logger trx` writes per-test durations.
- Coverage, if already referenced: `--collect:"XPlat Code Coverage"` (coverlet) or `dotnet-coverage collect`.
- Parameterised cases: `[Theory]` with `[InlineData]`/`[MemberData]`; NUnit `[TestCase]`.
- Test folders sometimes compile into one test project instead of being projects themselves; check the `.csproj`
  `Compile Include` items before deciding a file is dead.

## JavaScript / TypeScript (Vitest, Jest, Playwright)

- Vitest: `npx vitest run --reporter=verbose` (counts per file); `--coverage` only if a provider such as
  `@vitest/coverage-v8` is installed.
- Jest: `npx jest --listTests`, `npx jest --verbose`, `--coverage`.
- Playwright: `npx playwright test --list`. End-to-end journeys are slow and often the best evidence; delete them
  only on a clear duplicate.
- Snapshot files live in `__snapshots__/`; delete a snapshot file when its last test goes.

## Python (pytest)

- List: `pytest --collect-only -q`. Run: `pytest -q` (`N passed in Xs`); `--durations=30` for the slowest.
- Coverage: `pytest --cov` if `pytest-cov` is installed.
- Parameterised: `@pytest.mark.parametrize`. Fixtures in `conftest.py` may become unused after deletions.

## Go

- List: `go test ./... -list .`. Run: `go test ./... -count=1` (avoid the cache when timing).
- Coverage: `go test ./... -cover` or `-coverprofile`.
- Table tests: one `t.Run` per row; collapse rows like any parameterised group.

## Rust

- List: `cargo test -- --list`. Run: `cargo test`. Coverage tools (`cargo llvm-cov`, `tarpaulin`) only if installed.

## Break-it-on-purpose probes, all ecosystems

Make the smallest edit that changes behaviour (invert a condition, return early, drop an item, shift a boundary by
one), run only the tests that will remain for that unit, record caught or not, then `git checkout -- <file>`.
Never leave a probe in the tree, never commit one, and confirm with `git status` that only test files changed before
Phase 3.
