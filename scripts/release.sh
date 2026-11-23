#!/bin/sh
# Build a release with versioned metadata. Signing, notarization, and update
# archives are opt-in through environment variables; secrets are never echoed.
set -eu

cd "$(dirname "$0")/.."

if [ -z "${PI_MYGO_VERSION:-}" ]; then
  echo "release: set PI_MYGO_VERSION (for example 0.2.0)" >&2
  exit 2
fi
PI_MYGO_VERSION=${PI_MYGO_VERSION#v}
export PI_MYGO_VERSION

if [ -n "${MYGO_UPDATER_PRIVATE_KEY_FILE:-}" ]; then
  if [ ! -f "$MYGO_UPDATER_PRIVATE_KEY_FILE" ]; then
    echo "release: MYGO_UPDATER_PRIVATE_KEY_FILE not found" >&2
    exit 2
  fi
  MYGO_UPDATER_PRIVATE_KEY=$(cat "$MYGO_UPDATER_PRIVATE_KEY_FILE")
  export MYGO_UPDATER_PRIVATE_KEY
fi

if [ -n "${PI_MYGO_UPDATE_PUBLIC_KEY:-}" ] &&
  [ -z "${PI_MYGO_UPDATE_URL:-}" ] &&
  [ -z "${PI_MYGO_UPDATE_GITHUB:-}" ]; then
  echo "release: set PI_MYGO_UPDATE_URL or PI_MYGO_UPDATE_GITHUB with the public key" >&2
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

echo "release: building $PI_MYGO_VERSION"
exec go tool mygo build "$@"
