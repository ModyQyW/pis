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

# npm packages can ship Go code; it is not part of this module.
packages=$(go list ./... | grep -v '/node_modules/' || true)
if [ -z "$packages" ]; then
  echo "no Go packages found"
  exit 1
fi

echo "== go build"
go build $packages
echo "== go vet"
go vet $packages
echo "== go test"
go test $packages
echo "== vite+ format, lint, and typecheck"
bun run check:web
echo "== bridge tests"
bun run test:bridge
echo "== frontend tests"
bun run test
echo "== frontend build"
bun run build:web
echo "== docs-user build"
bun run docs:build
echo "== ok"
