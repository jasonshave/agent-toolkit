# Domain checklists

Paste the relevant section into each sub-agent's brief. These are prompts for thinking, not a form to tick — the value is in tracing the specific question through the specific code, and a checklist item answered "N/A, this system has no X" is a fine answer.

Ordering within a section is roughly by how often it finds something real.

---

## 1. Tenant isolation & the data boundary

Only relevant if the system serves more than one customer from one deployment. When it is relevant it outranks everything else, because a hole here is every customer at once.

- **Where does the tenant identity come from?** Trace it from the credential to the storage call. Can any part of a request influence it — a header (`X-Tenant`, `X-Org`), a query parameter, a body field, a path segment, a JWT claim the client can mint, an impersonation route, a "support view"?
- **Is there a fallback tenant** when resolution fails — a default, a "local", a null that becomes a shared partition? A default tenant is a cross-tenant hole with a friendly name.
- **Is there one choke point** through which all data access passes, or several? Count them. If the project claims one, verify the claim: grep for the raw client types, and check whether a *factory* for those clients is public and injectable (a guard that forbids `TableClient` but allows a class exposing `CreateTableClient()` forbids nothing).
- **Does the guard, if there is one, actually cover what it says?** Typical gaps: only instance fields (a static field is invisible), only constructor parameters, only one assembly, an incomplete list of forbidden types, only the types that existed when it was written.
- **Query filter injection.** Every filter or query built by string concatenation or interpolation from user input. In SQL this is obvious; in OData/Table Storage, Cosmos, Elasticsearch, LDAP and Mongo it is just as real and far less often checked. A single quote or an injected `or` can dissolve the partition predicate.
- **Key construction.** If keys are composite (`{a}|{b}|{c}`) or hierarchical, can a user-supplied id contain the separator, a path character, `..`, or a prefix that makes a range scan spill into a sibling? Are ids server-minted, or accepted from the client and trusted?
- **Blob / object / file paths.** Prefixed by tenant? Is the prefix terminated (does `acme` match `acme2`)? Is any part of the path caller-supplied — a filename, an extension, an id?
- **By-id reads.** For every "get X by id" route: does it re-check that X belongs to the caller's tenant, or does the id alone resolve it? The classic hole is a lookup that scans across partitions because the id is globally unique.
- **Caches.** Every in-memory cache, memo, dictionary and singleton: is the cache key tenant-qualified? A cache keyed on an entity id alone serves tenant A's row to tenant B.
- **Background workers, schedulers, reconcilers, sweeps.** How do they enumerate tenants, and do they construct a scope per tenant? A worker holding one scope across an iteration writes into whichever tenant it started in.
- **The deliberately-widened place.** Most multi-tenant systems have one — an account directory, a sign-in lookup, a billing table. Find it, read its documentation, and check the widening is as narrow as claimed (no list operation, no write from a request path, a reserved partition nobody owns).
- **Cross-tenant moves.** Invite acceptance, account merging, org transfer, "switch workspace". Can any of them place an account where it should not be, or strand it somewhere it cannot leave?

---

## 2. Authentication, session & account lifecycle

