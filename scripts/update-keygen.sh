#!/bin/sh
# Generate the Ed25519 key pair used to sign updates. The secret key is kept
# outside the repository; only its public counterpart belongs in CI/config.
set -eu

cd "$(dirname "$0")/.."
dest=${1:-"$HOME/Library/Application Support/Pi Mygo/update-keys"}

mkdir -p "$dest"
chmod 700 "$dest"
go tool mygo keygen -o "$dest"

printf '\nUpdate keys written to %s\n' "$dest"
printf 'Set PI_MYGO_UPDATE_PUBLIC_KEY from the .pub file and put the .key file\n'
printf 'in the CI secret MYGO_UPDATER_PRIVATE_KEY (or a password manager).\n'
