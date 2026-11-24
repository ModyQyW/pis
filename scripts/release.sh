#!/bin/sh
# Publish a release end to end, or build installers locally.
#
# publish (default): bump the default version, verify the release notes,
# run the full check, commit, tag, push, wait for the Release workflow,
# verify the draft assets, and publish the release. PIS_VERSION skips the
# prompt; without a terminal it is required.
#
# build: run `go tool mygo build` with the remaining flags. The release
# workflow uses this mode; signing, notarization, and update archives stay
# opt-in through environment variables, and secrets are never echoed.
set -eu

cd "$(dirname "$0")/.."

usage() {
  cat <<'EOF'
Usage: scripts/release.sh [publish] [version]
       scripts/release.sh build [mygo build flags]

publish runs the whole release: version, checks, commit, tag, push, the
Release workflow, draft verification, and publication. Set PIS_VERSION to
skip the prompt and pass a version as the first argument in a terminal.
build runs `go tool mygo build` with the remaining flags, as the Release
workflow does.
EOF
}

fail() {
  printf 'release: %s\n' "$*" >&2
  exit 1
}

suggest_version() {
  latest=$(git tag --list 'v[0-9]*' --sort=-v:refname | sed -n '1p')
  if [ -n "$latest" ]; then
    core=${latest#v}
    core=${core%%-*}
    major=${core%%.*}
    rest=${core#*.}
    minor=${rest%%.*}
    patch=${rest#*.}
    case "$patch" in
      ''|*[!0-9]*) patch=0 ;;
    esac
    printf '%s.%s.%s\n' "$major" "$minor" "$((patch + 1))"
    return
  fi
  default=$(sed -n 's/.*version: process.env.PIS_VERSION ?? "\([0-9][0-9.]*\)".*/\1/p' mygo.config.ts | sed -n '1p')
  printf '%s\n' "${default:-0.1.0}"
}

resolve_version() {
  if [ -z "${PIS_VERSION:-}" ]; then
    suggested=$(suggest_version)
    if [ -t 0 ]; then
      printf 'Release version [%s]: ' "$suggested"
      IFS= read -r entered || entered=""
      PIS_VERSION=${entered:-$suggested}
    else
      fail "set PIS_VERSION (suggested: $suggested)"
    fi
  fi
  PIS_VERSION=${PIS_VERSION#v}
  if ! printf '%s\n' "$PIS_VERSION" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+([+-][0-9A-Za-z.-]+)?$'; then
    fail "version must look like 0.0.1 (got '$PIS_VERSION')"
  fi
  export PIS_VERSION
}

build_release() {
  if [ -n "${MYGO_UPDATER_PRIVATE_KEY_FILE:-}" ]; then
    if [ ! -f "$MYGO_UPDATER_PRIVATE_KEY_FILE" ]; then
      fail "MYGO_UPDATER_PRIVATE_KEY_FILE not found"
    fi
    MYGO_UPDATER_PRIVATE_KEY=$(cat "$MYGO_UPDATER_PRIVATE_KEY_FILE")
    export MYGO_UPDATER_PRIVATE_KEY
  fi

  if [ -n "${PIS_UPDATE_PUBLIC_KEY:-}" ] &&
    [ -z "${PIS_UPDATE_URL:-}" ] &&
    [ -z "${PIS_UPDATE_GITHUB:-}" ]; then
    fail "set PIS_UPDATE_URL or PIS_UPDATE_GITHUB with the public key"
  fi

  if [ -n "${MACOS_NOTARY_PROFILE:-}" ] && [ -z "${MACOS_SIGNING_IDENTITY:-}" ]; then
    fail "notarization requires MACOS_SIGNING_IDENTITY"
  fi

  if [ -z "${MACOS_SIGNING_IDENTITY:-}" ]; then
    echo "release: MACOS_SIGNING_IDENTITY is unset; the app will be ad-hoc signed" >&2
  elif [ -z "${MACOS_NOTARY_PROFILE:-}" ]; then
    echo "release: signed but not notarized; set MACOS_NOTARY_PROFILE to notarize" >&2
  fi

  if [ -z "${MYGO_UPDATER_PRIVATE_KEY:-}" ]; then
    echo "release: no updater private key; update archives will be skipped" >&2
  fi

  echo "release: building $PIS_VERSION"
  exec go tool mygo build "$@"
}

need() {
  command -v "$1" >/dev/null 2>&1 || fail "$1 is required"
}

release_notes_from_changelog() {
  notes=$1
  awk -v v="$PIS_VERSION" '
    $0 ~ "^## " v "([ (]|$)" { inside = 1; next }
    inside && /^## / { exit }
    inside { print }
  ' CHANGELOG.md | sed '/./,$!d' >"$notes"
  if [ ! -s "$notes" ]; then
    rm -f "$notes"
    fail "CHANGELOG.md has no $PIS_VERSION section and release-notes/$PIS_VERSION.md is missing"
  fi
  previous=$(git tag --list 'v*' --sort=-v:refname | sed -n '1p')
  if [ -n "$previous" ]; then
    printf '\nFull Changelog: https://github.com/%s/compare/%s...v%s\n' "$repo" "$previous" "$PIS_VERSION" >>"$notes"
  fi
  echo "release: generated release-notes/$PIS_VERSION.md from CHANGELOG.md"
}

wait_for_run() {
  tag=$1
  run_id=$(gh run list --workflow release.yml --limit 30 \
    --json databaseId,headBranch --jq "[.[] | select(.headBranch == \"$tag\")][0].databaseId // empty")
  if [ -z "$run_id" ]; then
    echo "release: starting the Release workflow for $tag"
    gh workflow run release.yml -f version="$tag" >/dev/null
    i=0
    while [ -z "$run_id" ] && [ "$i" -lt 36 ]; do
      sleep 5
      run_id=$(gh run list --workflow release.yml --limit 30 \
        --json databaseId,headBranch --jq "[.[] | select(.headBranch == \"$tag\")][0].databaseId // empty")
      i=$((i + 1))
    done
  fi
  [ -n "$run_id" ] || fail "no Release workflow run for $tag"
  conclusion=$(gh run view "$run_id" --json conclusion --jq '.conclusion // ""')
  if [ "$conclusion" = "failure" ] || [ "$conclusion" = "cancelled" ] || [ "$conclusion" = "timed_out" ]; then
    echo "release: retrying failed workflow run $run_id"
    gh run rerun "$run_id" --failed >/dev/null
  fi
  echo "release: waiting for workflow run $run_id"
  gh run watch "$run_id" --exit-status --interval 10 >/dev/null || fail "Release workflow $run_id failed"
}

verify_assets() {
  tag=$1
  v=$2
  assets=$(gh release view "$tag" --json assets --jq '.assets[].name') || fail "release $tag not found"
  for asset in \
    SHA256SUMS \
    "pis-$v-arm64.dmg" \
    "pis-$v-amd64.dmg" \
    "pis-setup-$v-arm64.exe" \
    "pis-setup-$v-amd64.exe" \
    "pis-$v-linux-arm64.tar.gz" \
    "pis-$v-linux-amd64.tar.gz" \
    "update-darwin-arm64.json" \
    "update-darwin-amd64.json" \
    "update-linux-arm64.json" \
    "update-linux-amd64.json" \
    "update-windows-arm64.json" \
    "update-windows-amd64.json"; do
    printf '%s\n' "$assets" | grep -qx "$asset" || fail "draft $tag is missing $asset"
  done

  sums=$(mktemp)
  names=$(mktemp)
  listed=$(mktemp)
  trap 'rm -f "$sums" "$names" "$listed"' EXIT
  gh release download "$tag" -p SHA256SUMS -O "$sums" --clobber >/dev/null ||
    fail "could not download SHA256SUMS from draft $tag"
  awk '{print $2}' "$sums" | sort >"$names"
  printf '%s\n' "$assets" | grep -vx SHA256SUMS | grep -v '^update-.*\.json$' | sort >"$listed"
  missing=$(comm -23 "$listed" "$names")
  [ -z "$missing" ] || fail "SHA256SUMS does not cover: $missing"
  rm -f "$sums" "$names" "$listed"
  trap - EXIT
}

publish_release() {
  need git
  need gh
  need bun
  gh auth status >/dev/null 2>&1 || fail "gh is not authenticated"

  repo=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
  branch=$(git rev-parse --abbrev-ref HEAD)
  [ "$branch" = "main" ] || fail "publish from main (current branch: $branch)"
  [ -z "$(git status --porcelain)" ] || fail "working tree is dirty; commit or stash changes first"

  git fetch origin main --tags >/dev/null
  if ! git merge-base --is-ancestor origin/main HEAD; then
    if git merge-base --is-ancestor HEAD origin/main; then
      git merge --ff-only origin/main >/dev/null
    else
      fail "main and origin/main diverged"
    fi
  fi

  resolve_version
  tag=v$PIS_VERSION
  notes=release-notes/$PIS_VERSION.md

  resume=0
  if git rev-parse -q --verify "refs/tags/$tag" >/dev/null; then
    [ "$(git rev-parse "$tag^{commit}")" = "$(git rev-parse HEAD)" ] ||
      fail "tag $tag exists on another commit; delete it or pick another version"
    resume=1
    echo "release: resuming $tag from $tag"
  fi

  if [ "$resume" -eq 0 ]; then
    grep -Eq "^## ${PIS_VERSION}([ (]|$)" CHANGELOG.md ||
      fail "CHANGELOG.md has no $PIS_VERSION section"
    [ -f "$notes" ] || release_notes_from_changelog "$notes"

    tmp=$(mktemp)
    sed -E "s/(version: process\.env\.PIS_VERSION \?\? \")[0-9]+\.[0-9]+\.[0-9]+\"/\1$PIS_VERSION\"/" mygo.config.ts >"$tmp"
    mv "$tmp" mygo.config.ts
    grep -q "PIS_VERSION ?? \"$PIS_VERSION\"" mygo.config.ts ||
      fail "could not set the default version in mygo.config.ts"

    echo "release: installing dependencies"
    bun install --frozen-lockfile
    echo "release: running the full check"
    bun run check

    git add CHANGELOG.md mygo.config.ts release-notes
    if ! git diff --cached --quiet; then
      git commit -m "Prepare $PIS_VERSION release" >/dev/null
    fi
    [ "$(git status --porcelain)" = "" ] || fail "release preparation left uncommitted changes"

    git push origin main
    git tag "$tag"
    git push origin "$tag"
    echo "release: pushed $tag"
  else
    [ -f "$notes" ] || fail "release-notes/$PIS_VERSION.md is missing"
  fi

  if gh release view "$tag" --json isDraft --jq .isDraft 2>/dev/null | grep -qx false; then
    echo "release: $tag is already published: $(gh release view "$tag" --json url --jq .url)"
    return
  fi

  wait_for_run "$tag"
  verify_assets "$tag" "$PIS_VERSION"

  echo "release: publishing $tag"
  gh release edit "$tag" \
    --title "PiS $PIS_VERSION" \
    --notes-file "$notes" \
    --latest \
    --draft=false >/dev/null

  draft=$(gh release view "$tag" --json isDraft --jq .isDraft)
  latest=$(gh release list --limit 1 --json tagName,isLatest --jq '.[0] | select(.isLatest) | .tagName')
  published=$(gh release view "$tag" --json publishedAt --jq .publishedAt)
  url=$(gh release view "$tag" --json url --jq .url)
  [ "$draft" = "false" ] || fail "$tag is still a draft"
  [ "$latest" = "$tag" ] || fail "$tag is not the latest release"
  [ -n "$published" ] && [ "$published" != "null" ] || fail "$tag has no publication time"
  echo "release: published $tag: $url"
}

mode=publish
case "${1:-}" in
  build)
    mode=build
    shift
    ;;
  publish)
    shift
    if [ "$#" -gt 0 ]; then
      case "$1" in
        -*) ;;
        *)
          PIS_VERSION=$1
          shift
          ;;
      esac
    fi
    ;;
  -h|--help)
    usage
    exit 0
    ;;
  -*)
    mode=build
    ;;
  "")
    ;;
  *)
    PIS_VERSION=$1
    shift
    ;;
esac

resolve_version

if [ "$mode" = "build" ]; then
  build_release "$@"
else
  [ "$#" -eq 0 ] || {
    usage >&2
    exit 2
  }
  publish_release
fi
