#!/usr/bin/env bash
# For a resubmission of a code change: writes <material>/changes.patch, showing what changed since
# the review recorded in <record>. Run prepare-code-material.sh for the current version first.
#
#   build-changes.sh <record-folder> <material> <repo> <recorded-commit>
#
# For every file in either version: the copy kept with the record against the file as it is now
# (or against nothing, if it has since been deleted); a file that wasn't part of the earlier change
# is shown against the recorded commit, or in full if it is new. Commits made since are listed.
set -u
rec="${1:?record folder}"; mat="${2:?material}"; repo="${3:?repo}"; commit="${4:?recorded commit}"
[ -d "$rec" ] || { echo "no such record folder: $rec" >&2; exit 2; }
git -C "$repo" rev-parse --verify -q "$commit^{commit}" >/dev/null || { echo "no such commit: $commit" >&2; exit 2; }
old="$rec/material/files"
out="$mat/changes.patch"
# Compare copies in a scratch folder, so headers read a/<path> and b/<path> rather than naming the
# record's folder, which members are told not to open.
scratch="$(mktemp -d)"; trap 'rm -rf "$scratch"' EXIT
compare() { # <earlier file or /dev/null> <current file or /dev/null> <path>
  local a=/dev/null b=/dev/null
  [ "$1" != /dev/null ] && { mkdir -p "$scratch/a/$(dirname "$3")"; cp "$1" "$scratch/a/$3"; a="a/$3"; }
  [ "$2" != /dev/null ] && { mkdir -p "$scratch/b/$(dirname "$3")"; cp "$2" "$scratch/b/$3"; b="b/$3"; }
  # Run from inside a/ or b/ when one side is missing, so the header reads a/<path> b/<path>.
  if [ "$a" = /dev/null ]; then (cd "$scratch/b" && git diff --no-index --src-prefix=a/ --dst-prefix=b/ -- /dev/null "$3")
  elif [ "$b" = /dev/null ]; then (cd "$scratch/a" && git diff --no-index --src-prefix=a/ --dst-prefix=b/ -- "$3" /dev/null)
  else (cd "$scratch" && git diff --no-index --no-prefix -- "$a" "$b"); fi
}
{
  echo "# Changes since the review recorded in $(basename "$rec") (commit ${commit:0:7})"
  if [ ! -d "$old" ]; then
    echo "# That record kept no file copies (it was over the 5 MB limit), so new files can only be"
    echo "# reviewed as they are now. Tracked files against the recorded commit:"
    git -C "$repo" diff "$commit" -- . ':(exclude).committee'
  else
    { (cd "$old" && find . -type f | sed 's|^\./||'); cat "$mat/changed.txt"
      # Every tracked path that differs between the recorded commit and the working tree: commits
      # made since, uncommitted edits, deletions (committed or not) and changes later reverted.
      git -C "$repo" diff --name-only --no-renames "$commit" -- . ':(exclude).committee'; } | sort -u |
    while IFS= read -r f; do
      if [ -f "$old/$f" ] && [ -f "$repo/$f" ]; then
        compare "$old/$f" "$repo/$f" "$f"
      elif [ -f "$old/$f" ]; then
        echo "# $f has been deleted since the last review"
        compare "$old/$f" /dev/null "$f"
      elif git -C "$repo" cat-file -e "$commit:$f" 2>/dev/null; then
        git -C "$repo" diff "$commit" -- "$f"
      else
        compare /dev/null "$repo/$f" "$f"
      fi
    done
  fi
  if [ "$(git -C "$repo" rev-parse HEAD)" != "$(git -C "$repo" rev-parse "$commit")" ]; then
    echo; echo "# Commits since the last review:"; git -C "$repo" log --oneline "$commit..HEAD"
  fi
} > "$out" 2> >(grep -v "LF will be replaced by CRLF" >&2)
echo "$(grep -c '^diff --git' "$out") files differ since the last review -> $out"