- **Cookie flags.** `HttpOnly`, `Secure`, `SameSite`, `Path`, `Domain`, expiry. **`Secure` must be unconditional.** A "secure if the request was HTTPS" policy behind a TLS-terminating proxy writes the flag off, because inside the container the request is plain HTTP — unless forwarded-header handling is configured. Check for that configuration explicitly; its absence is the finding.
- **Transport.** HSTS, HTTPS redirection, minimum TLS version, and whether the app trusts `X-Forwarded-*` from only the proxy or from anyone.
- **Session lifetime and revocation.** Is there an absolute cap or only a sliding one? Is the session self-contained (a signed bearer) or server-backed? Can an administrator revoke one session, or all of a member's sessions? Does removing a member or downgrading their role take effect on an existing session, and on the *next request* or eventually? Long-lived streams and websockets are the usual exception — see §6.
- **The key ring.** Whatever signs or encrypts the session cookie: where does it live, is it persisted, is it protected at rest, is it shared across instances, what happens when it rotates or is lost? A default that writes a plaintext key file onto the app's own filesystem means anyone with deploy or file access can forge any session.
- **OAuth/OIDC correctness.** `state` and PKCE present and enforced (not merely defaulted-on by a library that a config flag disables); nonce checked; the redirect URI allowlisted; tokens not stored in the browser if the architecture says backend-for-frontend.
- **Open redirect.** Every `returnUrl`, `next`, `continue`, `redirect_uri` parameter. Test `//evil.com`, `/\evil.com`, `https://evil.com`, `/%2f%2fevil.com`, and a validated-then-mutated value. An open redirect off a sign-in flow is a credential-phishing primitive.
- **Account linking — the one most often wrong.** If two identity providers can produce the same email, does the second sign-in land in the first's account? If so, an attacker with any provider that lets them set an unverified email owns that account. Check whether accounts are keyed on a provider-namespaced subject id (sound) or on email (usually not). Check `email_verified`.
- **Registration and provisioning.** Who can create an account and what does it cost you? Open self-serve provisioning that mints a resource quota per signup is an abuse surface even when it is intentional — flag it for confirmation rather than as a defect.
- **Invites and account recovery.** Token entropy and source (a CSPRNG, not `Random` or a GUID-as-secret); stored hashed or in the clear; expiry; single-use enforced by a conditional/atomic write, not a read-then-write; bound to the invited identity or open by design; delivered in a URL fragment (never reaches logs or `Referer`) or a query string; what the preview endpoint discloses to an unauthenticated caller; whether the role it grants is capped.
- **Enumeration.** Do sign-in, password reset, invite preview or a 404-vs-403 difference reveal whether an account, workspace or resource exists? Is the difference constant-time?
- **CSRF.** Not just "is there a token". Which state-changing routes exist, what content types do they accept, is there a CORS policy that reflects the origin or pairs `AllowAnyOrigin` with credentials, and is `SameSite` the only thing standing between a hostile page and a write? **Every state-changing GET** is a finding on its own.
- **Dev and test bypasses.** A fake sign-in, a "local user", a header that grants auth, an `IsDevelopment()` branch, a seeded admin with a known credential. Then: can it be reached in the deployed configuration?
- **Middleware order.** Authentication before authorization; the static-file/SPA fallback not swallowing API 401s into a 200 HTML page; exception handling not running before authentication.

---

## 3. Authorization / RBAC

- **Build the matrix yourself.** Roles × permissions from the source, then every route and what it requires. Produce it as an appendix even when nothing is wrong — it is the artefact the user can actually reason about, and it makes the next review cheap.
- **Every unauthenticated route, enumerated.** Health, metrics, version, docs/Swagger, callbacks, previews, static config endpoints. For each: what does it disclose, and is it deliberate? Health endpoints leaking versions, configuration state or dependency status are common.
- **Is there a guard that forces classification?** A test that sweeps the live route table and fails on any route without an explicit decision is the single highest-value control in this domain. If it exists, check it covers verb-less registrations and route groups. If it does not, recommend it — it closes the whole "someone added an endpoint and forgot" class.
- **Permission granularity.** Anything that spends money, destroys data, grants access, or exports in bulk should need more than "can edit". Check specifically: delete/purge, bulk export, member management, role change, invite, token minting, credential read/write, queue control, retention sweeps, quota changes.
- **Privilege escalation through self-edit.** Can a member PATCH their own role? Can an admin promote themselves to owner, or demote/remove the owner? Can the last owner be removed, locking the resource? Is the rule enforced at the store as well as the endpoint?
- **Mass assignment / over-posting.** Does a request DTO bind straight onto a domain model or row? Can a caller set `Role`, `TenantId`, `OwnerId`, `Status`, `CreatedAt`, `AllocationBytes` by adding a field to the JSON? Check every PATCH/PUT that takes a partial object.
- **IDOR.** Sequential or guessable ids; a resource reachable by id without an ownership check; a child resource whose parent is not verified (asset in a bin in a project — is the whole chain checked, or only the leaf?).
- **UI-only authorization.** Grep the front end for role checks, then verify the server enforces each one. List every case where it does not. A hidden button is not a control.
- **Machine/service roles.** What is the service principal for, what can it do, can a human be assigned it, can it be self-assigned, and does it have more than it needs?
- **Confirmation and refusal enforced server-side.** A destructive operation gated only by a dialog is ungated. Check that "are you sure" corresponds to an explicit flag in the request body — and that the flag cannot be supplied via a query string, so a link or a prefetch cannot trigger it.
- **Constants and comments that lie.** A named constant or comment describing a separation that the value does not implement. Low severity, high future cost.
- **Fail-open defaults.** How does the code behave when a role, permission or flag cannot be parsed? The safe default is the *weakest* role, not the common one. Check the row/DTO parser as well as the policy table — a policy that fails closed behind a parser that fails open never runs.

