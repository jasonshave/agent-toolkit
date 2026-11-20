#!/usr/bin/env bash
# Runs one non-Claude committee member (Codex or Grok) for one round and saves its answer as JSON.
#
#   run-member.sh <codex|grok> <prompt-file> <out-json> <work-dir> [session-id|-] [image ...]
#
# Round 1: pass "-" as the session id. The member's session id is saved to <out-json>.session.
# Later rounds: pass that id, so the member continues its own session and keeps what it has read.
# Images (screenshots) are attached for Codex; give Grok their paths in the prompt.
# Logs and raw output are written next to <out-json>, so keep that in the chair's folder.
#
# Exit codes: 0 ok · 2 tool missing or not signed in · 3 timed out · 4 failed, or the answer was
#             not in the required shape · 5 files in <work-dir> changed during the run (this wins
#             over 3 and 4: check it first)
#
# Environment: COMMITTEE_WEB=1 lets the member search the web. It is off by default because members
# read private material and a web request is a way to leak it. Also COMMITTEE_CODEX_MODEL,
# COMMITTEE_CODEX_EFFORT, COMMITTEE_GROK_MODEL, COMMITTEE_GROK_EFFORT, COMMITTEE_TIMEOUT (seconds,
# default 1200).
#
# Why the lock-down flags look like this: "Keeping members read-only" in SKILL.md.
# self-test.sh proves them in a throwaway repo.
set -u
tool="${1:?tool}"; prompt="${2:?prompt file}"; out="${3:?out file}"; dir="${4:?work dir}"
session="${5:--}"
shift $(( $# < 5 ? $# : 5 ))
here="$(cd "$(dirname "$0")" && pwd)"
schema="$here/member-response.schema.json"
limit="${COMMITTEE_TIMEOUT:-1200}"
web="${COMMITTEE_WEB:-0}"
raw="$out.raw"; log="$out.log"; events="$out.events"
mkdir -p "$(dirname "$out")"
command -v node >/dev/null || { echo "node is not installed (needed to read answers)" >&2; exit 2; }

state() { bash "$here/repo-state.sh" "$dir"; }
winpath() { if command -v cygpath >/dev/null; then cygpath -m "$1"; else printf '%s' "$1"; fi; }

case "$tool" in
  codex)
    command -v codex >/dev/null || { echo "codex not installed" >&2; exit 2; }
    codex login status >/dev/null 2>&1 || { echo "codex not signed in (run: codex login)" >&2; exit 2; }
    lock=(--ignore-user-config --ignore-rules --skip-git-repo-check
          -c approval_policy=never -c sandbox_mode=read-only -c windows.sandbox=elevated)
    for f in apps plugins remote_plugin multi_agent image_generation computer_use browser_use \
             browser_use_external in_app_browser goals hooks tool_suggest skill_mcp_dependency_install; do
      lock+=(--disable "$f")
    done
    [ "$web" = "1" ] || lock+=(-c web_search=disabled)
    model=(-m "${COMMITTEE_CODEX_MODEL:-gpt-6.1-sol}" -c "model_reasoning_effort=${COMMITTEE_CODEX_EFFORT:-high}")
    imgs=(); for i in "$@"; do imgs+=(-i "$i"); done
    before="$(state)"
    if [ "$session" = "-" ]; then
      ( cd "$dir" && timeout "$limit" codex exec "${lock[@]}" "${model[@]}" -s read-only "${imgs[@]}" \
          --json --output-schema "$schema" -o "$raw" - < "$prompt" > "$events" 2> "$log" )
    else
      ( cd "$dir" && timeout "$limit" codex exec resume "${lock[@]}" "${model[@]}" "${imgs[@]}" \
          --json --output-schema "$schema" -o "$raw" "$session" - < "$prompt" > "$events" 2> "$log" )
    fi
    rc=$?
    after="$(state)"
    sid="$(grep -o '"thread_id":"[^"]*"' "$events" 2>/dev/null | head -1 | cut -d'"' -f4)"
    ;;
  grok)
    command -v grok >/dev/null || { echo "grok not installed" >&2; exit 2; }
    # If the user has trusted this folder (or a parent) in Grok, its project hooks, MCP servers and
    # instructions load for every Grok session there, and a hook can run any command. Don't seat
    # Grok. The check accepts only the exact layout Grok writes, and refuses on anything else.
    why="$(node "$here/grok-trust-check.js" "$(winpath "$(cd "$dir" && pwd)")" 2>&1)"
    if [ $? -ne 0 ]; then
      echo "grok: $why. Its project hooks could run during the review, so not seating Grok" >&2
      exit 2
    fi
    # Grok's --json-schema flag makes it answer in one shot without opening any files (seen
    # 2026-11-05: it invented line numbers), so the schema goes in the prompt instead.
    tools="read_file,grep,list_dir"; [ "$web" = "1" ] && tools="$tools,web_search"
    full="$out.prompt.txt"
    { cat "$prompt"
      printf '\n\nYour tools are read-only: %s. You cannot run shell commands; the chair has saved any diff or command output you need as files named in the brief.\n' "$tools"
      printf '\nYour FINAL message must be ONLY a JSON object matching this JSON Schema: no prose, no code fence.\n'
      cat "$schema"; } > "$full"
    lock=(--tools "$tools" --deny 'MCPTool(*)' --permission-mode dontAsk --no-subagents)
    # Grok's read tools can open any path, so fence off the chair's folder (the seat map and the other
    # members' answers), earlier committee records and the usual secret files. The fences are
    # unrooted (**/...) because Grok checks a path as written, before expanding ~: a fence on
    # C:/Users/me/.codex/** let ~/.codex/... through, while **/.codex/** blocked ~, backslash,
    # lower-case drive and ../ spellings alike (tested 2026-11-06). Read rules also cover grep and
    # list_dir. Codex and Claude members are kept out of these by instruction only.
    fences=('**/*.pem' '**/*.key' '**/*.pfx' '**/id_rsa*' '**/id_ed25519*' '**/.env' '**/.env.*'
            '**/local.settings.json' '**/.credentials.json' '**/.claude.json' '**/.npmrc'
            '**/.git-credentials' '**/.netrc' '**/.pypirc')
    # Folders: fence the folder itself as well as what is inside, or list_dir still shows file names.
    for d in committee-chair .committee .ssh .azure .aws .codex .grok .config/gh .docker .kube 'GitHub CLI'; do
      fences+=("**/$d" "**/$d/**")
    done
    # ~/.claude holds Claude's settings and history, but an unrooted fence would also hide a reviewed
    # repo's own .claude/ folder, and a review may be of something inside ~/.claude (a skill). So it
    # is fenced by its full path and by ~ spellings, including ~/.. and ~/./ forms, which Grok does
    # not tidy before checking (tested with a decoy folder, 2026-11-06); and only when the folder
    # under review is elsewhere. Claude's credentials file is covered by **/.credentials.json anyway.
    home="$(winpath "$HOME")"; work="$(winpath "$(cd "$dir" && pwd)")"
    case "$work/" in "$home/.claude/"*) ;;
      *) fences+=("$home/.claude" "$home/.claude/**" '~/.claude' '~/.claude/**' '~/**/.claude' '~/**/.claude/**') ;;
    esac
    for g in "${fences[@]}"; do lock+=(--deny "Read($g)" --deny "Grep($g)"); done
    model=(-m "${COMMITTEE_GROK_MODEL:-grok-4.7}" --reasoning-effort "${COMMITTEE_GROK_EFFORT:-high}")
    resume=(); [ "$session" != "-" ] && resume=(-r "$session")
    # Grok also picks up Claude and Cursor hooks, MCP servers, skills, rules and CLAUDE.md files, from
    # the home folder and the reviewed repo. A member mustn't run the user's hooks or take the repo's
    # CLAUDE.md as instructions to itself (it can still read it as material), so switch them all off.
    compat=(); for v in CLAUDE CURSOR; do for c in HOOKS MCPS SKILLS RULES AGENTS; do
      compat+=("GROK_${v}_${c}_ENABLED=false"); done; done
    # Ask for folder trust to stay on, so an untrusted repo's own hooks, MCP servers and instructions
    # stay gated. Grok's docs name GROK_FOLDER_TRUST=0 as the way to turn it off and say env beats
    # config.toml; that =1 overrides a config that turned it off is inferred from that, not tested.
    compat+=(GROK_FOLDER_TRUST=1)
    before="$(state)"
    env "${compat[@]}" timeout "$limit" grok "${resume[@]}" "${lock[@]}" "${model[@]}" --max-turns 60 \
      --output-format json --cwd "$dir" --prompt-file "$full" > "$events" 2> "$log"
    rc=$?
    after="$(state)"
    sid=""
    if [ $rc -eq 0 ]; then
      sid="$(node -e '
        const fs = require("fs");
        const d = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
        fs.writeFileSync(process.argv[2], d.text || "");
        process.stdout.write(d.sessionId || "");
      ' "$events" "$raw")"
    fi
    ;;
  *) echo "unknown tool: $tool (use codex or grok)" >&2; exit 2 ;;
