# Test value rubric

Read all of this before classifying. Each category has what it looks like, why it adds nothing, and the counter-cues
that mean "looks like this, but keep it". When a test fits a category but a counter-cue applies, the counter-cue wins.

The question behind every verdict: **what plausible mistake in the code would make this test fail, and would any
other kept test fail too?** If no plausible mistake fails it, it's tautological. If another kept test fails as well,
it's a duplicate. If the only thing that fails it is a harmless change (rewording, reordering, refactoring), it's a
change-detector.

## Contents

1. Tautological: mirrors the implementation
2. Tautological: asserts the mock
3. Interaction-only
4. Trivial render or smoke
5. Testing the framework, the language or a library
6. Testing a fake or a test helper
7. Duplicate of another test
8. Duplicate of an end-to-end journey
9. Change-detector: snapshots and exact wording
10. Change-detector: private internals
11. Data holders: DTOs, getters, setters, constructors, enums
12. Legacy or compat paths with no users
13. Over-parameterised
14. Skipped, disabled or empty
15. Defective but valuable (flag, don't delete)
16. Always keep

---

## 1. Tautological: mirrors the implementation  (`implementation-mirror`)

The expected value is computed the same way the code computes it, so a wrong formula is wrong in both places.

```csharp
var expected = order.Lines.Sum(l => l.Price * l.Quantity);   // same expression as Order.Total
Assert.Equal(expected, order.Total);
```
```ts
expect(formatPrice(n)).toBe(`$${(n / 100).toFixed(2)}`)        // restates formatPrice
```

Cues: the assertion's expected side calls the same helpers, repeats the same expression, or calls the function under
test itself. Counter-cues: the expected value is a literal worked out independently (`Assert.Equal(1250, total)`);
the test compares two *different* implementations on purpose (an optimised path against a simple reference, or a
port against the original). Those keep.

## 2. Tautological: asserts the mock  (`asserts-the-mock`)

A dependency is stubbed to return X, and the test asserts the result is X, with nothing in between that could go
wrong.

```ts
repo.find.mockResolvedValue(order)
expect(await service.get(1)).toBe(order)
```

Cues: the value flows straight from the stub to the assertion; the code under test is a pass-through. Counter-cues:
the code transforms, filters, maps errors or makes a decision between stub and result, and the test checks that
decision. That's a real unit test; keep it.

## 3. Interaction-only  (`interaction-only`)

The only assertion is that something was called (`toHaveBeenCalled`, `Verify(x => x.Save(...), Times.Once)`), not
what happened as a result.

Cues: no assertion on returned values, state, output or side effects other than the call. Counter-cues: the call *is*
the behaviour and has no other observable result: sending an email or webhook, writing an audit record, calling a
payment provider, publishing an event. "Exactly once" matters for those (double-charging, duplicate notifications).
Keep them, ideally asserting the payload too.

## 4. Trivial render or smoke  (`trivial-render`)

"Renders without crashing", "component is defined", "page has a heading", "module imports", "constructor doesn't
throw".

Cues: no interaction, no data-dependent assertion, nothing that would fail unless the code didn't compile or import.
The build and type check already catch those. Counter-cues: a smoke test of a whole deployed service or start-up path
that compilation can't catch (configuration binding, dependency-injection wiring, routes registered) can be worth one
test per application, not per component.

## 5. Testing the framework, the language or a library  (`tests-the-framework`)

The test proves that React re-renders on state change, that ASP.NET binds JSON, that EF saves an entity, that
`Array.sort` sorts, that a validation attribute validates.

Counter-cues: the test pins *your configuration* of the framework (custom serializer settings, a route constraint, a
policy you registered) where a wrong setting is a plausible mistake. Keep one per configuration decision.

## 6. Testing a fake or a test helper  (`tests-a-fake`)

Tests of in-memory fakes, builders, fixtures, test data factories or mock setups. They prove the scaffolding works,
not the product.

Counter-cues: a fake that other tests rely on to behave like the real thing, where a contract test runs the same
cases against the fake *and* the real implementation. That pair keeps.

## 7. Duplicate of another test  (`duplicate`)

Another kept test fails for the same mistakes: same code path, same outcome asserted, perhaps with different names or
data. Common after several sessions each add "a test for this".

Always name the survivor. Prefer to keep the test that is faster, clearer, or asserts more of the outcome. Counter-
cues: same function but a different branch, boundary or error path is *not* a duplicate.

## 8. Duplicate of an end-to-end journey  (`duplicates-e2e`)

A unit or component test whose assertion an end-to-end journey already makes on the real system. Keep the journey;
delete the smaller test only after reading the journey and confirming it asserts the same outcome, not just that it
passes through the same screen.

## 9. Change-detector: snapshots and exact wording  (`change-detector-copy`)

Snapshot files of whole components or responses; assertions on full sentences of UI copy, log messages, CSS classes or
markup structure. They fail on harmless rewording and pass on real bugs (a wrong number inside a correct sentence still
matches a snapshot that was re-recorded).

Counter-cues: the wording *is* the contract: an error code or message a client parses, a CLI's machine-readable
output, an accessibility name tests and assistive tech depend on, legally required text. Keep those, and prefer
asserting the meaningful part over the whole string.

## 10. Change-detector: private internals  (`tests-internals`)

Tests that reach into private fields or methods (reflection, `InternalsVisibleTo` used to poke at helpers, testing
non-exported functions through hacks), assert internal call order, or check intermediate data structures. They break
on every refactor.

Counter-cues: an internal algorithm whose correctness is hard to see through the public surface (a parser, a diff,
a scheduler, a hash) is worth testing directly. Keep those.

## 11. Data holders  (`data-holder`)

Tests of records and DTOs (properties hold what you set), getters and setters, constructors assigning fields, enum
values, `ToString` of plain objects, equality of compiler-generated records.

Counter-cues: custom equality or hashing, validation in constructors, computed properties with logic,
serialization round-trips that protect a wire or storage format (see 16).

## 12. Legacy or compat paths with no users  (`legacy-path`)

Tests for backwards-compatibility shims, deprecated endpoints, migration fallbacks or old formats, in a project that
has no users of the old path (a prototype, an unreleased product, a shim whose last caller is gone). Check the repo's
docs and the call sites; "no users" must be a finding, not an assumption.

Counter-cues: anything the repo says it supports, any stored data that could still be in the old format, any public
API with external callers.

## 13. Over-parameterised  (`collapse`)

Dozens of cases that exercise the same branch with different data (`[InlineData]`, `it.each`, `@pytest.mark.parametrize`).
Collapse to the boundaries: the edges of each branch, the invalid cases that take a different path, and one ordinary
case. Say which cases stay.

## 14. Skipped, disabled or empty  (`dead-test`)

`[Fact(Skip=...)]`, `it.skip`, `xit`, `@pytest.mark.skip` with no linked issue or date, commented-out tests, test
bodies with no assertions. A skipped test guards nothing. Counter-cue: a skip tied to a tracked, open issue with a
plan; keep it and mention it.

## 15. Defective but valuable  (`flag`; never delete for this reason alone)

Real-time waits (`Thread.Sleep`, `Task.Delay`, `setTimeout` waits, polling for a timer), flaky tests, very slow setup
per test, tests that depend on order or on the machine. They guard something real but cost too much. Report them with
the fix that would help (fake time, shared fixture, firing the event directly); fixing them is separate work.

## 15b. Aggressive cues that apply across categories

- **Golden or oracle replays cover their rows.** When one test replays recorded reference behaviour (another
  implementation's outputs, captured fixtures) through the real code, a separate test that checks a subset of those
  same rows is a duplicate.
- **Tests of the test suite.** Tests that feed tampered or edited copies of fixtures to a validator written in the
  test project only prove the test's own checker works (`tests-a-fake`). The check against the real fixture stays.
- **Several tests, one behaviour.** Keep the one that asserts the most of the outcome; the rest are duplicates even if
  their names differ.
- **Exact error text.** Unless a client or script parses it, assert the error kind or code, not the sentence; a test
  whose only distinct assertion is the sentence is a change-detector.
- **Records don't make a test valuable.** Being named in a coverage or parity map, an audit ledger or a pin file is
  not a reason to keep (see SKILL.md); the deletion just carries a record update.

## 16. Usually keep (prove before deleting)

These are the categories where a wrong deletion hurts most. They aren't immune: a duplicate is still a duplicate. But
delete one only with a named, read survivor or a probe that a remaining test catches.

- **Behaviour someone relies on**, through the public surface: results, state changes, outputs.
- **Error and edge paths**: invalid input, empty, maximum sizes, boundaries, timeouts, partial failure.
- **Security boundaries**: authorization per role and scope, validation, escaping, secrets not leaking.
- **Contracts and formats**: wire formats, public API shapes, stored-data compatibility, migrations, hashes or
  encodings other systems depend on.
- **Concurrency and ordering**: races, retries, idempotency, compare-and-swap.
- **Regression tests for real bugs**: named after an issue, linked to an incident, or with a comment explaining the
  bug. Delete only as a true duplicate with a named survivor.
- **Property-based and fuzz tests.**
- **The only test of a module.** Probe it: if breaking the module's behaviour is caught only by this test and the
  behaviour matters, keep it; if the behaviour is trivial, delete the test and list the module as barely-used code.
