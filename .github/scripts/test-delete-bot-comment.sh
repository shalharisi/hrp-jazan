#!/usr/bin/env bash
# test-delete-bot-comment.sh
#
# Unit test for the delete_bot_comment cleanup path defined in
# .github/scripts/codeowners-bot-helpers.sh (sourced by
# .github/workflows/suggest-codeowners-updates.yml).
#
# Strategy
# ────────
# 1. Place a fake `gh` binary earlier on PATH that:
#      • Logs every invocation to a temp file so we can count calls later.
#      • Returns a fake comment ID for the "list comments" call, simulating
#        a stale bot comment left from a previous workflow run.
#      • Exits 0 silently for DELETE calls.
# 2. Source the shared helpers file (same source used by the workflow) so
#    the test exercises the production function rather than a copy.
# 3. Call delete_bot_comment under two scenarios:
#      a. An existing bot comment is present → assert exactly one DELETE call
#         targeting the correct comment ID.
#      b. No existing bot comment → assert zero DELETE calls.

set -euo pipefail

PASS=0
FAIL=0

pass() { echo "PASS: $*"; (( PASS++ )) || true; }
fail() { echo "FAIL: $*"; (( FAIL++ )) || true; }

# ── Resolve script root so this test can be run from any working directory ────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HELPERS="$SCRIPT_DIR/codeowners-bot-helpers.sh"

if [[ ! -f "$HELPERS" ]]; then
  echo "ERROR: helpers file not found at $HELPERS" >&2
  exit 1
fi

# ── Temp directory ────────────────────────────────────────────────────────────
TMPDIR_TEST=$(mktemp -d)
trap 'rm -rf "$TMPDIR_TEST"' EXIT

CALL_LOG="$TMPDIR_TEST/gh_calls.log"
touch "$CALL_LOG"

FAKE_COMMENT_ID="99"

# ── Helper: write the "existing comment" stub ─────────────────────────────────
write_stub_with_comment() {
  cat > "$TMPDIR_TEST/gh" <<'STUB'
#!/usr/bin/env bash
echo "$*" >> "$CALL_LOG_PATH"

METHOD="GET"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --method) METHOD="$2"; shift 2 ;;
    *) shift ;;
  esac
done

if [[ "$METHOD" == "DELETE" ]]; then
  exit 0
fi

# Simulate gh api … --jq "…| .id" returning one matching comment ID
echo "$FAKE_COMMENT_ID_VALUE"
STUB
  chmod +x "$TMPDIR_TEST/gh"
}

# ── Helper: write the "no comment" stub ──────────────────────────────────────
write_stub_no_comment() {
  cat > "$TMPDIR_TEST/gh" <<'STUB'
#!/usr/bin/env bash
echo "$*" >> "$CALL_LOG_PATH"

METHOD="GET"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --method) METHOD="$2"; shift 2 ;;
    *) shift ;;
  esac
done

if [[ "$METHOD" == "DELETE" ]]; then
  exit 0
fi

# Simulate no matching comment → output nothing (empty string)
echo ""
STUB
  chmod +x "$TMPDIR_TEST/gh"
}

export PATH="$TMPDIR_TEST:$PATH"
export CALL_LOG_PATH="$CALL_LOG"
export FAKE_COMMENT_ID_VALUE="$FAKE_COMMENT_ID"

# ── Variables expected by delete_bot_comment (mirrors the workflow env) ───────
MARKER="<!-- codeowners-rename-bot -->"
REPO="test-org/test-repo"
PR_NUMBER=7

# ── Load the production helper — same source as the workflow ──────────────────
# shellcheck source=.github/scripts/codeowners-bot-helpers.sh
source "$HELPERS"

# ═══════════════════════════════════════════════════════════════════════════════
# Test 1 — existing bot comment is deleted exactly once
# ═══════════════════════════════════════════════════════════════════════════════
echo ""
echo "Test 1: existing bot comment is deleted exactly once"
echo "──────────────────────────────────────────────────────"

write_stub_with_comment
truncate -s 0 "$CALL_LOG"

delete_bot_comment

echo ""
echo "Recorded gh calls:"
cat "$CALL_LOG"
echo ""

delete_count=$(grep -c -- "--method DELETE" "$CALL_LOG" || true)
if [[ "$delete_count" -eq 1 ]]; then
  pass "DELETE was called exactly once (got ${delete_count})"
else
  fail "Expected exactly 1 DELETE call, got ${delete_count}"
fi

if grep -q "issues/comments/${FAKE_COMMENT_ID}" "$CALL_LOG"; then
  pass "DELETE targeted the correct comment ID (${FAKE_COMMENT_ID})"
else
  fail "DELETE did not reference comment ID ${FAKE_COMMENT_ID}"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# Test 2 — no bot comment present → no DELETE call is made
# ═══════════════════════════════════════════════════════════════════════════════
echo ""
echo "Test 2: no existing bot comment → no DELETE call"
echo "──────────────────────────────────────────────────"

write_stub_no_comment
truncate -s 0 "$CALL_LOG"

delete_bot_comment

delete_count_none=$(grep -c -- "--method DELETE" "$CALL_LOG" || true)
if [[ "$delete_count_none" -eq 0 ]]; then
  pass "No DELETE call was made when no existing comment is present"
else
  fail "Expected 0 DELETE calls, got ${delete_count_none}"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# Summary
# ═══════════════════════════════════════════════════════════════════════════════
echo ""
echo "══════════════════════════════════════"
echo "Results: ${PASS} passed, ${FAIL} failed"
echo "══════════════════════════════════════"

if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