esac

if [ -z "$before" ] || [ -z "$after" ]; then
  echo "STOP: could not fingerprint $dir (is git or sha1sum missing?), so changes can't be ruled out." >&2
  exit 5
fi
if [ "$before" != "$after" ]; then
  echo "STOP: files in $dir changed while $tool was reviewing (exit $rc). Check git status before going on." >&2
  exit 5
fi
[ -z "$sid" ] && [ "$session" != "-" ] && sid="$session"
[ -n "$sid" ] && printf '%s' "$sid" > "$out.session"
if [ "$tool" = grok ] && grep -qi "not signed in" "$log"; then echo "grok not signed in (run: grok login)" >&2; exit 2; fi
[ $rc -eq 124 ] && { echo "$tool timed out after ${limit}s" >&2; exit 3; }
[ $rc -ne 0 ] && { echo "$tool failed (exit $rc); see $log" >&2; exit 4; }

if ! node "$here/extract-answer.js" "$raw" "$out" 2> "$out.parse-error"; then
  # The member did the review but its final message wasn't usable JSON (seen with Grok, 2026-11-06).
  # Ask once, in the same session, for just the corrected answer, rather than losing the seat.
  if [ -z "${COMMITTEE_RETRY:-}" ] && [ -n "$sid" ]; then
    fix="$out.fix-prompt.txt"
    { echo "Your last message could not be used as your committee answer ($(cat "$out.parse-error"))."
      echo "Reply now with ONLY the corrected JSON object in the required shape: no prose and no code"
      echo "fence. Don't redo the review."; } > "$fix"
    echo "$tool answer unusable; asking it once for the corrected JSON" >&2
    # Keep the first attempt's files: the retry writes to the same names.
    for f in "$raw" "$events" "$log"; do [ -f "$f" ] && cp "$f" "$f.first"; done
    COMMITTEE_RETRY=1 exec bash "$0" "$tool" "$fix" "$out" "$dir" "$sid"
  fi
  echo "$tool answer unusable ($(cat "$out.parse-error")); see $raw" >&2; exit 4
fi
echo "$tool ok -> $out (session ${sid:-none})" >&2
