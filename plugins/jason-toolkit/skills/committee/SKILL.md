---
name: committee
description: "Convene a review committee of three to five members drawn from three AI model families (Claude Opus 5.5, OpenAI GPT-6.1 Sol through the Codex CLI, xAI Grok 4.7 through the Grok CLI). They review a feature idea, a code change, a UI design or a plan on their own, cross-examine each other with evidence, and vote blind against a bar set up front. The chair checks every blocking claim and gives a plain-English verdict with the dissent kept on record. Members are locked to read-only. Use when the user invokes /committee or asks for outside advice, a second opinion, a panel, a council, a design review board, or a \"would this pass a high bar?\" check. Re-run it with \"resubmit\" after fixes."
---

Read [host execution guidance](references/host-runtime.md) before running this workflow.

# /committee: outside advice that has to earn agreement

## Usage

```
/committee <what to review> [bar] [panel size] [--web]
/committee resubmit
```

| Argument | Values | Default |
|---|---|---|
| what to review | Plain words: `the uncommitted changes`, `this branch`, `commit abc123`, `src/billing/`, `my idea for team billing (below)`, `the settings page at http://localhost:5173/settings` | (required) |
| bar | `explore` (worth pursuing?) · `ship` (good enough to release?) · `irreversible` (hard to undo, so it has to be right) | `explore` for ideas, `ship` for code and UI |
| panel size | `--quick` (3 members, 1 debate round) · *(none)* (4 members, up to 2) · `--full` (5 members, up to 3) | 4 members |
| `--web` | Let every member search the web | on for ideas, off for code and UI |
| `resubmit` | Re-review the last ruling on this subject: checks the fixes only, no new goalposts | n/a |

Examples: `/committee the uncommitted changes`, `/committee this branch irreversible`,
`/committee my idea for team billing (below) --full`, `/committee resubmit`. On a plugin install
the command is `/jason-toolkit:committee`.

If it's run with no argument, print this usage table and ask what to review.

## Your role, and why the rules exist

**You are the chair.** You prepare the material, run the rounds, keep members apart, and check
their evidence. You do not vote, and you do not add blockers of your own unless you have
verified them.

What the rules prevent: AI reviewers who read each other's arguments drift to the majority, often
dropping a correct objection to agree with a wrong one, and the debate then ends *less* accurate
than one careful reviewer (Wynn et al. 2025, arXiv 2509.05396; Yao et al. 2025, arXiv 2509.23055).
So agreement has to cost evidence:
- members review alone first;
- they are anonymous to each other;
- they must restate an objection in its strongest form before rejecting it;
- they must quote what changed their mind;
- their claims are checked against the source.

Three model families are used because different models were the main reason debate helped in
ReConcile (Chen et al., ACL 2024).

**`<skill>`** below means this skill's own folder: the "Base directory for this skill" shown when
it loaded. Use that absolute path everywhere. It is different on a plugin install, so never assume
`~/.claude/skills`.

Files in `<skill>`:
- [seats.md](seats.md): the personas and scorecards.
- [prompts.md](prompts.md): every prompt template.
- [member-response.schema.json](member-response.schema.json): the answer shape every member uses.
- `prepare-code-material.sh`: saves a code change (diff, list, copies of the files) as material.
- `build-changes.sh`: for a resubmission, shows what changed since the recorded review.
- `run-member.sh`: runs a Codex or Grok member for one round.
- `grok-trust-check.js`: tells `run-member.sh` whether the reviewed folder is trusted in Grok.
  `test-trust-check.js` is its regression test, and `test-verified-record.sh` tests the per-tool
  verified record that `preflight.sh` reads. Neither needs a sign-in; `self-test.sh` runs both.
- `repo-state.sh`: the "did anything change?" fingerprint.
- `extract-answer.js`: pulls a member's JSON answer out of its reply and checks its shape.
- `preflight.sh`: checks the tools are installed and signed in.
- `check-secrets.sh`: looks for likely secrets in the material before it leaves the machine.
- `self-test.sh`: proves Codex and Grok can't write, and runs both regression tests.
  `scripts-hash.sh` fingerprints the lock-down scripts (including `preflight.sh` and `self-test.sh`),
  so editing them also needs a fresh test.

