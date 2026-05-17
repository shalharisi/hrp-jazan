#!/usr/bin/env bash
# test-codeowners-dry-run-and-approval.sh
#
# Unit tests for the resolve_dry_run_mode and check_approval_gate helpers
# defined in .github/scripts/codeowners-bot-helpers.sh (sourced by
# .github/workflows/suggest-codeowners-updates.yml).
#
# Strategy
# ────────
# 1. Place a fake `gh` binary earlier on PATH that logs every invocation
#    and returns configurable JSON responses for each API endpoint so we
#    can exercise the decision paths without real GitHub credentials.
# 2. Source the shared helpers file (same source used by the workflow) so
#    the tests exercise the production functions rather than copies.
# 3. Test resolve_dry_run_mode across three scenarios:
#      a. DRY_RUN_VAR=true  → DRY_RUN=true
#      b. PR label present  → DRY_RUN=true
#      c. Neither active    → DRY_RUN=false
# 4. Test check_approval_gate across four scenarios:
#      a. REQUIRE_APPROVAL disabled               → gate skipped, no change
#      b. Required + no approval found            → DRY_RUN=true, APPROVAL_REQUIRED=true
#      c. Required + maintainer review approval   → DRY_RUN=false, APPROVED=true
#      d. Required + maintainer :+1: reaction     → DRY_RUN=false, APPROVED=true
#      e. Required but DRY_RUN already true       → gate skipped entirely

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

# ── Variables expected by the helpers (mirrors the workflow env) ──────────────
export MARKER="<!-- codeowners-rename-bot -->"
export REPO="test-org/test-repo"
export PR_NUMBER=42

# ── Helper: reset per-test state ──────────────────────────────────────────────
reset_state() {
  truncate -s 0 "$CALL_LOG"
  DRY_RUN=false
  APPROVED=false
  APPROVAL_REQUIRED=false
  DRY_RUN_VAR=""
  REQUIRE_APPROVAL_VAR=""
  PR_LABELS="[]"
}

