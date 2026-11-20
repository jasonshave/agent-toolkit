#!/usr/bin/env bash
# Saves a code subject into the material folder, leaving .committee/ out:
#   diff.patch    the change, as a diff (empty for a folder review)
#   changed.txt   the files under review (deleted files show only in diff.patch)
#   files/<path>  a copy of each of those files
#
#   prepare-code-material.sh <repo> <material> [<subject>]
#
# <subject>:
#   (nothing)               the uncommitted changes, new untracked files included; copies as they are now
#   <base>...HEAD           a branch, e.g. master...HEAD (committed changes only); copies as they are now
#   commit:<sha>            one commit; copies as they were in that commit
#   path:<folder>           a folder as it is now (tracked and untracked, not ignored); no diff
# Prints a one-line summary. Exits 1, after saving, if it's over 200 files or 2 MB: ask the user to
# narrow the subject. Exits 2 if git fails (bad commit, not a repo).
set -u
repo="${1:?repo}"; mat="${2:?material folder}"; subject="${3:-HEAD}"
git -C "$repo" rev-parse --is-inside-work-tree >/dev/null 2>&1 || { echo "not a git repo: $repo" >&2; exit 2; }
mkdir -p "$mat"; rm -rf "$mat/files"
only=(-- . ':(exclude).committee')
from=""   # empty: copy from the working tree; otherwise a commit to copy from
case "$subject" in
  path:*)
    dir="${subject#path:}"
    [ -e "$repo/$dir" ] || { echo "no such folder in the repo: $dir" >&2; exit 2; }
    : > "$mat/diff.patch"
    { git -C "$repo" ls-files -- "$dir" ':(exclude).committee'
      git -C "$repo" ls-files --others --exclude-standard -- "$dir" ':(exclude).committee'; } | sort -u > "$mat/changed.txt" || exit 2
    ;;
  commit:*)
    from="${subject#commit:}"
    git -C "$repo" rev-parse --verify -q "$from^{commit}" >/dev/null || { echo "no such commit: $from" >&2; exit 2; }
    git -C "$repo" show --binary --format='commit %H%n%an  %ad%n%n%s%n%n%b' "$from" "${only[@]}" > "$mat/diff.patch" || exit 2
    git -C "$repo" show --name-only --diff-filter=d --format= "$from" "${only[@]}" | sed '/^$/d' | sort -u > "$mat/changed.txt"
    ;;
  *)
    git -C "$repo" diff --binary "$subject" "${only[@]}" > "$mat/diff.patch" || exit 2
    { git -C "$repo" diff --name-only --diff-filter=d "$subject" "${only[@]}"
      [ "$subject" = HEAD ] && git -C "$repo" ls-files --others --exclude-standard "${only[@]}"; } | sort -u > "$mat/changed.txt"
    ;;
esac
while IFS= read -r f; do
  [ -n "$f" ] || continue
  mkdir -p "$mat/files/$(dirname "$f")"
  if [ -n "$from" ]; then git -C "$repo" show "$from:$f" > "$mat/files/$f"
  elif [ -f "$repo/$f" ]; then cp "$repo/$f" "$mat/files/$f"; fi
done < "$mat/changed.txt"
count=$(grep -c . "$mat/changed.txt")
kb=$( [ -d "$mat/files" ] && du -sk "$mat/files" | cut -f1 || echo 0)
echo "$count files under review, ${kb} KB of copies ($subject)"
if [ "$count" -gt 200 ] || [ "$kb" -gt 2048 ]; then echo "too big for one review: narrow the subject" >&2; exit 1; fi
exit 0