## 0. Preflight

Run `bash <skill>/preflight.sh`. It reports whether node, codex and grok are ready, and whether
each outside tool is verified: a PASS from `self-test.sh` is on record for exactly this tool,
this installed version and the current lock-down scripts.

- **A tool shows `verified: yes`:** seat it. No test is needed.
- **A tool shows `verified: no`** (first use, the tool updated, or the lock-down scripts changed
  since its last PASS): run `bash <skill>/self-test.sh <tool>`. It takes a few minutes and a few
  cents, so tell the user in one line. Seat the tool only if this run says `PASS`.
  - `FAIL` (it changed the throwaway repo): don't seat it, and tell the user plainly. That tool
    version can write despite the lock-down.
  - `INCONCLUSIVE` (it errored, timed out, or showed no refused attempts): run the self-test once
    more. If it's still not `PASS`, don't seat it.
  - `TRUST CHECK BROKEN` (`test-trust-check.js` or `test-verified-record.sh` failed): don't seat
    Grok, and tell the user; nothing is marked verified until both pass. If the trust-check line
    says the folder-link cases were SKIPPED (folder links can't be made on this machine), that
    isn't a failure: link handling just wasn't exercised here.
  - Either way, a Claude member takes that seat, and the verdict says why.
  - A tool that was already `verified: yes` stays verified if you re-run the test and it comes
    back INCONCLUSIVE: the earlier PASS for the same tool, version and scripts still holds. Only a
    FAIL or TRUST CHECK BROKEN removes it.
- **A tool is missing or signed out:** a Claude member takes its seat, and the verdict says so.
- **node is missing or too old** (it needs 18 or newer): stop and tell the user. The answers can't
  be read without it.
- **Choose a real restricted Claude execution path for the current chair host.**
  - On Codex, Copilot, Grok, or another non-Claude host, run
    `node <skill>/self-test-claude.mjs --check`. If unverified, run the same command without
    `--check` and require PASS for fresh and resumed sessions. Launch Claude seats with
    `node <chair>/bin/run-claude-member.mjs <prompt-file> <out.json> <repo> <session-id|-> <material>`.
    This uses the authenticated Claude CLI with restricted/safe modes, a real read-only tool
    allowlist and no external MCP servers. Save and reuse the `.session` file for later rounds.
    No named Claude agent type or Claude `SendMessage` tool is required by the chair.
  - On a Claude host, the same CLI path is available, or use the native restricted agents below.
    If native agents are missing/stale, use the verified CLI path rather than an unrestricted agent.
  - If neither restricted path is available, report the missing provider/access; never silently
    replace an independent Claude seat with a privileged same-host worker.
- **For native Claude agents, check what the member can actually do.** It's `committee-member` for code and UI,
  `committee-member-web` for ideas or `--web` (on a plugin install, `jason-toolkit:committee-member`
  and `jason-toolkit:committee-member-web`). Spawn it once with: "Tool check only, not a review,
  and don't try to use any tool. Reply in plain text with the exact names of every tool you have
  available, comma-separated, and nothing else." It takes about ten seconds.
  - `committee-member` must name only `Read, Grep, Glob`. `committee-member-web` must name only
    `Read, Grep, Glob, WebSearch, WebFetch`. `SubagentHandback` is Claude Code's own reply tool and
    is fine.
  - **If the agent type doesn't exist, or the member names any other tool** (Bash, Write, a
    browser): stop. This session has an old definition loaded, or none. Claude Code keeps an agent
    definition it has already loaded, and can pick up a new or changed one minutes later, sometimes
    with no notice (seen 2026-11-06). The list of agent types in your context can be out of date,
    which is why you ask the agent itself. Tell the user: "The committee's Claude member agent in
    this session isn't the read-only version yet. It usually updates within a few minutes, or
    after a restart."
  - **Never seat a general-purpose or other agent instead**: those have every tool in the session,
    including connected services.

## 1. Intake: one question at most

