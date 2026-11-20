#!/usr/bin/env bash
# Reports whether the committee's tools are ready. One line per tool, for the chair to read.
#
#   preflight.sh
#
#   node:  ready | missing | too old (needs 18 or newer)
#   codex: ready | missing | signed out   version <v>   verified: yes | no
#   grok:  ready | missing | signed out   version <v>   verified: yes | no
#
# "verified: yes" means self-test.sh passed for exactly this installed version, with the lock-down
# scripts unchanged since (a changed run-member.sh or trust check needs a fresh self-test too).
set -u
verified="$HOME/.claude/committee-verified-versions.txt"
here="$(cd "$(dirname "$0")" && pwd)"
hash="$(bash "$here/scripts-hash.sh")"
if ! command -v node >/dev/null; then echo "node:  missing"
elif node -e 'process.exit(+process.versions.node.split(".")[0] >= 18 ? 0 : 1)'; then echo "node:  ready"
else echo "node:  too old (needs 18 or newer; this is $(node --version))"; fi

check() { # tool, signed-in test command
  local t="$1" v status ver="no"
  if ! command -v "$t" >/dev/null; then echo "$t: missing"; return; fi
  v="$("$t" --version 2>/dev/null | head -1)"
  if eval "$2" >/dev/null 2>&1; then status="ready"; else status="signed out"; fi
  [ -n "$hash" ] && grep -qxF "$t $v $hash" "$verified" 2>/dev/null && ver="yes"
  echo "$t: $status   version $v   verified: $ver"
}
check codex 'codex login status'
# Signed in, grok models prints "You are logged in with grok.com." (seen 2026-11-06).
check grok 'grok models 2>&1 | grep -q "You are logged in"'
