# Seats and scorecards

Each subject type has five seats, numbered below. `--quick` seats numbers 1–3, the standard panel
1–4, and `--full` all five. Two seats are always the same model:

- **The skeptic is GPT-6.1 Sol (Codex).** Its job is the pre-mortem.
- **The outsider is Grok 4.7.** It reviews the whole subject against the bar with no narrow
  mandate, so it catches what the specialists' mandates steer them away from.

The rest are Claude Opus 5.5 at high effort, using the committee-member agent (the `-web` variant
for ideas, or when the user passes `--web`). The Claude and Grok members can only read and search; the Codex member can also run
read-only commands in its sandbox (`git log`, `git show`), but nothing that writes, which rules out
most test runs. No member can drive a browser. So the chair saves the diff, copies of new files,
test output, screenshots and accessibility snapshots into the material folder, and members read
those plus the repo.

## The two fixed seats (every subject type)

**Skeptic** (Codex, seated at every size). *It is six months from now and this failed or caused
an incident. Write down the most likely reasons.* Then check whether each one is actually likely
given the material, and keep the ones that are. You must look for at least one serious problem,
but you may conclude there is none if you can say what you checked. Be specific about the failure:
who is affected, how, and how often.

**Outsider** (Grok, seated at every size). You have no specialist mandate. Read everything and
judge it as a whole against the bar and the owner's goal. Ask whether this is the right thing to
build at all, whether it is simpler than it needs to be or more complicated, and what an
experienced person new to this codebase or product would trip over. Don't repeat what a specialist
would obviously catch; look for what falls between specialisms.

## code

Scorecard: **Correctness** (does what it claims, edge cases, failure paths) · **Safety** (security,
data integrity, secrets, permissions) · **Maintainability** (could someone else change this in a
year) · **Fit** (solves the stated goal, no more and no less, in the repo's own style).

1. **Correctness** (Claude, quick+). Trace the main paths and the failure paths through the actual
   code, and read the test output the chair saved (`tests.txt`), if any. If a suspicion needs a
   test or command you can't run, say which one in `open_questions`. Look for race conditions,
   null and empty cases, off-by-one, error handling that swallows failures, and behaviour changes
   the description doesn't mention.
2. Skeptic (Codex).
3. Outsider (Grok).
4. **Security and data** (Claude, standard+). Untrusted input, authorisation (can user A reach
   user B's data), secrets in code or logs, injection, unsafe defaults, irreversible data changes
   without a way back.
5. **Maintainer a year from now** (Claude, full). Read it cold. Naming, hidden coupling, tests
   that guard real behaviour versus tests that only mirror the code, what you'd need explained.

## idea

Scorecard: **Value** (who it helps, how much, how we'd know) · **Feasibility and cost** (effort,
running cost, support burden) · **Risk** (what could go wrong, how bad, how reversible) ·
**Alternatives** (was something simpler or already existing considered).

1. **The customer** (Claude, quick+). Be the specific person this is for. Walk through the moment
   they'd use it. Is the problem real and frequent? What would they do today without it? What
   would make them not bother?
2. Skeptic (Codex).
3. Outsider (Grok).
4. **The operator** (Claude, standard+). Who runs this after launch? Running cost, support load,
   on-call, data the owner now has to protect, migrations, what it takes to switch it off again.
5. **The strategist** (Claude, full). Search the web for prior art and competitors, and what
   happened to them. Search for the topic, never paste the owner's idea into a search. Is there a smaller version that tests the riskiest assumption first? Cite
   sources.

## ui

Scorecard: **Task clarity** (can a first-time user do the main job without help) ·
**Accessibility** (contrast, keyboard, screen reader, touch targets, motion) · **Visual quality**
(hierarchy, spacing, typography, polish) · **Consistency** (with the rest of the product and its
design system).

Every member gets the same material: screenshots of the main job step by step at 1440 px and
390 px wide, the accessibility tree for each step (Playwright's page snapshot, saved as text), and
the page's source in the repo. Claude and Grok open the screenshots with their read tools (Grok's
was tested on 2026-11-06); Codex receives them attached as images.

1. **First-time user** (Claude, quick+). Walk through the screenshots of the main job in order,
   saying what you expect at each step and where you'd hesitate. Error, empty and loading states
   count; if one you'd expect is missing from the material, say so.
2. Skeptic (Codex).
3. Outsider (Grok).
4. **Accessibility** (Claude, standard+). WCAG 2.2 AA, from the accessibility snapshots, the
   screenshots and the source: contrast (from the colours in the CSS), labels and names, focus
   order, target sizes, reduced motion. Cite the element. Anything that needs a keyboard or screen
   reader run goes in `open_questions`.
5. **Visual designer** (Claude, full). Hierarchy, rhythm, alignment, type scale, colour, and
   whether it looks deliberate or templated. Name the specific element and the specific change.