Work out, from the argument, the conversation and the repo:

- **Subject type**: `code`, `idea` (a feature, product, plan or architecture), or `ui`. This picks
  the seats and scorecard in seats.md.
- **The material**, and the repo it lives in (if any).
- **The owner's goal and what's off the table**, in one or two sentences each.
- **The bar**:
  - `explore` (the default for ideas);
  - `ship` (the default for code and UI);
  - `irreversible`: data migrations, public APIs, pricing, security boundaries, production
    infrastructure. It forces the full panel.
- **Panel size and web access** (see Usage).

Ask the user **one** question only when the bar or the subject is genuinely unclear, with your
recommendation attached. Otherwise state your reading in one line ("Reviewing the uncommitted
changes against the ship bar, 4 members, no web") and start.

## 2. Prepare the material

Make two folders that are **not** next to each other:

- **Material**: `$TEMP/committee/<yyyymmdd-hhmm>-<slug>/`. Members are told to read only this
  folder and the repo.
- **Chair**: `mkdir -p "$TEMP/committee-chair" && mktemp -d "$TEMP/committee-chair/<yyyymmdd-hhmm>-<slug>-XXXXXX"`. This holds
  `seats.json`, prompts, answers, session ids, logs and repo fingerprints. It is never named to
  members, so they can't see who is who or read each other's drafts.

Copy this skill's working parts in before anything runs, and use these copies for the rest of the
review:
- `mkdir -p <chair>/bin && cp <skill>/*.sh <skill>/*.js <skill>/*.mjs <skill>/member-response.schema.json <chair>/bin/`.
  Bash reads a script while it runs, so editing or updating the skill mid-review broke a running
  member (seen 2026-11-06). Run `run-member.sh`, `repo-state.sh`, `extract-answer.js` and
  `check-secrets.sh` from `<chair>/bin` from here on.
- `cp <skill>/member-response.schema.json <material>/`. Prompts name this copy as `{schema}`, so
  members find the answer shape inside the folder they're allowed to read.

Put into the material folder:

- **Code**: run `bash <chair>/bin/prepare-code-material.sh <repo> <material> [<subject>]`. It saves
  `diff.patch`, `changed.txt` (the files under review) and `files/` (a copy of each), leaving
  `.committee/` out. `<subject>` is one of:
  - nothing: the uncommitted changes, new files included;
  - `<default branch>...HEAD`: a branch (find the default branch with
    `git symbolic-ref refs/remotes/origin/HEAD`);
  - `commit:<sha>`: one commit (copies are taken from that commit);
  - `path:<folder>`: a folder as it is now, with no diff.

  If it exits 1 (over 200 files or 2 MB), ask the user to narrow the subject instead.
  - `tests.txt`: if the repo has a fast test command that covers the change (follow the repo's
    CLAUDE.md test rules), run it yourself and save the command and its last 200 lines of output.
    Members can't run anything. If there's no fast command, skip it and list "no tests were run"
    under what nobody could check.
- **UI**: `screenshots/<nn>-<step>-<width>.png` and `a11y/<nn>-<step>.txt`. Use Playwright to
  capture the main job step by step, at 1440 px and 390 px wide, plus empty and error states if you
  can reach them without changing real data. Save each step's page snapshot (the accessibility tree)
  as text. Members can't drive the page. If there's a code change too, run
  `prepare-code-material.sh` as for code.
- **Idea**: `idea.md`, the idea in the user's words plus any context they gave.
- `brief.md`, from the template in prompts.md, naming those files.

**Secret check.** Material for the Codex and Grok seats goes to OpenAI and xAI. Before round 1, run
`bash <chair>/bin/check-secrets.sh <material>`. If it exits 1, show the user what it printed (values
are masked) and ask whether to take those files out of the material or go ahead.

## 3. Seat the panel

Take the seats for the subject type and size from seats.md. Shuffle the letters A–E across seats
at random. Record the mapping in `<chair>/seats.json`: letter, persona, model, and for Claude
seats the native agent handle or CLI session id. Members only ever see letters.

Web access: on for ideas or `--web`. Use `committee-member-web` for the Claude seats and set
`COMMITTEE_WEB=1` for the chosen CLI runner. Otherwise use `committee-member` and leave it unset.

## 4. Round 1: everyone reviews alone, at the same time

Take a fingerprint first: `bash <chair>/bin/repo-state.sh <repo> > <chair>/state-r1`. If there's no
repo, initialize only the disposable material folder as a local Git fixture, commit its prepared
material with a local fixture identity, and use that as `<repo>` for fingerprints and runner cwd.
Never initialize or commit a real user's folder just to satisfy a runner. Then start members up to the host/repository concurrency limit, queueing the remainder without sharing any answers:

- **Claude seats using the CLI path**: write the Claude wrapper, seat prompt and brief into
  `<chair>/r1-<letter>.prompt.md`, then run
  `node <chair>/bin/run-claude-member.mjs <chair>/r1-<letter>.prompt.md <chair>/r1-<letter>.json <repo> - <material>`.
  Apply the same exit-state handling and record its `.session`; never give this seat the chair directory.
- **Claude seats using native agents**: the host's Agent tool with the restricted member type, and
  `name: "committee-<letter>-<hhmm>"` so it can be continued. The prompt is the Claude wrapper,
  the seat prompt and the brief, all from prompts.md. The member replies with its JSON answer.
  Save the reply text to `<chair>/r1-<letter>.raw` and run
  `node <chair>/bin/extract-answer.js <chair>/r1-<letter>.raw <chair>/r1-<letter>.json`. If that
  fails, SendMessage the member once with the error and ask for only the corrected JSON.
- **Codex and Grok seats**: write the seat prompt plus the brief to
  `<chair>/r1-<letter>.prompt.md`. Then run
  `bash <chair>/bin/run-member.sh <codex|grok> <chair>/r1-<letter>.prompt.md <chair>/r1-<letter>.json <repo> - [screenshots...]`
  using the current host's process/task handle and completion mechanism. Codex usually takes 1–3 minutes. Grok takes 4–10,
  because it reads more before answering.
  - **Exit 5** means files changed during the review: stop, show the user `git status`, and don't
    continue until they've looked. This takes priority over every other exit code.
  - **Exit 2, 3, 4 or anything else** (signed out, Grok refused on a trusted folder, timed out,
    failed, an answer still unusable after the script's one automatic request for a corrected
    one, script not found): a Claude member takes that seat for the rest of the run, with the same
    persona. Note it and carry on.

When all of round 1 is in, check the fingerprint again. If it differs from `state-r1`, stop as
for exit 5. This is the check that covers the Claude members too.

Don't read or summarise any answer to other members until all of round 1 is in.

## 5. Check the evidence

Before any debate, open every blocker's cited evidence yourself (the file and line, the passage,
the URL), and mark each one:
- **confirmed**;
- **wrong**: the evidence doesn't say that, or doesn't exist;
- **unverifiable**.

