#!/usr/bin/env bash
# Prints one fingerprint of a folder's contents. Run it before and after a member works: if the two
# differ, something changed.
#
#   repo-state.sh <folder>
#
# In a git repo it covers HEAD, every branch and tag, the stash, the index, the contents of every
# tracked change and the contents of every untracked (not ignored) file. Outside git it covers every
# file under the folder. Not covered: gitignored files (node_modules, .env, build output) and
# anything outside the folder.
set -u
dir="${1:?folder}"
if git -C "$dir" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  {
    git -C "$dir" rev-parse HEAD 2>/dev/null
    git -C "$dir" for-each-ref
    git -C "$dir" stash list
    git -C "$dir" status --porcelain=v1 -uall
    git -C "$dir" diff --binary
    git -C "$dir" diff --cached --binary
    (cd "$dir" && git ls-files -z --others --exclude-standard | xargs -0 -r sha1sum)
  } 2>&1 | sha1sum | cut -d' ' -f1
else
  (cd "$dir" && find . -type f -print0 | sort -z | xargs -0 -r sha1sum) 2>&1 | sha1sum | cut -d' ' -f1
fi
