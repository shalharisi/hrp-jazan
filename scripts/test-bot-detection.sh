#!/usr/bin/env bash
# Smoke-tests for the detect-bot-commit composite action.
#
# IMPORTANT: This script executes the REAL bash block extracted directly from
# .github/actions/detect-bot-commit/action.yml — it does NOT duplicate the
# logic.  Any change to the action (e.g. adding/removing a bot, altering the
# fallback) is automatically exercised here.
#
# Three scenarios must hold:
#   1. A known bot actor           → proceed=false
#   2. An unknown / human actor    → proceed=true
#   3. Invalid / missing SHA       → proceed=true  (fail-safe fallback)
#      GitHub Actions runs shell: bash with -eo pipefail by default, so a
#      failed `git log` exits the step non-zero; the action-level output
#      expression `steps.detect.outputs.proceed || 'true'` then returns 'true'.

set -euo pipefail

ACTION_YML=".github/actions/detect-bot-commit/action.yml"
PASS=0
FAIL=0

# ---------------------------------------------------------------------------
# Extract the actual run-block from the action.yml using Python.
# We locate the unique `run: |` line and capture every subsequent line that
# is indented deeper than it.  This ensures we test the REAL action script.
# ---------------------------------------------------------------------------
DETECT_SCRIPT=$(python3 - "$ACTION_YML" <<'PYEOF'
import sys, re

with open(sys.argv[1]) as f:
    lines = f.readlines()

in_run = False
script_indent = None
run_indent = None
out = []

for line in lines:
    if not in_run:
        m = re.match(r'^(\s+)run:\s*\|\s*$', line)
        if m:
            run_indent = len(m.group(1))
            in_run = True
        continue

    if not line.rstrip():
        out.append('')
        continue

    current_indent = len(line) - len(line.lstrip())

    if script_indent is None:
        script_indent = current_indent

    if current_indent <= run_indent:
        break

    out.append(line[script_indent:].rstrip())

print('\n'.join(out))
PYEOF
)

if [[ -z "$DETECT_SCRIPT" ]]; then
  echo "ERROR: Could not extract the run-block from $ACTION_YML" >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Runner: execute the extracted script with controlled env and capture the
# effective proceed value, including the action-level fallback.
#
# GitHub Actions `shell: bash` uses `--noprofile --norc -eo pipefail`, which
# means a failing `git log` causes the step to exit non-zero.  We replicate
# that here so the fail-safe fallback is exercised correctly.
# ---------------------------------------------------------------------------
run_detect() {
  local actor="${1:-}"
  local sha="${2:-}"

  local tmpout
  tmpout=$(mktemp)
  trap "rm -f '$tmpout'" RETURN

  local exit_code=0

  # Suppress the script's informational stdout — only GITHUB_OUTPUT matters.
  # Use -eo pipefail to match GitHub Actions runner defaults (shell: bash).
  ACTOR="$actor" \
  GITHUB_SHA="$sha" \
  GITHUB_OUTPUT="$tmpout" \
    bash --noprofile --norc -eo pipefail -c "$DETECT_SCRIPT" \
      > /dev/null 2>&1 \
    || exit_code=$?

  local raw_proceed
  raw_proceed=$(grep -m1 '^proceed=' "$tmpout" 2>/dev/null | cut -d= -f2 || true)

  # Replicate the composite-action output-level fallback:
  #   value: ${{ steps.detect.outputs.proceed || 'true' }}
  # Applies when the step fails (non-zero exit) or wrote nothing.
  if [[ "$exit_code" -ne 0 ]] || [[ -z "$raw_proceed" ]]; then
    echo "true"
  else
    echo "$raw_proceed"
  fi
}

# ---------------------------------------------------------------------------
# Assertion helper
# ---------------------------------------------------------------------------
assert_eq() {
  local description="$1"
  local expected="$2"
  local actual="$3"

  if [[ "$actual" == "$expected" ]]; then
    echo "  PASS  $description"
    PASS=$((PASS + 1))
  else
    echo "  FAIL  $description"
    echo "        expected='$expected'  got='$actual'"
    FAIL=$((FAIL + 1))
  fi
}

# ---------------------------------------------------------------------------
# Obtain a valid commit SHA from the local repo (needed for tests 1 & 2).
# ---------------------------------------------------------------------------
VALID_SHA=$(git rev-parse HEAD 2>/dev/null || true)
if [[ -z "$VALID_SHA" ]]; then
  echo "WARNING: Not inside a git repository; SHA-dependent tests will use fallback path." >&2
fi

# ---------------------------------------------------------------------------
# Test cases
# ---------------------------------------------------------------------------
echo ""
echo "=== detect-bot-commit action smoke tests ==="
echo "    (script extracted live from $ACTION_YML)"
echo ""

# 1. Known bot actors — each must be blocked (proceed=false).
for bot in "github-actions[bot]" "dependabot[bot]" "renovate[bot]"; do
  result=$(run_detect "$bot" "$VALID_SHA")
  assert_eq "Known bot '$bot' → proceed=false" "false" "$result"
done

# 2. Human / unknown actors — must be allowed through (proceed=true).
for human in "dr-sarah" "coordinator_ali" "unknown-actor"; do
  result=$(run_detect "$human" "$VALID_SHA")
  assert_eq "Human/unknown actor '$human' → proceed=true" "true" "$result"
done

# 3. Invalid / missing GITHUB_SHA — git log exits 128 under -eo pipefail,
#    causing the step to fail; the action output fallback returns 'true'.
result=$(run_detect "github-actions[bot]" "")
assert_eq "Empty SHA (bot actor) → proceed=true (fail-safe)" "true" "$result"

result=$(run_detect "human-user" "")
assert_eq "Empty SHA (human actor) → proceed=true (fail-safe)" "true" "$result"

result=$(run_detect "github-actions[bot]" "0000000000000000000000000000000000000000")
assert_eq "All-zero SHA (bot actor) → proceed=true (fail-safe)" "true" "$result"

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
echo "Results: $PASS passed, $FAIL failed."
echo ""

if [[ "$FAIL" -gt 0 ]]; then
  echo "ERROR: $FAIL test(s) failed — the bot-detection guard may be bypassed." >&2
  exit 1
fi

echo "All bot-detection smoke tests passed."