A `checked: true` claim can still be invented: on 2026-11-05 a member quoted line numbers for
commands that weren't in the file. Strike wrong blockers before members see them. The verdict
notes which seat cited evidence that didn't exist.

## 6. Cross-examination: up to 1 / 2 / 3 rounds by panel size

Answers travel: the dossier goes to every member (so to all three model providers), and the record
may be committed. So first run `bash <chair>/bin/check-secrets.sh` on each answer file in `<chair>`,
and mask anything it finds before quoting it.

Write `<material>/dossier-r<n>.md`:
- every surviving blocker, with its id, claim and evidence, and your check result;
- blockers several seats raised, grouped under one id with the others as aliases;
- each letter's verdict and scores;
- no personas, models or summaries.

Take a fingerprint (`state-r<n>`), then **continue every member where it left off**, all at once,
so it keeps what it has already read:

- **Claude seats using the CLI path**: call `run-claude-member.mjs` with the next prompt,
  output path, repo, the prior `.session` id and material directory, preserving its restrictions.
- **Native Claude seats**: use the host's message/continue operation with the round prompt from
  prompts.md. Save and extract its JSON reply as in round 1.
- **Codex and Grok seats**: run
  `bash <chair>/bin/run-member.sh <tool> <chair>/r<n>-<letter>.prompt.md <chair>/r<n>-<letter>.json <repo> <session id>`,
  with the session id from the previous round's `.session` file.
