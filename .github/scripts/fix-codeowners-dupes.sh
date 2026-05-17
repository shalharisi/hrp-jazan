#!/usr/bin/env bash
# fix-codeowners-dupes.sh — Remove duplicate owner tokens from each CODEOWNERS rule.
#
# Usage:
#   .github/scripts/fix-codeowners-dupes.sh [--check] [<path-to-CODEOWNERS>]
#
# Options:
#   --check   Dry-run mode: exit non-zero if any line would be rewritten, but
#             do NOT modify the file.  Mirrors what the CI duplicate-detection
#             step does, so you can run it locally before pushing.
#
# Arguments:
#   <path>    Path to the CODEOWNERS file (default: .github/CODEOWNERS)
#
# Behaviour:
#   - Comment lines (starting with optional whitespace then #) are left unchanged.
#   - Blank / whitespace-only lines are left unchanged.
#   - Rule lines: the path pattern (first token) is preserved exactly; duplicate
#     owner tokens are removed, keeping the first occurrence and preserving order.
#   - The fix is idempotent: running it twice produces the same output.
#
# Exit codes:
#   0  No changes needed (or changes were applied successfully).
#   1  --check mode: one or more lines would be rewritten.
#   2  Usage / IO error.

set -euo pipefail

# ── argument parsing ──────────────────────────────────────────────────────────
CHECK_MODE=false
CODEOWNERS=".github/CODEOWNERS"

for arg in "$@"; do
  case "$arg" in
    --check)
      CHECK_MODE=true
      ;;
    -*)
      echo "ERROR: Unknown option '$arg'" >&2
      echo "Usage: $0 [--check] [<path-to-CODEOWNERS>]" >&2
      exit 2
      ;;
    *)
      CODEOWNERS="$arg"
      ;;
  esac
done

if [[ ! -f "$CODEOWNERS" ]]; then
  echo "ERROR: CODEOWNERS file not found: $CODEOWNERS" >&2
  exit 2
fi

# ── processing ────────────────────────────────────────────────────────────────
needs_fix=false
output_lines=()

lineno=0
while IFS= read -r line || [[ -n "$line" ]]; do
  lineno=$((lineno + 1))

  # Preserve comment lines verbatim
  if [[ "$line" =~ ^[[:space:]]*# ]]; then
    output_lines+=("$line")
    continue
  fi

  # Preserve blank / whitespace-only lines verbatim
  if [[ -z "${line//[[:space:]]/}" ]]; then
    output_lines+=("$line")
    continue
  fi

  # Tokenise: fields[0] = path pattern, fields[1+] = owner tokens
  read -r -a fields <<< "$line"

  # Lines with 0 or 1 owner token cannot have duplicates
  if [[ ${#fields[@]} -lt 3 ]]; then
    output_lines+=("$line")
    continue
  fi

  # Build a deduplicated owner list (first-seen order)
  declare -A seen_owners
  dedup_owners=()
  for (( i=1; i<${#fields[@]}; i++ )); do
    tok="${fields[$i]}"
    if [[ -z "${seen_owners[$tok]+_}" ]]; then
      seen_owners[$tok]=1
      dedup_owners+=("$tok")
    fi
  done
  unset seen_owners

  if [[ ${#dedup_owners[@]} -lt $(( ${#fields[@]} - 1 )) ]]; then
    # There were duplicates on this line
    needs_fix=true
    fixed_line="${fields[0]} ${dedup_owners[*]}"
    output_lines+=("$fixed_line")

    if $CHECK_MODE; then
      echo "Line $lineno would be rewritten:"
      echo "  before: $line"
      echo "  after:  $fixed_line"
    else
      echo "Fixed line $lineno: removed duplicate owner(s) from '${fields[0]}'"
      echo "  before: $line"
      echo "  after:  $fixed_line"
    fi
  else
    output_lines+=("$line")
  fi

done < "$CODEOWNERS"

# ── output ────────────────────────────────────────────────────────────────────
if ! $needs_fix; then
  echo "No duplicate owners found in $CODEOWNERS — nothing to do."
  exit 0
fi

if $CHECK_MODE; then
  echo ""
  echo "ERROR: $CODEOWNERS has duplicate owner tokens on one or more rule lines."
  echo "Run the following command to fix it automatically:"
  echo "  .github/scripts/fix-codeowners-dupes.sh"
  exit 1
fi

# Write fixed content back to the file (atomic via temp file)
tmp="$(mktemp)"
for out_line in "${output_lines[@]}"; do
  printf '%s\n' "$out_line"
done > "$tmp"

mv "$tmp" "$CODEOWNERS"
echo ""
echo "Done. $CODEOWNERS has been rewritten with duplicates removed."
