#!/usr/bin/env bash
# Looks for things that look like secrets in the material before it goes to OpenAI and xAI.
#
#   check-secrets.sh <folder or file>      (the material folder, or a dossier or answer file)
#
# Prints each match as file:line with the likely secret masked. Exit 0 = nothing found,
# 1 = something found (show the user and ask), 2 = usage error.
# It's a quick pattern check, not a guarantee: it knows common key formats and "password = '...'"
# style assignments only.
set -u
dir="${1:?material folder}"
[ -e "$dir" ] || { echo "no such file or folder: $dir" >&2; exit 2; }
pattern='(AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY|AccountKey=[^;" ]{20,}|SharedAccess[S]ignature=sv=|sig=[A-Za-z0-9%]{30,}|xox[abprs]-[A-Za-z0-9-]{10,}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|sk-[A-Za-z0-9_-]{20,}|xai-[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{35}|(password|passwd|pwd|secret|token|api[_-]?key|client[_-]?secret)["'"'"' ]*[:=] *["'"'"'][^"'"'"' ]{8,}["'"'"'])'
hits="$(grep -rInIE "$pattern" "$dir" 2>/dev/null)"
[ -z "$hits" ] && { echo "no likely secrets found"; exit 0; }
# Mask: keep the first 4 characters of each match.
printf '%s\n' "$hits" | sed -E "s/$pattern/<\1>/g" | sed -E 's/<(.{4})[^>]*>/\1********/g'
exit 1
