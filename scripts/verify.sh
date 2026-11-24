#!/bin/sh
set -eu
cd "$(dirname "$0")/.."

echo "== go build"
go build ./...
echo "== go vet"
go vet ./...
echo "== go test"
go test ./...
echo "== frontend typecheck"
bun run typecheck
echo "== config typecheck"
bun run typecheck:config
echo "== frontend tests"
bun run test
echo "== frontend build"
bun run build:web
echo "== docs build"
bun run docs:build
echo "== ok"
