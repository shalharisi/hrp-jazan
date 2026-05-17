#!/usr/bin/env bash
# codeowners-bot.sh
#
# Shared shell helpers for the suggest-codeowners-updates workflow.
# Sourced by both the workflow and the unit-test script so there is a
# single authoritative definition of each helper.
#
# Expected caller-supplied variables:
#   MARKER               — HTML comment used as the bot-comment sentinel
#   REPO                 — "owner/repo" string  (e.g. "acme/my-app")
#   PR_NUMBER            — pull-request number
#
# Additional variables for resolve_dry_run_mode:
#   DRY_RUN_VAR          — value of the CODEOWNERS_BOT_DRY_RUN repo variable
#   PR_LABELS            — JSON array of PR label names
#
# Additional variables for check_approval_gate:
#   REQUIRE_APPROVAL_VAR — value of the CODEOWNERS_BOT_REQUIRE_APPROVAL repo variable
#   DRY_RUN              — current dry-run state (may be updated by this function)

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

# resolve_dry_run_mode — sets DRY_RUN=true when the repository variable
# CODEOWNERS_BOT_DRY_RUN is "true" (case-insensitive) or when the PR
# carries the "codeowners-dry-run" label.  Otherwise sets DRY_RUN=false.
#
# Reads:  DRY_RUN_VAR, PR_LABELS
# Sets:   DRY_RUN (exported to caller scope)
resolve_dry_run_mode() {
  DRY_RUN=false

  if [[ "${DRY_RUN_VAR,,}" == "true" ]]; then
    DRY_RUN=true
    echo "Dry-run enabled via repository variable CODEOWNERS_BOT_DRY_RUN=true."
  fi

  if echo "${PR_LABELS}" | grep -qi '"codeowners-dry-run"'; then
    DRY_RUN=true
    echo "Dry-run enabled via PR label 'codeowners-dry-run'."
  fi
}

# check_approval_gate — when CODEOWNERS_BOT_REQUIRE_APPROVAL=true and
# DRY_RUN=false, checks whether a maintainer has approved the change via
# a GitHub review approval or a :+1: reaction on the existing bot comment.
# If no approval is found the function forces DRY_RUN=true and sets
# APPROVAL_REQUIRED=true so the caller can post the appropriate comment.
# If DRY_RUN is already true the gate is skipped entirely.
#
# Reads:  REQUIRE_APPROVAL_VAR, DRY_RUN, REPO, PR_NUMBER, MARKER
# Sets:   APPROVAL_REQUIRED, APPROVED, DRY_RUN (all exported to caller scope)
check_approval_gate() {
  APPROVAL_REQUIRED=false

  if [[ "${REQUIRE_APPROVAL_VAR,,}" != "true" || "$DRY_RUN" != "false" ]]; then
    return 0
  fi

  echo "CODEOWNERS_BOT_REQUIRE_APPROVAL=true — checking for approval before auto-committing."

  APPROVED=false

  # Check for a GitHub review approval from a maintainer on this PR.
  # Steps:
  #   1. Take the latest review per reviewer (so a later CHANGES_REQUESTED
  #      supersedes an earlier APPROVED from the same person).
  #   2. Filter to those whose net state is APPROVED.
  #   3. For each such reviewer, check their repo permission via the
  #      collaborator API and only accept write/maintain/admin.
  mapfile -t approved_reviewer_logins < <(
    gh api "repos/$REPO/pulls/$PR_NUMBER/reviews" \
      --jq '
        group_by(.user.login) |
        map(sort_by(.submitted_at) | last) |
        map(select(.state == "APPROVED")) |
        .[].user.login
      ' \
      2>/dev/null || true
  )

  for login in "${approved_reviewer_logins[@]}"; do
    perm=$(
      gh api "repos/$REPO/collaborators/$login/permission" \
        --jq '.permission' \
        2>/dev/null || echo "none"
    )
    case "$perm" in
      write|maintain|admin)
        APPROVED=true
        echo "Approval detected: maintainer '$login' approved via GitHub review (permission: $perm)."
        break
        ;;
      *)
        echo "Ignoring review approval from '$login' — insufficient permission ($perm)."
        ;;
    esac
  done

  # If no review approval yet, check for a :+1: reaction on the most
  # recent bot comment (if one has already been posted).
  # Security: only count reactions from users with write/maintain/admin
  # permission to prevent non-maintainers from unlocking auto-commit.
  if [[ "$APPROVED" == "false" ]]; then
    # Look up the most recent comment posted by github-actions[bot]
    # that carries the bot marker — verify both marker AND author to
    # prevent a spoofed marker comment from being used as the target.
    local existing_comment_id
    existing_comment_id=$(
      gh api "repos/$REPO/issues/$PR_NUMBER/comments" \
        --jq ".[] | select(
          (.body | startswith(\"$MARKER\")) and
          (.user.login == \"github-actions[bot]\")
        ) | .id" \
        2>/dev/null | tail -1 || true
    )

    if [[ -n "$existing_comment_id" ]]; then
      # Collect logins of all users who reacted with :+1:
      mapfile -t reactor_logins < <(
        gh api "repos/$REPO/issues/comments/$existing_comment_id/reactions" \
          --jq '.[] | select(.content == "+1") | .user.login' \
          2>/dev/null || true
      )

      for login in "${reactor_logins[@]}"; do
        # Accept the reaction only if the user has at least write
        # (push) permission on the repository.
        perm=$(
          gh api "repos/$REPO/collaborators/$login/permission" \
            --jq '.permission' \
            2>/dev/null || echo "none"
        )
        case "$perm" in
          write|maintain|admin)
            APPROVED=true
            echo "Approval detected: maintainer '$login' reacted with :+1: (permission: $perm)."
            break
            ;;
          *)
            echo "Ignoring :+1: from '$login' — insufficient permission ($perm)."
            ;;
        esac
      done
    fi
  fi

  if [[ "$APPROVED" == "false" ]]; then
    DRY_RUN=true
    APPROVAL_REQUIRED=true
    echo "No maintainer approval detected — forcing dry-run mode until a maintainer approves."
  else
    echo "Approval confirmed — proceeding with auto-commit mode."
  fi
}
