---
name: new-azure-site
description: "Bootstrap a React/Vite SPA and .NET API on Azure App Service from a user-selected GitHub template, with dev and production environments, Table Storage, OAuth sign-in, CI/CD and optional custom domains. Use when the user asks for a new site on Azure using a compatible starter or invokes /new-azure-site."
---

Read [host execution guidance](references/host-runtime.md) before running this workflow.

# New Azure Site — conductor

This workflow supports GitHub templates for a React/Vite SPA and .NET API hosted together on one Azure App Service per environment, with Azure Table Storage, OAuth and GitHub Actions. A compatible template includes its infrastructure, deployment workflows and a `BOOTSTRAP.md` covering setup.

Use the template from the request or `JASON_TOOLKIT_AZURE_TEMPLATE` (`owner/repo`). If neither is set, ask the user for a compatible template. Verify access with `gh repo view <template>` and confirm it is a GitHub template.

Read the selected template's **`BOOTSTRAP.md`** before creating resources. Use it as the source of truth for the rename map, commands, branch and environment names, and deployment order. The steps below describe common starter conventions. Check them against the selected template before running them.

## Phase 0 — prerequisites

Required CLIs: `git`, `gh`, `az`, `dotnet`, `node` and `npm`. Check their versions against the template's requirements. Use the template's documented setup for Azurite and Playwright when needed.

- If any are missing, do NOT silently install: use the host's question tool or ordinary chat to list what's missing and offer to install them (Windows: `winget install Git.Git GitHub.cli Microsoft.AzureCLI Microsoft.DotNet.SDK.10 OpenJS.NodeJS.LTS`; macOS: `brew install git gh azure-cli dotnet node`). Install only what the user approves, then re-verify.
- Check `gh auth status` and `az account show`. If either is signed out, have the user run `gh auth login` or `az login` in their terminal. Confirm the GitHub account can read the selected template and create a repository under the chosen owner.
- Confirm the subscription with the user if more than one exists.
- Check current costs for the chosen region, operating system and plan. Include storage and Key Vault when estimating the total.

## Phase 1 — gather inputs

Derive everything you can from the user's request first; ask only what's missing. Use the host's question interface when available, otherwise ask in ordinary chat. Follow its actual question and option limits; bundle closely related inputs and accept free-text answers:

1. **Site name** — usually stated in the request. If not, ask (options can be name suggestions derived from their description; "Other" lets them type). Constraints to derive: lowercase resource token `<appname>` (alnum, short); storage account `st<appname><env>` must be **≤24 chars, lowercase alnum** — if too long, propose a shortened token.
2. **Region** — suggest regions based on the project's requirements and available quota in the selected subscription.
3. **App Service plan** — check whether the template supports a shared plan. Use `az appservice plan list` to find eligible existing plans and confirm which one to use, or confirm a new tier and its estimated cost.
4. **Sign-in providers** — `multiSelect`: `Microsoft`, `Google`, `Apple`, `None for now`. (Microsoft is automatable; Google requires ~10 min of user console work; Apple requires a paid Apple Developer account and ~15 min of portal work. There are NO demo/test accounts — until a provider is configured the site has no way to sign in.)

Second call if still unknown: **custom domain** (`I own a domain` → collect it via Other / `azurewebsites.net only for now`), **repo visibility** (`Private (Recommended)` / `Public`).

## Phase 2 — repo

1. In the user's chosen workspace parent, run `gh repo create <owner>/<appname> --template <template-owner>/<template-repo> --clone` with `--private` or `--public` according to the chosen visibility.
2. Execute the rename map from `BOOTSTRAP.md`. Run the template's local build and affected test suites before committing and pushing.
3. Set any deployment enablement variables at the point specified by the template. For workflows guarded by `DEPLOY_ENABLED`, use `gh variable set DEPLOY_ENABLED --body true -R <owner>/<appname>`.

### Local validation

