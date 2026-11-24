#!/bin/sh
set -eu
cd "$(dirname "$0")/.."

echo "== gofmt"
unformatted=$(gofmt -l $(git ls-files '*.go'))
if [ -n "$unformatted" ]; then
  echo "$unformatted"
  echo "run 'go fmt ./...'"
  exit 1
fi

echo "== go build"
go build ./...
echo "== go vet"
go vet ./...
echo "== go test"
go test ./...
echo "== vite+ format, lint, and typecheck"
bun run check:web
echo "== frontend typecheck"
bun run typecheck
echo "== config typecheck"
bun run typecheck:config
echo "== bridge tests"
bun run test:bridge
echo "== frontend tests"
bun run test
echo "== frontend build"
bun run build:web
echo "== user docs build"
bun run docs:build
echo "== ok"
