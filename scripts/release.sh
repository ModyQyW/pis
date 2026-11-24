#!/bin/sh
# Build a release with versioned metadata. Signing, notarization, and update
# archives are opt-in through environment variables; secrets are never echoed.
set -eu

cd "$(dirname "$0")/.."

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

if [ -z "${PIS_VERSION:-}" ]; then
  suggested=$(suggest_version)
  if [ -t 0 ]; then
    printf 'Release version [%s]: ' "$suggested"
    IFS= read -r entered || entered=""
    PIS_VERSION=${entered:-$suggested}
  else
    echo "release: set PIS_VERSION (suggested: $suggested)" >&2
    exit 2
  fi
fi
PIS_VERSION=${PIS_VERSION#v}
if ! printf '%s\n' "$PIS_VERSION" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+([+-][0-9A-Za-z.-]+)?$'; then
  echo "release: version must look like 0.0.1 (got '$PIS_VERSION')" >&2
  exit 2
fi
export PIS_VERSION

if [ -n "${MYGO_UPDATER_PRIVATE_KEY_FILE:-}" ]; then
  if [ ! -f "$MYGO_UPDATER_PRIVATE_KEY_FILE" ]; then
    echo "release: MYGO_UPDATER_PRIVATE_KEY_FILE not found" >&2
    exit 2
  fi
  MYGO_UPDATER_PRIVATE_KEY=$(cat "$MYGO_UPDATER_PRIVATE_KEY_FILE")
  export MYGO_UPDATER_PRIVATE_KEY
fi

if [ -n "${PIS_UPDATE_PUBLIC_KEY:-}" ] &&
  [ -z "${PIS_UPDATE_URL:-}" ] &&
  [ -z "${PIS_UPDATE_GITHUB:-}" ]; then
  echo "release: set PIS_UPDATE_URL or PIS_UPDATE_GITHUB with the public key" >&2
  exit 2
fi

if [ -n "${MACOS_NOTARY_PROFILE:-}" ] && [ -z "${MACOS_SIGNING_IDENTITY:-}" ]; then
  echo "release: notarization requires MACOS_SIGNING_IDENTITY" >&2
  exit 2
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
