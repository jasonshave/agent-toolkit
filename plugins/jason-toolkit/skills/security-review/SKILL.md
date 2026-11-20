---
name: security-review
description: "Run an exhaustive, read-only security review of a whole codebase or platform — tenant isolation, authentication, authorization/RBAC, remote access (API tokens and MCP), secrets and cryptography, untrusted input and SSRF, AI/prompt-injection surface, supply chain and CI/CD, infrastructure-as-code, abuse and cost, privacy and data lifecycle — then file each verified finding as its own GitHub issue with a recommendation and the named tests that must go red first. Fans the domains out to parallel sub-agents so the main context stays thin. Use when the user asks for a security scan, audit, review, pen-test-style sweep, threat model, or \"find the holes\"; also when they name one domain (\"check our RBAC\", \"is our multi-tenancy sound\"). Not for reviewing a single pull request's diff — the built-in branch-diff review is better for that."
---

Read [host execution guidance](references/host-runtime.md) before running this workflow.

# Security review

You are the **reviewer of record**. Sub-agents do the reading; you frame the domains, verify what comes back, and own what gets filed. A finding you file is a claim you are making — so nothing gets filed that you have not confirmed in the source yourself.

## Rules of engagement — read before anything else

1. **Read-only.** This skill changes no code, opens no branches, and runs no exploit against a live system. Reading files, `git log`, `gh issue list`, a local `npm audit` and an offline `az ... show` are fine. Sending a crafted request to a deployed environment is not, unless the user explicitly asks for it in this session and it is their own system.
2. **Never print a secret value.** If you find a credential, report the file, the line and what kind it appears to be. Never the value — not in a tool call, not in an issue body, not in the summary. If it is a real live credential, say so first and plainly; that is an interrupt, not a bullet point.
3. **No production changes, ever, not even the obvious fix.** Surface it, say what it affects, let the user decide.
4. **Verify before you believe it.** A sub-agent reporting a hole is a claim. Open the file, read the path end to end, and only then file. Agents confidently invent line numbers and occasionally invent whole functions.
5. **Do not inflate.** A finding you cannot write a concrete attack for is a hardening item or a latent defect, and must say so in its own severity. A scan that cries critical at everything gets ignored, which is worse than not running it.
6. **Say what you could not check.** Platform behaviour you inferred, a path you could not reach, a dependency you could not resolve. The limits belong in the summary.

## 1. Frame the scope and take stock

Establish, quickly and from the repo itself, before delegating:

- **What the system is** — read `CLAUDE.md`/`AGENTS.md`/`README.md` and any `docs/`. What is multi-tenant, what is the trust boundary, what is deliberately held or decided already. A design decision already made is not a finding.
- **The surface** — enumerate the entry points yourself, cheaply, so your briefs are concrete. HTTP routes, background workers, MCP tools, CLI entry points, webhooks, scheduled jobs. A one-line grep for route registrations beats a paragraph of speculation in a brief.
- **What already exists** — `gh issue list --state open` and a search of closed issues for the areas you are about to review. Filing a duplicate of an open decision wastes the user's attention and makes the scan look careless.
- **Labels** — check `gh label list`. Create a `security` label if there is none.

Ask the user **at most one** question here, with a recommendation attached, and only if getting it wrong wastes real work. Scope is usually obvious from the request; assume "everything" and say so.

## 2. Fan the domains out

Read `references/domains.md`. It holds the full checklist for each domain — what to look for, the questions that actually find things, and the failure modes that are easy to miss. Build each sub-agent's brief from the relevant section.

Group the domains into **five to seven units**. More than that and you spend your own context reading reports; fewer and each agent runs shallow. The default split, which maps onto how defects actually cluster:

| Unit | Domains from `references/domains.md` |
|---|---|
| 1 | Tenant isolation & data boundary |
| 2 | Authentication, session & account lifecycle |
| 3 | Authorization / RBAC |
| 4 | Remote & machine access — API tokens, MCP, webhooks |
| 5 | Secrets, cryptography & key management |
| 6 | Untrusted input, SSRF, DoS & the client |
| 7 | Supply chain, CI/CD, infrastructure-as-code, privacy & abuse |

Adjust to the system. A single-tenant CLI does not need unit 1; a system with no AI surface does not need that section. If the user named one domain, run that unit alone and say what you did not look at.

**Schedule the units within the host/repository concurrency limit**, default three workers plus coordinator. Use native workers when available; otherwise execute the same read-only briefs sequentially and disclose that mode. Read-only work does not need a worktree unless repository rules require one. Do not drop domains because the host has fewer workers.

Every brief contains:

- **Scope** — the domain, named, with the checklist section pasted in. Do not make the agent guess what to look for.
- **Orientation** — the key file paths you already found, and what the project's own docs claim is true. An agent that has to rediscover the architecture spends its budget there.
- **Method** — read the real code; trace each candidate end to end; for each one ask *"what request would an attacker actually send?"* and **if you cannot write that request, it is not a finding.**
- **The rules of engagement** above, restated: read-only, no code changes, no branches, no issues (you file them centrally — that is what keeps the dedup and the house style consistent), never print a secret value.
- **The report format** below.
- **An explicit ask for the negative space**: what they checked and found *sound*. This is half the value of the exercise — it is what tells the user which guarantees actually hold, and it stops a reader assuming an unmentioned area was covered.

Ask each agent to report, per finding:

```
**Title** — one line, plain language, what is wrong for a person
Severity: critical / high / medium / low
Files: repo-relative path:line anchors
Attack: the concrete request or sequence, with real values
Preconditions: what the attacker needs (role, network position, a click)
Recommendation: the specific fix, naming the file and the approach
Acceptance: the named test(s) that should go red first
```

...then a list of what they checked and found sound, and a list of what they could not verify.

## 3. Verify, then rank

For each reported finding, open the file and confirm the mechanism. Cheap and non-negotiable. Demote or drop anything that does not survive.

Severity, used consistently:

- **Critical** — an unauthenticated or cross-tenant path to other people's data, credentials, or code execution. Act today.
- **High** — a realistic attack by someone who already has a low-privilege account or a network position; or an irreversible data loss a normal user can trigger by accident.
- **Medium** — needs an unlikely precondition, or leaks something that is not directly exploitable, or is a guarantee the code claims and does not keep.
- **Low** — hardening, latent fail-open, a comment that lies about a control, a test gap on a refusal, cost and nuisance.

Two things that are *not* findings, and saying so is part of the job: a deliberate product decision the docs already record, and a control that is missing but that nothing currently needs.

**Cluster before filing.** Findings that one pull request would fix belong in one issue. Findings with the same root cause but different fixes stay separate and cross-reference each other. Getting this wrong produces either an unreadable mega-issue or twenty issues that fight over one file.

## 4. File the issues

One issue per unit of work. Match the repo's own issue conventions — read `CLAUDE.md` for them; if the project has none, use this shape:

- **Title**: what is wrong *for a person*, not the mechanism. "Joining a workspace locks you out of the one you are already in" beats "AccountDirectory.BindAsync is last-write-wins".
- **Body**: a few sentences of what and why, with `file.cs:line` anchors rather than pasted code. Link to related issues by number instead of restating them.
- **Recommendation**: required on every issue. The specific fix and, where there is a choice, which one you would take and why. An issue without a recommendation hands the reader your homework.
- **Acceptance**: the named tests that must go red before the fix and green after. This is the most useful line in the issue and the one most often skipped.
- **Labels**: `security` plus the area. Tag anything needing a human decision, a credential, or a production change so it is visibly blocked rather than silently stalled.

Write each body to a file and use `gh issue create --body-file`; heredocs through a shell mangle backticks and quotes. Batch the creates in one script rather than one call per issue.

If an existing issue already covers a finding, **comment on it** with the new evidence instead of filing a duplicate, and say so in the summary.

## 5. Report

Lead with what it means, not what you did. The shape that works:

1. **The headline** — in one or two sentences, is anyone's data reachable by someone who should not have it? That is the question behind the request, and it deserves a direct answer before anything else.
2. **What holds.** Name the guarantees you verified. This is not padding; it is the half of the result that tells the user where *not* to spend effort.
3. **Do these first** — two to four items, each explained in plain language: what breaks, who can do it, what it costs if ignored. Mechanism last, one sentence.
4. **Then, in order** — the rest as a compact list of issue numbers with a clause each.
5. **What needs you** — anything blocked on a decision, a credential, or a production change, said plainly with how urgent it is. "Nothing is broken, this is a next-week thing" is a complete and useful sentence.
6. **Limits** — what was not covered and what you inferred rather than verified.

Do not hand over a table of unfamiliar terms. Do not use shorthand invented during the run as though it is shared vocabulary. Expand a load-bearing term the first time it appears.

## Anti-patterns

- **Filing what you did not verify.** The fastest way to make a security scan worthless.
- **Reading whole files into your own context** to check on an agent. Grep the one line, or ask the agent.
- **A wall of criticals.** Rank honestly or the ranking carries no information.
- **Skipping the sound list.** Silence reads as "not checked", and the user cannot tell the difference.
- **One giant issue.** Nobody can act on it and nobody can close it.
- **Reviewing only the code you can see.** The infrastructure files, the CI workflows and the dependency manifests are in scope and are where a surprising share of real findings live.
- **Treating the absence of an attack you could think of as proof of safety.** Say what you covered; do not certify what you did not.
