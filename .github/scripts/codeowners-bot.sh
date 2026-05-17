#!/usr/bin/env bash
# codeowners-bot.sh
#
# Shared shell helpers for the suggest-codeowners-updates workflow.
# Sourced by both the workflow and the unit-test script so there is a
# single authoritative definition of each helper.
#
# Expected caller-supplied variables:
#   MARKER       — HTML comment used as the bot-comment sentinel
#   REPO         — "owner/repo" string  (e.g. "acme/my-app")
#   PR_NUMBER    — pull-request number

# delete_bot_comment — removes any existing bot comment when CODEOWNERS
# is already in sync and no action is required.  A failure to delete
# (e.g. insufficient permissions on a fork PR) is logged as a warning
# rather than treated as an error.
delete_bot_comment() {
  local existing_id _raw _attempt
  existing_id=""
  local lookup_ok=false
  for _attempt in 1 2 3; do
    # Use an `if` conditional so `set -e` does not abort the script
    # when `gh api` exits non-zero on a transient failure.
    if _raw=$(
         gh api "repos/$REPO/issues/$PR_NUMBER/comments" \
           --jq ".[] | select(.body | startswith(\"${MARKER}\")) | .id" \
           2>/dev/null | head -1
       ); then
      existing_id="$_raw"
      lookup_ok=true
      break
    fi
    echo "WARNING: delete-lookup attempt ${_attempt}/3 failed; retrying in 5 s …"
    sleep 5
  done

  if [[ "$lookup_ok" == "false" ]]; then
    echo "WARNING: Could not reliably list PR comments after 3 attempts — skipping delete to avoid accidental data loss."
    echo "::warning::suggest-codeowners-updates: GitHub API comment-lookup failed 3 times in delete_bot_comment() — stale bot comment (if any) was NOT deleted. Check API rate limits or network connectivity."
    echo "### suggest-codeowners-updates warning" >> "$GITHUB_STEP_SUMMARY"
    echo "GitHub API comment-lookup failed after 3 attempts in \`delete_bot_comment()\`. The stale bot comment (if any) was **not** deleted to avoid accidental data loss. This is usually caused by a transient API error or rate-limit burst — re-running the workflow should resolve it." >> "$GITHUB_STEP_SUMMARY"
  elif [[ -n "$existing_id" ]]; then
    echo "CODEOWNERS is already in sync — removing stale bot comment #${existing_id} …"
    if gh api "repos/$REPO/issues/comments/${existing_id}" \
         --method DELETE 2>/dev/null; then
      echo "Stale bot comment deleted successfully."
    else
      echo "WARNING: Could not delete existing bot comment (insufficient permissions — expected on fork PRs)."
    fi
  else
    echo "No existing bot comment to clean up."
  fi
}