---

## 4. Remote & machine access — API tokens, MCP, webhooks

- **Token generation.** CSPRNG, enough bits (≥128, prefer 256), a recognisable prefix so it can be scanned for in logs and repos.
- **Token storage and comparison.** Hashed at rest (a single fast hash over a high-entropy random token is correct; a slow KDF is unnecessary and a plaintext store is a finding). Constant-time comparison. How is the token looked up — if the lookup needs the tenant, how is the tenant known before authentication? Encoding it in the token and covering it with the hash is the sound pattern; a cross-partition scan is not.
- **Token lifecycle.** Expiry (or a documented decision that there is none); revocation and whether it is immediate or cached; a cap on how many can exist; what happens when the creating member is removed, deactivated or demoted — a token that outlives its author's access is the most common real hole here.
- **Token scope.** Is a token's permission set *intersected* with its creator's, or unioned? Can a token mint another token? Can it reach routes its stated scope does not cover — and does any scope field (a project, a folder) apply on every path or only on one?
- **What does the machine surface actually expose?** Enumerate every tool/endpoint and verify read-only means read-only. Look for the accidental write: a "mark as read", a "touch", a last-seen stamp, a bootstrap-on-first-use, a cache warm. These are how a read-only credential turns out to write.
- **Does the machine path honour the same tenant and role checks** as the human path, or does it have its own, subtly different, implementation?
- **Can a browser session reach the machine endpoint?** If the transport accepts cookies, a hostile page plus any CORS loosening becomes a cross-site read of everything. The credential paths should be separate by construction, not separate because `SameSite` happens to hold.
- **Webhooks and callbacks.** Signature verification (and constant-time); replay protection (timestamp + nonce); whether the endpoint is a public unauthenticated write path into customer data; whether it can be removed entirely because the system polls instead.
- **Rate limits and volume caps** on machine endpoints specifically — they are polled, often in loops, sometimes by a model with no judgement about cost.
- **What machine responses disclose.** Internal ids, storage paths, other members' identities, signed URLs, the credential itself, error text from upstream.

---

## 5. Secrets, cryptography & key management

- **Committed secrets.** Search *tracked* files and **the full history** (`git log -p -S`, `git log --all`). A secret removed in a later commit is still leaked. Cover: cloud connection strings with an account key, provider API keys by their known prefixes, OAuth client secrets, SAS tokens, signing keys, private key PEM headers, `.env` files, IaC parameter files, CI workflow files, test fixtures that were once real, and documentation. **Report location and kind, never the value.**
- **The protector.** For anything encrypted at rest: algorithm (AEAD such as AES-GCM or ChaCha20-Poly1305, not ECB and not unauthenticated CBC), a fresh random nonce per encryption, key derivation (a KDF, not the raw passphrase), and a versioned envelope.
- **The fallback when the key is missing.** This is the critical question. Does it throw, or does it silently store plaintext, use a hardcoded key, or use a machine-local key that changes on restart and destroys the data? A silent plaintext fallback is critical regardless of how unlikely the path looks.
- **Rotation.** Can the key be rotated without destroying every stored secret? Is there a key id in the envelope and a retired-key list, or does one rotation invalidate everything at once? An unversioned envelope plus a versionless vault reference means routine hygiene is an outage — say so explicitly, because nobody finds out until they do it.
- **What leaves the process.** Trace every credential-bearing DTO to its serialization. A property that exists is serialized even if the UI ignores it. Check for: the full value, the ciphertext, a "half" of a legacy two-part credential, or an identifier that is itself sensitive. Check that masking is applied at the type, not at each call site.
- **`ToString` and structured logging.** `$"{key}"` calls `ToString`; `logger.LogInformation("{Key}", key)` may not, and `JsonSerializer.Serialize(key)` does not. Records generate a `ToString` that prints every property. Verify the override exists on every credential type *and* that nothing bypasses it.
- **Logging paths that carry secrets by accident.** HTTP client failure logging that includes request headers (`Authorization`); `ex.ToString()` on a request exception; retry loops; a framework's Trace-level `HttpClient` logging; APM/telemetry configured to capture request headers or bodies; a client-side error collector that could capture a form field.
- **Key testing / validation endpoints.** Do they echo the credential back, forward an upstream error body verbatim, or work as an oracle for probing arbitrary hosts?
- **Deletion.** When a credential is deleted, is the row removed, and is every cached decrypted copy invalidated — a static, a memory cache, a pooled client with a preset default header? A credential that keeps working after deletion is a finding.
- **Randomness.** `Random`, `Math.random()`, `uuid4` used as a secret, a timestamp, a counter. Anything security-bearing needs a CSPRNG.
- **Signed URLs / SAS.** Expiry, permissions, per-object scope, whether they are loggable, whether they move the authorization boundary to a token nobody re-checks. Proxying bytes through the application is slower and usually safer; if the system does that deliberately, note it as sound.