- **Exit 5 from any member**: stop, as in round 1.
- **If continuing fails** (the member is gone, the session expired, exit 3 or 4): start that member
  fresh once with the fresh-start prompt from prompts.md, which carries the seat prompt, the brief
  and its previous answer. If that fails too, a Claude member takes the seat with the same
  fresh-start prompt. Note it.

After the round, compare the fingerprint, as in round 1.

A member must:
- answer every other member's blocker: restate it in its strongest form first, then agree,
  dispute or say it is unsure, with evidence;
- hold or withdraw each of its own blockers;
- record every change of verdict, score or blocker in `position_changes`, quoting what convinced it.

**Caving check.** After each round, look at every position change. A change counts as caving if
its `convinced_by` cites no specific new evidence: no file and line, no quoted passage, no test
result, no argument that wasn't already in the brief. If more than half the changes in a round
are caving, start the next round's prompt with: "Last round, several members changed position
without new evidence. Hold your view unless something in the dossier actually disproves it." List
caving in the verdict.

**Stop early** when no blocker is disputed and no new blocker appeared. Each member's last answer
is its final vote. Members answer in parallel without seeing each other's finals, so the vote is
blind.

## 7. The ruling

A blocker **survives** if its author still holds it and either your check confirmed it or another
member agreed with evidence. A disputed blocker survives if your own check of both sides' evidence
favours it.

Unverifiable blockers become **open questions**, not blockers. At the `irreversible` bar, though,
they block until someone checks them.

| Verdict | `explore` | `ship` | `irreversible` |
|---|---|---|---|
| **Approved** | no majority of `fail` | no surviving blockers and no `fail` | every member `pass`, no blockers or open questions |
| **Approved if you fix these** | n/a: blockers are listed as risks | every surviving blocker has a concrete fix and no `fail` | never: fix, then resubmit |
| **Not yet** | n/a | anything else | anything else |
| **Rejected** | majority `fail` on the approach | majority `fail` on the approach | majority `fail` on the approach |

**A genuine split**, where members disagree on one surviving blocker after the final round and the
evidence doesn't settle it, goes to the user. Ask with AskUserQuestion: one question, each side's
strongest case in one sentence, and your recommendation. Don't make up a compromise.

## 8. Report, then save the record

Reply in this order, in plain language, following the user's CLAUDE.md:

1. **The verdict and the bar**: e.g. "Not yet, against the ship bar."
2. **What has to change**: the surviving blockers as a short numbered list, each with what goes
   wrong if it's ignored and the fix. If approved, the two or three strongest reasons why.
3. **Minority report**: any member whose final vote differs from the verdict, with their best
   argument in a sentence or two. Leave it out if the vote was unanimous.
4. **What nobody could check**: the open questions, and anything the review couldn't see, e.g.
   "no tests were run" or "production data wasn't available".
5. **One line on the panel**: who sat, the rounds, the time, any stand-ins, any struck evidence,
   any caving.

Then save the record in the repo under review, if there is one, at
`.committee/<yyyy-mm-dd>-<slug>/`. Use `-resubmit-<n>` on the folder name for a resubmission.

- **`record.md`** contains:
  - the brief;
  - the seat mapping with models;
  - each round's answers, condensed;
  - your evidence checks;
  - the ruling;
  - the commit it was reviewed at (`git rev-parse HEAD`), and for a resubmission, the record it
    follows.
- **`material/`** is a copy of the material folder. A resubmission needs this to show what
  changed in files that were new and untracked. If the copy would be over 5 MB, keep `brief.md`,
  `diff.patch`, `changed.txt`, `idea.md`, `a11y/` and the 390 px screenshots, drop the rest, and say
  so in the record. If the user chose to go ahead despite a secret-check match, leave the matching
  files out of the copy and say so, since the record may be committed. Mask anything
  `check-secrets.sh` finds in the answers before they go into `record.md`.