Preserve the template's repository instructions and CI settings through the rename. Run the full client and backend suites using the commands documented by the template and report their durations.

## Phase 3 — Azure bootstrap

Follow BOOTSTRAP.md order:
1. Resource groups `rg-<appname>-dev` / `rg-<appname>-prod`.
2. OIDC app registration `github-<appname>` + federated credentials for GitHub environments `dev` and `production`; Contributor on both RGs.
3. Repo secrets `AZURE_CLIENT_ID` / `AZURE_TENANT_ID` / `AZURE_SUBSCRIPTION_ID`.
4. Apply the branch ruleset from `github/ruleset.json` (PR required, linear history, required check `build / build`).
5. Turn on automatic deletion of merged PR branches: `gh api -X PATCH repos/<owner>/<appname> -F delete_branch_on_merge=true`. It's a per-repo setting (GitHub has no org-wide default), so every new repo needs it.

## Phase 4 — infra deploys (the secret-handling rules)

Deploy in the documented order. If the production deployment creates the plan shared by both environments, deploy that plan before the dev resources that reference it.

- Read secret inputs from the approved secret store or protected temporary files without echoing them or committing them. Remove temporary secret files after verification.
- Check how the template handles existing secrets on redeploy. For templates that overwrite secrets, supply every required value and verify that all values are present before deployment. Key Vault read access depends on the caller's permissions. Stop if a required lookup fails or returns an empty value.

## Phase 5 — auth providers

- **Microsoft:** Create per-environment Entra app registrations using the audience and callback URLs documented by the template. For `AzureADandPersonalMicrosoftAccount`, configure `api.requestedAccessTokenVersion: 2`. Record the expiry date when provisioning a client secret.
- **Google:** Configure the consent screen and a web application OAuth client for each environment in Google Cloud. Use the template's callback URLs and the appropriate publishing status. Store client secrets using the approved secret-handling method.
- **Apple (manual, no API exists)**: walk the user through developer.apple.com → Certificates, Identifiers & Profiles: an **App ID** with the Sign in with Apple capability; one **Services ID** per env (this is `authAppleClientId`, e.g. `com.<appname>.web` / `com.<appname>.web.dev`) with the site's domains and `/signin-apple` **Return URLs** (https only — Apple refuses localhost/http, so no local-dev entry); one **Sign in with Apple key** (download the `.p8` once, note the **Key ID**; the **Team ID** is in the portal header). Have them drop the `.p8` body (base64, one line, header/footer stripped) plus ids into scratchpad files. Bicep params: `authAppleClientId`, `authAppleTeamId`, `authAppleKeyId`, `authApplePrivateKey` (@secure → Key Vault `Auth-Apple-PrivateKey` in prod).
- **Local dev**: `dotnet user-secrets set "Auth:<Provider>:ClientId|ClientSecret"` (Apple: `ClientId|TeamId|KeyId|PrivateKey`) with the DEV values. Apple can't complete on http://localhost — test it on the dev site.

## Phase 6 — custom domain + cert (if chosen)

Per the template README runbook: give the user the DNS records to create at their registrar (TXT `asuid.<host>` = `customDomainVerificationId`, CNAME for subdomains / A+TXT for apex), then `az webapp config hostname add`, `az webapp config ssl create` (App Service managed cert — free on B1), `az webapp config ssl bind`. Dev subdomain (`dev.<domain>`) + prod apex/www.

## Phase 7 — verify + hand over

1. Verify the dev deployment using the template's health and sign-in checks. If it exposes an auth providers endpoint, confirm it lists exactly the configured providers. Allow the site to restart after App Service settings change.
2. Follow the template's production release process and verify production settings, including any initial data or seed configuration, when production deployment is authorized.
3. Record the deployed resource groups, OIDC app ID, auth registrations, secret expiry dates and domain status in the project's designated handover location. Keep secret values in the approved secret store.
4. Report the URLs, deployment status, remaining manual steps and secret expiry dates.
