#!/usr/bin/env bash
# Regression test for the per-tool verified record (~/.claude/committee-verified-versions.txt) that
# self-test.sh writes and preflight.sh reads. It runs preflight.sh against stand-in codex and grok
# commands and a throwaway home folder, so it needs no sign-in and touches nothing real.
#
#   test-verified-record.sh
#
# Prints one line, and exits 1 if any case fails. self-test.sh runs it.
set -u
here="$(cd "$(dirname "$0")" && pwd)"
work="$(mktemp -d)"; trap 'rm -rf "$work"' EXIT
mkdir -p "$work/bin" "$work/home/.claude"
# Stand-ins: signed in, with fixed versions.
printf '#!/usr/bin/env bash\ncase "$1" in --version) echo "codex-cli 9.9.9";; login) exit 0;; esac\n' > "$work/bin/codex"
printf '#!/usr/bin/env bash\ncase "$1" in --version) echo "grok 9.9.9";; models) echo "You are logged in with grok.com.";; esac\n' > "$work/bin/grok"
chmod +x "$work/bin/codex" "$work/bin/grok"
hash="$(bash "$here/scripts-hash.sh")"
rec="$work/home/.claude/committee-verified-versions.txt"
bad=0; n=0
check() { # <name> <record contents or -> <expected codex yes/no> <expected grok yes/no>
  n=$((n + 1))
  if [ "$2" = - ]; then rm -f "$rec"; else printf '%b' "$2" > "$rec"; fi
  out="$(HOME="$work/home" PATH="$work/bin:$PATH" bash "$here/preflight.sh")"
  c="$(echo "$out" | grep '^codex:' | grep -o 'verified: [a-z]*' | cut -d' ' -f2)"
  g="$(echo "$out" | grep '^grok:' | grep -o 'verified: [a-z]*' | cut -d' ' -f2)"
  if [ "$c" != "$3" ] || [ "$g" != "$4" ]; then
    bad=$((bad + 1)); echo "  verified-record case failed: $1 (codex $c, grok $g; expected $3, $4)"
  fi
}
check 'no record'                              -                                                   no  no
check 'both tools passed with these scripts'   "codex codex-cli 9.9.9 $hash\ngrok grok 9.9.9 $hash\n" yes yes
check 'only codex passed with these scripts'   "codex codex-cli 9.9.9 $hash\n"                     yes no
check 'grok passed with older scripts'         "codex codex-cli 9.9.9 $hash\ngrok grok 9.9.9 0ld\n" yes no
check 'grok passed on an older version'        "codex codex-cli 9.9.9 $hash\ngrok grok 9.9.8 $hash\n" yes no
check 'old format, no fingerprint'             "codex codex-cli 9.9.9\ngrok grok 9.9.9\nscripts $hash\n" no no
check 'a fingerprint for the wrong tool'       "codex grok 9.9.9 $hash\n"                          no  no
[ "$bad" -eq 0 ] && echo "verified record: all $n cases pass" || echo "verified record: $bad of $n cases failed"
exit $((bad > 0))
