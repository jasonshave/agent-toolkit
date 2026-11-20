#!/usr/bin/env bash
# Prints one fingerprint of the scripts that lock committee members down. self-test.sh records it
# when it passes; preflight.sh compares it, so editing any of these needs a fresh self-test.
here="$(cd "$(dirname "$0")" && pwd)"
cat "$here/run-member.sh" "$here/grok-trust-check.js" "$here/repo-state.sh" "$here/extract-answer.js" \
  "$here/member-response.schema.json" "$here/preflight.sh" "$here/self-test.sh" | tr -d '\r' | sha1sum | cut -d' ' -f1