The first time, mention that `.committee/` can be committed (as a decision log) or gitignored.
Then delete the material and chair folders in `$TEMP`.

## Resubmitting

`/committee resubmit`, or a re-run on the same subject: find the latest `.committee/` record for
it, and ask if more than one subject could match.

**The panel.** Seat the same personas and models, with the letters reshuffled. Start fresh
members: they get what changed, not the old debate.

**The material** is a new folder, set up as in step 2: the same two-folder split, the scripts copied
into `<chair>/bin`, and the answer schema copied into the material folder. It holds:
- **`brief.md`**: the record's brief, with the same goal, off-the-table list, bar and scorecard,
  but its material-folder line pointing at the *new* folder, and its file list naming what's
  below.
- **`previous-blockers.md`**: the surviving blockers from the record, with their ids and fixes.
- **The current version, made fresh as in step 2 for the subject type**: the output of
  `prepare-code-material.sh` for code; new `screenshots/` and `a11y/` for UI (plus the code
  material, if there's a code change); the revised `idea.md` for an idea. The record saved at the
  end keeps these, so the next resubmission can compare against this one.
- **What changed since that review**:
  - Code: `bash <chair>/bin/build-changes.sh <record> <material> <repo> <recorded commit>` writes
    `changes.patch`: each file against the copy kept with the record, files new to the change
    against the recorded commit or in full, deletions, and commits made since.
  - Idea: `git diff --no-index -- <record>/material/idea.md <material>/idea.md > <material>/changes.patch`
    (exit code 1 just means they differ).
  - UI: copy the record's `material/screenshots/` and `material/a11y/` into the new material as
    `previous-screenshots/` and `previous-a11y/`, and name both in the brief. Members can't read
    `.committee/` themselves. Write `changes.patch` as a short list of which screens changed and
    how. Pass Codex the previous screenshots first and the new ones after, and say so in its
    prompt.

Then run step 0, the secret check from step 2, and steps 3 to 8, with the resubmission prompt
from prompts.md as the seat prompt.

Each prior blocker is ruled:
- **fixed**;
- **not fixed**;
- **fixed, but the fix caused a new problem**.

**No moving the goalposts.** A brand-new blocker is allowed only if the change caused it, or it is
serious (security, data loss, a broken core flow). Anything else is listed as "for later" and
doesn't affect the verdict. In the ruling, a previous blocker survives if it is ruled not fixed or
fixed-with-a-new-problem and your check agrees; everything else in step 7 applies as usual.

## Keeping members read-only

Members must not be able to change anything, here or in any connected service. Each tool needed
different handling (all tested on Windows, 2026-11-06):

- **Native Claude seats** use the `committee-member` agent: Read, Grep and Glob only. They get no shell,
  no file writing, no browser and no connected services (Azure, fal.ai, GitHub and so on). The
  `-web` variant adds web search and page fetching, for ideas. Members return their answer in
  their reply; the chair saves it. The restriction lives in the agent file, so preflight asks the
  agent itself which tools it has: a session can still be holding an older definition.
- **CLI Claude seats** use `run-claude-member.mjs`: restricted/safe modes disable customizations,
  the built-in tool list contains only Read/Grep/Glob (plus explicitly requested web tools),
  permissions default to denial and external MCP configuration is empty. The actual tool allowlist
  is the boundary, not a prompt claiming read-only access. The fresh/resumed test verifies fixture
  integrity and records when no mutation tool was exposed. It does not claim an OS sandbox denied
  commands that could not be attempted.
- **Codex** (`run-member.sh`):
  - The user's own Codex settings are ignored (`--ignore-user-config`): they allow everything and
    connect Azure, fal.ai, a Node runner and computer control.
  - So are the user's saved "always allow" command rules (`--ignore-rules`): they include
    `git commit`.
  - Account-linked tools (GitHub actions that can merge and commit, site deploys), plugins,
    helper agents, browser and computer control are switched off. Web search is switched off too,
    unless web access is on.
  - Its read-only sandbox refuses writes, including `git commit`.
  - Codex's Windows sandbox needs `windows.sandbox=elevated` to run even read-only commands.
- **Grok**: its "plan" mode and its sandbox did **not** stop it writing a file. Plan mode is only a
  compatibility label, and the sandbox only works on Linux and macOS. So Grok gets only
  `read_file`, `grep` and `list_dir` (plus `web_search` when web access is on), every connected
  tool is denied, and it can't run commands.
- **What members can read, and where it goes.** Members need the repo for context, so reading
  isn't blocked outright.
  - Grok is fenced by its own permission rules from the chair's folder, `.committee/` records,
    `.env` and key files, `local.settings.json`, Claude's credentials and settings, common token
    files (`.npmrc`, `.git-credentials`, `.netrc`) and the `.ssh`, `.azure`, `.aws`, `.codex`,
    `.grok`, `.docker`, `.kube` and GitHub CLI folders. Grok checks a path as written, before
    expanding `~` or tidying `..`, so most fences match the name anywhere in a path. Tested
    2026-11-06 with `~`, `~/..`, `~/./`, backslashes, upper and lower case, and `../`. The fences
    cover listing folders as well as reading files. Treat them as a strong guard rather than a
    proof: a spelling nobody tried could still slip through.
  - Grok normally also loads Claude's and Cursor's hooks, connected servers, skills and rules, from
    the home folder and the repo. `run-member.sh` switches those off.
  - A repo's own Grok hooks, connected servers and instruction files (including a top-level
    `CLAUDE.md`) load only in a folder you've trusted in Grok. So `run-member.sh` refuses the Grok
    seat in a trusted folder (exit 2) and a Claude member takes it; it asks Grok to keep its
    folder-trust check on (`GROK_FOLDER_TRUST=1`; untested against a config that turned it off,
    so don't turn folder trust off in Grok); and it accepts Grok's trust file only in the exact
    layout Grok writes: if the file contains anything else, it refuses the Grok seat rather than
    guess (so a Grok update that changes the layout means a Claude stand-in until the check is
    updated; `test-trust-check.js` shows the cases). A member in an untrusted folder
    can still read the repo's `CLAUDE.md` as material, but isn't steered by it.
  - If you've trusted a folder in Grok on a different drive or network share from the one being
    reviewed (each network share, and each server name, counts as its own drive), or the reviewed
    folder is itself on a network share and another folder on that share is trusted, the check
    can't follow it through links without network lookups, so it refuses the Grok seat for that
    review too, and the verdict says a Claude member stood in.
  - Codex and Claude members are told the same paths are out of bounds, but nothing enforces it
    for them.
  - Everything a member reads is sent to its model provider (Anthropic, OpenAI or xAI) as part of
    the review. The secret check covers the material and members' answers (before they go into
    the dossier or the record), but not other repo files a member opens for context. So review a
    repo with secrets committed in it only after they're removed.
- **Web access** is off for code and UI reviews: members read private code, and a web request is
  a way it could leak. For ideas it's on, and members are told never to put the material into a
  search or URL. That instruction is the only guard there, so don't use `--web` on material you
  consider confidential.
- **The fingerprint** (`repo-state.sh`) is taken around every outside member's run and around
  every round. It covers file contents, not just file names. It misses gitignored files and
  anything outside the repo. It also fires if *you* edit the repo during a review.
- **`self-test.sh`** asks each outside member to write, edit, commit and delete in a throwaway
  repo, in a first session and a resumed one, and records only the versions that passed.
  Preflight shows `verified: no` for any other version, and step 0 has you run the test.

## Cost and speed

Measured on 2026-11-06 with a standard panel. Reviewing a small change (6 new files): round 1 took
about 9 minutes, waiting on Grok, and the cross-examination round about 5, because members
continued their sessions instead of re-reading. A resubmission of a 12-file change took about 25
minutes in all. One Grok member reading one small file cost about
9¢ of xAI usage. Codex draws on the user's ChatGPT plan limits, and Claude seats on the Claude
plan. If a run is heading well past 25 minutes, tell the user rather than letting it sit.