---

## 6. Untrusted input, SSRF, denial of service & the client

**SSRF** — for every place the server fetches a URL that anyone influenced:

- Where does the URL come from? User input, a third party's response payload, configuration, service discovery?
- Scheme restricted to https? (Allowing `http` means a DNS or network answer is enough to redirect the fetch.)
- Host allowlisted? Is `169.254.169.254`, `metadata.google.internal`, loopback, RFC1918, `.internal`, IPv6 link-local, and DNS-rebinding blocked?
- Are redirects followed, and is the destination re-validated **after** each hop?
- Is there a response size cap and a timeout? An uncapped buffer is a memory DoS with the fetch as the trigger.
- On a cloud host, say explicitly what it would and would not yield — most instance metadata services now require a header, which a plain redirected GET cannot set. Rate it accordingly rather than reflexively critical.

**Uploads**

- Size limit enforced by a *streaming* reader, not by a declared `Content-Length` that a chunked request simply omits; and not by a form reader that buffers every part before returning.
- Does the enforced limit match the advertised one, and does the platform's own body cap sit below both?
- Type validated by magic bytes and a real decode, not by extension or the client's `Content-Type`.
- Decode bombs: pixel-count ceiling, decompression ratio limit, archive entry count.
- Is the stored name derived from the uploaded filename? Traversal, separators, `..`, and the tenant prefix.
- Part count and field count limits.

**Serving bytes back** — the stored-XSS question

- What `Content-Type` is set: an allowlist, or echoed from what was stored?
- Is `X-Content-Type-Options: nosniff` set? Is there a CSP? Is there a `sandbox` on anything embedded?
- Can an SVG or HTML file be uploaded and served inline from the application's own origin? That is full session takeover. If the only thing preventing it is a content-type allowlist that happens to omit `.svg`, say so — one plausible-looking future line reopens it.
- `Content-Disposition`: `attachment` for downloads, filename encoded, no CR/LF injection.

**Denial of service and cost**

- Unbounded caller-supplied arrays — id lists, bulk operations, batch endpoints. Find the one place a cap *is* applied and note that the rule already exists.
- Unbounded pagination, a caller-controlled `take`/`limit`, a missing page cap.
- Amplification: one cheap request causing many expensive operations — a full table scan, a per-item fetch, an unbounded fan-out, a fetch per element.
- Long-lived connections (SSE, websockets, long-poll): per-caller cap, absolute lifetime, and **re-authorization while open** — authorization at connect time only means revocation does not reach them.
- Accumulating state replayed on every subsequent call (a history, a log, an audit trail) with a per-item cap but no total cap.
- Regular expressions over user input (ReDoS), especially nested quantifiers.
- Zip/archive generation: streamed or buffered; entry names sanitised; per-entry authorization, not just on the first.

**Client-side**