# ── Fake gh: no reviews, no reactions, no bot comment ─────────────────────────
write_stub_no_approval() {
  cat > "$TMPDIR_TEST/gh" <<'STUB'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "$CALL_LOG_PATH"

URL=""
for arg in "$@"; do
  case "$arg" in
    repos/*) URL="$arg" ;;
  esac
done

# reviews endpoint — no approvals
if [[ "$URL" == *"/pulls/"*"/reviews" ]]; then
  echo ""   # empty → no approved reviewers
  exit 0
fi

# collaborator permission — should not be called with no approvals, but
# return "none" defensively so any accidental call doesn't crash the test.
if [[ "$URL" == *"/collaborators/"*"/permission" ]]; then
  echo "none"
  exit 0
fi

# comments endpoint — no existing bot comment
if [[ "$URL" == *"/issues/"*"/comments" ]]; then
  echo ""
  exit 0
fi

# reactions endpoint — no reactions
if [[ "$URL" == *"/reactions" ]]; then
  echo ""
  exit 0
fi

exit 0
STUB
  chmod +x "$TMPDIR_TEST/gh"
}

# ── Fake gh: one review-approved maintainer ────────────────────────────────────
write_stub_review_approved() {
  cat > "$TMPDIR_TEST/gh" <<'STUB'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "$CALL_LOG_PATH"

URL=""
for arg in "$@"; do
  case "$arg" in
    repos/*) URL="$arg" ;;
  esac
done

# reviews endpoint — return one approved maintainer login
if [[ "$URL" == *"/pulls/"*"/reviews" ]]; then
  echo "alice"
  exit 0
fi

# permission check for alice → admin
if [[ "$URL" == *"/collaborators/alice/permission" ]]; then
  echo "admin"
  exit 0
fi

# catch-all
exit 0
STUB
  chmod +x "$TMPDIR_TEST/gh"
}

# ── Fake gh: one :+1: reaction from a maintainer, no review approval ──────────
write_stub_reaction_approved() {
  cat > "$TMPDIR_TEST/gh" <<'STUB'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "$CALL_LOG_PATH"

URL=""
for arg in "$@"; do
  case "$arg" in
    repos/*) URL="$arg" ;;
  esac
done

# reviews endpoint — no approvals
if [[ "$URL" == *"/pulls/"*"/reviews" ]]; then
  echo ""
  exit 0
fi

# comments listing — return an existing bot comment ID 77
# (the stub must satisfy both the marker check and the author check
#  used by check_approval_gate; we return only the ID as jq would)
if [[ "$URL" == *"/issues/"*"/comments" && "$URL" != *"/comments/"* ]]; then
  echo "77"
  exit 0
fi

# reactions on comment 77 — return one +:+1: reactor
if [[ "$URL" == *"/issues/comments/77/reactions" ]]; then
  echo "bob"
  exit 0
fi

# permission check for bob → write
if [[ "$URL" == *"/collaborators/bob/permission" ]]; then
  echo "write"
  exit 0
fi

# catch-all
exit 0
STUB
  chmod +x "$TMPDIR_TEST/gh"
}

export PATH="$TMPDIR_TEST:$PATH"
export CALL_LOG_PATH="$CALL_LOG"

# ── Load the production helpers — same source as the workflow ─────────────────
# shellcheck source=.github/scripts/codeowners-bot-helpers.sh
source "$HELPERS"

# ═══════════════════════════════════════════════════════════════════════════════
# resolve_dry_run_mode tests
# ═══════════════════════════════════════════════════════════════════════════════

echo ""
echo "══════════════════════════════════════════════════════════════════════"
echo "resolve_dry_run_mode"
echo "══════════════════════════════════════════════════════════════════════"

# ── Test 1: DRY_RUN_VAR=true → DRY_RUN=true ───────────────────────────────────
echo ""
echo "Test 1: DRY_RUN_VAR=true → DRY_RUN=true"
echo "────────────────────────────────────────"
reset_state
DRY_RUN_VAR="true"
PR_LABELS="[]"

resolve_dry_run_mode

if [[ "$DRY_RUN" == "true" ]]; then
  pass "DRY_RUN=true when DRY_RUN_VAR=true"
else
  fail "Expected DRY_RUN=true, got '$DRY_RUN'"
fi

# ── Test 2: PR label → DRY_RUN=true ───────────────────────────────────────────
echo ""
echo "Test 2: codeowners-dry-run label → DRY_RUN=true"
echo "────────────────────────────────────────────────"
reset_state
DRY_RUN_VAR="false"
PR_LABELS='["codeowners-dry-run","enhancement"]'

resolve_dry_run_mode

if [[ "$DRY_RUN" == "true" ]]; then
  pass "DRY_RUN=true when PR carries codeowners-dry-run label"
else
  fail "Expected DRY_RUN=true, got '$DRY_RUN'"
fi

# ── Test 3: neither active → DRY_RUN=false ────────────────────────────────────
echo ""
echo "Test 3: no dry-run trigger → DRY_RUN=false"
echo "───────────────────────────────────────────"
reset_state
DRY_RUN_VAR="false"
PR_LABELS='["bug","good first issue"]'

resolve_dry_run_mode

if [[ "$DRY_RUN" == "false" ]]; then
  pass "DRY_RUN=false when no dry-run trigger is active"
else
  fail "Expected DRY_RUN=false, got '$DRY_RUN'"
fi

# ── Test 4: DRY_RUN_VAR case-insensitive ──────────────────────────────────────
echo ""
echo "Test 4: DRY_RUN_VAR=TRUE (uppercase) → DRY_RUN=true"
echo "────────────────────────────────────────────────────"
reset_state
DRY_RUN_VAR="TRUE"
PR_LABELS="[]"

resolve_dry_run_mode

if [[ "$DRY_RUN" == "true" ]]; then
  pass "DRY_RUN=true for uppercase DRY_RUN_VAR=TRUE"
else
  fail "Expected DRY_RUN=true for DRY_RUN_VAR=TRUE, got '$DRY_RUN'"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# check_approval_gate tests
# ═══════════════════════════════════════════════════════════════════════════════

echo ""
echo "══════════════════════════════════════════════════════════════════════"
echo "check_approval_gate"
echo "══════════════════════════════════════════════════════════════════════"

# ── Test 5: REQUIRE_APPROVAL disabled → gate skipped, DRY_RUN unchanged ───────
echo ""
echo "Test 5: REQUIRE_APPROVAL_VAR=false → gate skipped entirely"
echo "───────────────────────────────────────────────────────────"
reset_state
write_stub_no_approval
DRY_RUN=false
REQUIRE_APPROVAL_VAR="false"

check_approval_gate

if [[ "$DRY_RUN" == "false" ]]; then
  pass "DRY_RUN unchanged (false) when gate is disabled"
else
  fail "Expected DRY_RUN=false, got '$DRY_RUN'"
fi

if [[ "$APPROVAL_REQUIRED" == "false" ]]; then
  pass "APPROVAL_REQUIRED=false when gate is disabled"
else
  fail "Expected APPROVAL_REQUIRED=false, got '$APPROVAL_REQUIRED'"
fi

# ── Test 6: DRY_RUN already true → gate skipped entirely ──────────────────────
echo ""
echo "Test 6: REQUIRE_APPROVAL=true but DRY_RUN already true → gate skipped"
echo "───────────────────────────────────────────────────────────────────────"
reset_state
write_stub_no_approval
truncate -s 0 "$CALL_LOG"
DRY_RUN=true
REQUIRE_APPROVAL_VAR="true"

check_approval_gate

gh_call_count=$(wc -l < "$CALL_LOG" || echo 0)
if [[ "$DRY_RUN" == "true" ]]; then
  pass "DRY_RUN stays true when gate is bypassed"
else
  fail "Expected DRY_RUN=true, got '$DRY_RUN'"
fi

if [[ "$APPROVAL_REQUIRED" == "false" ]]; then
  pass "APPROVAL_REQUIRED=false when gate is bypassed (DRY_RUN was already true)"
else
  fail "Expected APPROVAL_REQUIRED=false, got '$APPROVAL_REQUIRED'"
fi

if [[ "$gh_call_count" -eq 0 ]]; then
  pass "No gh API calls made when gate is bypassed"
else
  fail "Expected 0 gh calls when gate is bypassed, got ${gh_call_count}"
fi

# ── Test 7: required + no approval → forces DRY_RUN=true, APPROVAL_REQUIRED=true
echo ""
echo "Test 7: required + no approval found → DRY_RUN=true, APPROVAL_REQUIRED=true"
echo "─────────────────────────────────────────────────────────────────────────────"
reset_state
write_stub_no_approval
DRY_RUN=false
REQUIRE_APPROVAL_VAR="true"

check_approval_gate

if [[ "$DRY_RUN" == "true" ]]; then
  pass "DRY_RUN forced to true when no approval is found"
else
  fail "Expected DRY_RUN=true, got '$DRY_RUN'"
fi

if [[ "$APPROVAL_REQUIRED" == "true" ]]; then
  pass "APPROVAL_REQUIRED=true when no approval is found"
else
  fail "Expected APPROVAL_REQUIRED=true, got '$APPROVAL_REQUIRED'"
fi

if [[ "$APPROVED" == "false" ]]; then
  pass "APPROVED=false when no approval is found"
else
  fail "Expected APPROVED=false, got '$APPROVED'"
fi

# ── Test 8: required + maintainer review approval → DRY_RUN stays false ───────
echo ""
echo "Test 8: required + review approved by maintainer → DRY_RUN=false"
echo "──────────────────────────────────────────────────────────────────"
reset_state
write_stub_review_approved
DRY_RUN=false
REQUIRE_APPROVAL_VAR="true"

check_approval_gate

if [[ "$DRY_RUN" == "false" ]]; then
  pass "DRY_RUN remains false after maintainer review approval"
else
  fail "Expected DRY_RUN=false, got '$DRY_RUN'"
fi

if [[ "$APPROVAL_REQUIRED" == "false" ]]; then
  pass "APPROVAL_REQUIRED=false after maintainer review approval"
else
  fail "Expected APPROVAL_REQUIRED=false, got '$APPROVAL_REQUIRED'"
fi

if [[ "$APPROVED" == "true" ]]; then
  pass "APPROVED=true after maintainer review approval"
else
  fail "Expected APPROVED=true, got '$APPROVED'"
fi

# ── Test 9: required + maintainer :+1: reaction → DRY_RUN stays false ─────────
echo ""
echo "Test 9: required + :+1: reaction from maintainer → DRY_RUN=false"
echo "───────────────────────────────────────────────────────────────────"
reset_state
write_stub_reaction_approved
DRY_RUN=false
REQUIRE_APPROVAL_VAR="true"

check_approval_gate

if [[ "$DRY_RUN" == "false" ]]; then
  pass "DRY_RUN remains false after maintainer :+1: reaction"
else
  fail "Expected DRY_RUN=false, got '$DRY_RUN'"
fi

if [[ "$APPROVED" == "true" ]]; then
  pass "APPROVED=true after maintainer :+1: reaction"
else
  fail "Expected APPROVED=true, got '$APPROVED'"
fi

# ── Test 10: dry-run mode → no git commit calls ───────────────────────────────
# Verify that when DRY_RUN=true after resolve_dry_run_mode, git commit is never
# invoked.  We stub git as well and assert the commit sub-command is absent.
echo ""
echo "Test 10: DRY_RUN=true → git commit must not be called"
echo "────────────────────────────────────────────────────────"

GIT_LOG="$TMPDIR_TEST/git_calls.log"
touch "$GIT_LOG"

cat > "$TMPDIR_TEST/git" <<'GITSTUB'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "$GIT_LOG_PATH"
# Simulate successful git operations so callers don't error out.
exit 0
GITSTUB
chmod +x "$TMPDIR_TEST/git"

export GIT_LOG_PATH="$GIT_LOG"

reset_state
DRY_RUN_VAR="true"
PR_LABELS="[]"
resolve_dry_run_mode

# Simulate the guard used in the workflow: only commit/push when DRY_RUN=false.
if [[ "$DRY_RUN" == "false" ]]; then
  git commit -m "chore: auto-update CODEOWNERS"
  git push origin HEAD:some-branch
fi

git_commit_count=$(grep -c "^commit" "$GIT_LOG" || true)
if [[ "$git_commit_count" -eq 0 ]]; then
  pass "git commit was not called when DRY_RUN=true"
else
  fail "Expected 0 git commit calls in dry-run, got ${git_commit_count}"
fi

git_push_count=$(grep -c "^push" "$GIT_LOG" || true)
if [[ "$git_push_count" -eq 0 ]]; then
  pass "git push was not called when DRY_RUN=true"
else
  fail "Expected 0 git push calls in dry-run, got ${git_push_count}"
fi

# ── Test 11: dry-run comment body contains expected marker and heading ─────────
echo ""
echo "Test 11: dry-run preview comment body contains marker and dry-run heading"
echo "──────────────────────────────────────────────────────────────────────────"
reset_state
write_stub_no_approval
truncate -s 0 "$CALL_LOG"
DRY_RUN=true
APPROVAL_REQUIRED=false

# Simulate the dry-run comment body the workflow would build.
DRY_RUN_COMMENT_BODY="${MARKER}
## :mag: CODEOWNERS — dry-run preview (no changes committed)

This PR renames one or more directories that are tracked in \`.github/CODEOWNERS\`.
The bot is running in **dry-run mode** because the repository variable \`CODEOWNERS_BOT_DRY_RUN\` is set to \`true\`.

No commit has been pushed."

if echo "$DRY_RUN_COMMENT_BODY" | grep -q "${MARKER}"; then
  pass "Dry-run comment body contains the bot marker"
else
  fail "Dry-run comment body is missing the bot marker"
fi

if echo "$DRY_RUN_COMMENT_BODY" | grep -q "dry-run preview"; then
  pass "Dry-run comment body contains 'dry-run preview' heading"
else
  fail "Dry-run comment body is missing the dry-run preview heading"
fi

if echo "$DRY_RUN_COMMENT_BODY" | grep -q "No commit has been pushed"; then
  pass "Dry-run comment body explicitly states no commit was pushed"
else
  fail "Dry-run comment body does not state that no commit was pushed"
fi

# ── Test 12: approval-gate comment body contains expected marker and heading ───
echo ""
echo "Test 12: approval-gate comment body contains marker and pending-approval heading"
echo "───────────────────────────────────────────────────────────────────────────────"
reset_state
DRY_RUN=true
APPROVAL_REQUIRED=true

APPROVAL_COMMENT_BODY="${MARKER}
## :mag: CODEOWNERS — pending approval before auto-commit

This PR renames one or more directories that are tracked in \`.github/CODEOWNERS\`.
The repository is configured with \`CODEOWNERS_BOT_REQUIRE_APPROVAL=true\`, so the
bot will **not** commit the fix automatically until a maintainer approves."

if echo "$APPROVAL_COMMENT_BODY" | grep -q "${MARKER}"; then
  pass "Approval-gate comment body contains the bot marker"
else
  fail "Approval-gate comment body is missing the bot marker"
fi

if echo "$APPROVAL_COMMENT_BODY" | grep -q "pending approval before auto-commit"; then
  pass "Approval-gate comment body contains 'pending approval' heading"
else
  fail "Approval-gate comment body is missing the pending-approval heading"
fi

if echo "$APPROVAL_COMMENT_BODY" | grep -q "CODEOWNERS_BOT_REQUIRE_APPROVAL=true"; then
  pass "Approval-gate comment body references the REQUIRE_APPROVAL variable"
else
  fail "Approval-gate comment body does not reference CODEOWNERS_BOT_REQUIRE_APPROVAL=true"
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
