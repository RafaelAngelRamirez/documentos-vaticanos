#!/usr/bin/env bash
# Decide whether .ci-build.sh may cut a release.
#
# Refuses, and does not run standard-version, when:
#   - the CI event commit (DV_RELEASE_EVENT_SHA / GITHUB_SHA) is set and is
#     not the tip of the release branch on the remote
#   - HEAD is not the tip of the release branch on the remote (default origin/master)
#   - that tip's subject is already a chore(release): commit
#   - the tag that would be created already exists on that remote, or in this clone
#
# A refusal exits before any commit or tag. This script never fetches, never
# pushes, and never deletes or moves tags. ls-remote is read-only.
#
# Exit 0: cutter ran (npx standard-version, or DV_RELEASE_CUTTER in tests).
# Exit 2: next tag already exists.
# Exit 3: HEAD is not the remote tip.
# Exit 4: event SHA is set and is not the remote tip (stale / duplicate webhook).
# Exit 5: remote tip is already a chore(release): commit (no second bump).
#
# DV_NEXT_TAG skips the dry-run (tests). DV_RELEASE_CUTTER, when set, is an
# executable used instead of standard-version (tests).
# DV_RELEASE_EVENT_SHA overrides GITHUB_SHA for the event-commit check (tests).
set -euo pipefail

REMOTE="${DV_RELEASE_REMOTE:-origin}"
BRANCH="${DV_RELEASE_BRANCH:-master}"

die() {
  local code="$1"
  shift
  echo "ERROR: $*" >&2
  echo "::DOCVAT_RELEASE_REFUSED::${code}" >&2
  exit "$code"
}

normalize_sha() {
  local raw="$1"
  raw="${raw#refs/heads/}"
  printf '%s' "$raw" | tr 'A-F' 'a-f'
}

head_sha="$(normalize_sha "$(git rev-parse HEAD)")"
tip_line=""
if ! tip_line="$(git ls-remote "$REMOTE" "refs/heads/${BRANCH}")"; then
  die 3 "could not read refs/heads/${BRANCH} from ${REMOTE}; not cutting a release"
fi
tip_sha="$(normalize_sha "${tip_line%%[[:space:]]*}")"
if [[ -z "$tip_sha" || ! "$tip_sha" =~ ^[0-9a-f]{40}$ ]]; then
  die 3 "${REMOTE} has no refs/heads/${BRANCH}; not cutting a release"
fi

# DV_RELEASE_EVENT_SHA, when set (even to empty), wins over GITHUB_SHA so tests
# can disable the event check without inheriting a host GITHUB_SHA.
if [[ -n "${DV_RELEASE_EVENT_SHA+x}" ]]; then
  event_sha="$(normalize_sha "${DV_RELEASE_EVENT_SHA}")"
else
  event_sha="$(normalize_sha "${GITHUB_SHA:-}")"
fi
if [[ -n "$event_sha" ]]; then
  if [[ ! "$event_sha" =~ ^[0-9a-f]{40}$ ]]; then
    die 4 "event SHA ${event_sha} is not a full commit id; not cutting a release"
  fi
  if [[ "$event_sha" != "$tip_sha" ]]; then
    die 4 "event SHA ${event_sha} is not the tip of ${REMOTE}/${BRANCH} (${tip_sha}); not cutting a release"
  fi
fi

if [[ "$head_sha" != "$tip_sha" ]]; then
  die 3 "HEAD ${head_sha} is not the tip of ${REMOTE}/${BRANCH} (${tip_sha}); not cutting a release"
fi

tip_subject=""
if ! tip_subject="$(git log -1 --format=%s "$tip_sha" 2>/dev/null)"; then
  die 5 "could not read subject of tip ${tip_sha}; not cutting a release"
fi
if [[ "$tip_subject" == chore\(release\):* ]]; then
  die 5 "tip of ${REMOTE}/${BRANCH} is already '${tip_subject}'; not cutting another release"
fi

next_tag="${DV_NEXT_TAG:-}"
if [[ -z "$next_tag" ]]; then
  dry_out=""
  if ! dry_out="$(npx --yes standard-version@9.5.0 --dry-run 2>&1)"; then
    die 2 "standard-version --dry-run failed; not cutting a release"
  fi
  next_tag="$(printf '%s\n' "$dry_out" | sed -n 's/.*tagging release[[:space:]]*\(v\{0,1\}[0-9][0-9A-Za-z.+-]*\).*/\1/p' | tail -n 1)"
fi
if [[ ! "$next_tag" =~ ^v?[0-9]+\.[0-9]+\.[0-9]+([.+-][0-9A-Za-z]+)*$ ]]; then
  die 2 "could not read the next release tag; not cutting a release"
fi

remote_tag_line=""
if ! remote_tag_line="$(git ls-remote --tags "$REMOTE" "refs/tags/${next_tag}")"; then
  die 2 "could not read refs/tags/${next_tag} from ${REMOTE}; not cutting a release"
fi
if [[ -n "$remote_tag_line" ]]; then
  die 2 "tag ${next_tag} already exists on ${REMOTE}; not creating another tag or release commit"
fi
if git rev-parse --verify --quiet "refs/tags/${next_tag}" >/dev/null; then
  die 2 "tag ${next_tag} already exists in this clone; not creating another tag or release commit"
fi

echo "==> release guard ok: ${next_tag} at ${head_sha} (tip of ${REMOTE}/${BRANCH})"
echo "::DOCVAT_RELEASE_GUARD::ok ${next_tag}"
if [[ -n "${DV_RELEASE_CUTTER:-}" ]]; then
  "$DV_RELEASE_CUTTER"
else
  npx --yes standard-version@9.5.0
fi