- `dangerouslySetInnerHTML`, `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `eval`, `new Function`, template compilation on user data.
- `href`/`src` bound to a user-controlled value — `javascript:` and `data:` URLs.
- `target="_blank"` without `rel="noopener"`.
- User-controlled values injected into CSS, style attributes or CSS variables — validate colours, sizes and URLs.
- Secrets in the bundle: build-time env vars with a public prefix (`VITE_`, `NEXT_PUBLIC_`, `REACT_APP_`), source maps shipped to production, API keys in client config.
- `postMessage` handlers without an origin check; `localStorage`/`sessionStorage` holding anything sensitive.
- Third-party scripts: who serves them, is there Subresource Integrity, and what page do they run on? A script on the page where credentials are typed is a supply-chain path to those credentials, even when it is your own service.

**Error handling**

- Stack traces or exception detail returned in production; a developer exception page conditional on an environment variable that could be set.
- Upstream error bodies forwarded verbatim (they may contain the credential you sent).
- Different messages or timings for "not found" vs "not allowed".

---

## 7. AI & agent surface

Skip if the system has no model integration. Include if it calls an LLM, exposes MCP tools, or has an agent loop.

- **Indirect prompt injection.** Every piece of stored or fetched content that reaches a model: user-authored prompts, names, notes, file contents, fetched web pages, tool results. Is any of it marked or fenced as data? Rate honestly — untreated tool output is the industry-normal posture, and if the injector must already be inside the tenant it is hardening, not a boundary hole. It is a real finding when the content crosses a trust boundary (another tenant, a fetched page, an email).
- **Excessive agency.** What can the model cause to happen without a human in the loop? Is drafted output ever auto-executed, auto-submitted, or auto-approved? A model that writes a proposal a person approves is a different risk class from one that spends money directly.
- **Transport confusion.** If the design says the model is for authoring only and never carries data or calls a downstream service, verify that — and verify what the model is *shown*, which is often broader than what the design describes.
- **Cost.** Whose key pays? Is there a per-caller cap, a per-tenant cap, a size cap on what is sent? Can a low-privilege user cause unbounded spend?
- **Model output handling.** Is it parsed, deserialized, rendered as markup, used as a file path, or used to build a query? Treat it as untrusted input, because it is.
- **Tool schemas and descriptions** as an injection vector in MCP: a tool description or result that instructs the *client's* model.
- **Data sent to the provider.** Which fields leave the building, is that documented, and does it match what customers were told? Is there a retention or training opt-out where one matters?

---

## 8. Supply chain & CI/CD

- **Dependency advisories.** `npm audit --omit=dev`, `dotnet list package --vulnerable --include-transitive`, `pip-audit`, `cargo audit`, `govulncheck` — whichever applies. **Report only what has a real path in this application**, and say explicitly when an advisory does not apply and why. An untriaged red audit is worth a low-severity issue on its own, because nobody reads a permanently-red signal.
- **Lockfiles** present and committed; no floating major versions; no dependency resolved from an unexpected registry.
- **Workflow injection.** In CI YAML, `${{ github.event.* }}` interpolated into a `run:` block is shell injection from anyone who can open a PR or write an issue title. Check every expression inside `run:`.
- **`pull_request_target`**, `workflow_run`, and any trigger that runs with write permissions or secrets against untrusted code. Combined with a checkout of the PR head, this is repository takeover.
- **Action pinning.** Third-party actions referenced by tag or branch rather than a commit SHA.
- **Secrets in CI.** Which workflows can read which secrets; whether a fork-triggered run can; whether secrets are echoed, passed as command-line arguments (visible in process listings), or written to artefacts and logs.
- **Deploy authority.** Who or what can deploy to production, is it gated by an environment approval, is the cloud credential a short-lived OIDC federation or a long-lived secret, and how narrowly is the federated credential scoped (to a repo? a branch? an environment?).
- **Branch protection** on the default branch: required checks, required review, force-push and deletion disabled, and whether the automation can bypass it.
- **Build reproducibility and artefact provenance** if the project ships binaries.
- **Repository hygiene**: `.gitignore` covering local settings and credential files; no `.env` tracked; no build output tracked.

---

## 9. Infrastructure as code & cloud posture

Read the Bicep/Terraform/CloudFormation, not just the application.

- **Identity.** Managed identity / workload identity versus a stored account key or connection string. Are shared keys disabled on storage where they could be?
- **Role scope.** Is a role assignment scoped to the resource, or to the resource group or subscription? Over-broad role assignments are the most common IaC finding and the least often noticed.
- **Public exposure.** Public network access on data stores; anonymous blob/bucket access; container public-access level; firewall rules and `0.0.0.0/0`; whether a private endpoint is used where it matters; management ports open.
- **Secret references.** Vault references pinned to a specific *version* (rotation silently has no effect) versus unpinned (rotation applies — check the application can survive it, see §5). Secrets supplied as deploy-time parameters and therefore present in deployment history.
- **Vault configuration.** Soft-delete and purge protection enabled; access via RBAC or access policies; who holds `get`/`list` on secrets.
- **Transport.** HTTPS-only, minimum TLS version, FTP/FTPS state, legacy protocol support.
- **Logging and diagnostics.** Are diagnostic settings enabled at all (you cannot investigate what was never recorded)? Do any of them capture request bodies or headers, and where do they go? Retention period.
- **Unused resources and unused secrets.** A provisioned secret nothing reads is pure liability — nobody rotates it and nobody notices if it leaks.
- **Backup and recovery.** Is there any? Can an attacker or a bug destroy data irrecoverably? Is soft-delete on for blobs and tables? This is in scope even though it does not read as "security" — availability and durability are part of it, and destructive-operation findings (§3) depend on the answer.
- **Blast radius between environments.** Do dev and prod share a storage account, a vault, a key, a service principal, a database?

---

## 10. Abuse, cost & business logic

Rarely in a checklist, frequently where the real loss is.

- **Spend.** Every operation that costs money: who can trigger it, is there a per-caller or per-tenant ceiling, and is the ceiling enforced before the spend or after? A quota expressed in stored bytes does not bound a spend expressed in credits.
- **Race conditions / TOCTOU.** Quota checks, credit deduction, concurrency slots, single-use tokens, uniqueness constraints. Is the check-then-act atomic (a conditional write, an ETag, a transaction), or two separate operations that two requests can interleave?
- **Idempotency.** Retries and resubmissions: can a network retry double-charge, double-submit or double-grant?
- **Irreversibility.** For each destructive operation: is it recoverable, by whom, and for how long? Is the *most* destructive one the hardest to reach, or the easiest? Compare sibling operations — an inconsistency (a child refuses to delete while its parent cascades) is usually a bug rather than a decision.
- **Accidental self-harm.** The operations a well-meaning user can perform that cannot be undone and have no support path. These deserve high severity even with no attacker, because they will happen.
- **Noisy neighbour.** In a shared deployment, can one tenant degrade another — memory, connections, queue slots, a shared worker, a global lock?

---

## 11. Privacy & data lifecycle

- **What personal data is held**, where, and for how long. Is there a retention policy and is it enforced by something that runs?
- **Deletion.** Does delete actually delete, or only hide? Is there a purge path, and is the distinction deliberate and documented? What happens to backups, caches, logs and search indexes?
- **Export.** Can a user get their data out; can someone else get it out for them; is bulk export permission-gated and logged?
- **Third-party egress.** Every service the system sends customer data to — model providers, error collectors, analytics, telemetry, email. Is the list documented and does it match what customers were told?
- **Logs as a data store.** What lands in application logs, and who can read them? Log access is almost always a much wider circle than data access, which is why credentials or personal data in logs are worth more severity than they first appear.
- **Audit trail.** Is there a record of who did what to whom — particularly for permission changes, credential changes, exports and deletions? Its absence is a finding when the system holds other people's data.

---

## 12. Things reviewers habitually miss

A final sweep. Each of these has been a real finding in a real codebase.

- The rule implemented **twice** — once where it is enforced and once where it is not. Grep for the condition, not the function name. Two implementations of one security rule is itself the defect, even when both are currently correct.
- A **comment or constant that describes a control that does not exist.** It will be relied on.
- **The long-lived connection** that authorizes once (§6).
- **The background job** that runs as nobody, or as everybody.
- **The endpoint added last week** that nobody classified.
- **The test that has never been seen red** — it proves only that it agrees with the code.
- **A guard test whose reflection scan misses statics, properties, or other assemblies.**
- **A default value that fails open** in a parser sitting in front of a policy that fails closed.
- **The "deliberate" decision nobody wrote down** — ask whether the documentation records it. If not, the next person will change it.
- **The `.md` in the repo that is now false.** Documentation claiming a guarantee the code no longer keeps is a finding, because people act on it.
- **Anything the project's own docs say is "not up for renegotiation"** — verify it is actually still true. Settled decisions drift.
