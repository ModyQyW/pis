package piinfo

import (
	"context"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

func TestParseVersion(t *testing.T) {
	cases := []struct {
		in   string
		want string
		ok   bool
	}{
		{"1.6.0", "1.6.0", true},
		{"pi 1.6.0\n", "1.6.0", true},
		{"v1.10.3-beta.1", "1.10.3", true},
		{"nope", "", false},
	}
	for _, c := range cases {
		v, ok := ParseVersion(c.in)
		if ok != c.ok {
			t.Fatalf("%q: ok=%v want %v", c.in, ok, c.ok)
		}
		if ok && v.String() != c.want {
			t.Fatalf("%q: got %s want %s", c.in, v, c.want)
		}
	}
}

func TestCompatibleBoundaries(t *testing.T) {
	cases := map[string]bool{
		"1.5.9": false,
		"1.6.0": true,
		"1.9.2": true,
		"2.0.0": false,
		"0.9.0": false,
	}
	for raw, want := range cases {
		v, ok := ParseVersion(raw)
		if !ok {
			t.Fatalf("parse %s", raw)
		}
		if got := Compatible(v); got != want {
			t.Fatalf("%s: got %v want %v", raw, got, want)
		}
	}
}

func TestDiscoverExplicitExecutable(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("shell script fixture")
	}
	dir := t.TempDir()
	path := filepath.Join(dir, "pi")
	script := "#!/bin/sh\necho '1.6.0'\n"
	if err := os.WriteFile(path, []byte(script), 0o755); err != nil {
		t.Fatal(err)
	}
	st := Discover(context.Background(), path)
	if !st.Found || !st.Compatible || st.Version != "1.6.0" || st.Source != "settings" {
		t.Fatalf("unexpected status: %+v", st)
	}
}

func TestDiscoverRejectsUnsupported(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("shell script fixture")
	}
	dir := t.TempDir()
	path := filepath.Join(dir, "pi")
	if err := os.WriteFile(path, []byte("#!/bin/sh\necho '2.1.0'\n"), 0o755); err != nil {
		t.Fatal(err)
	}
	st := Discover(context.Background(), path)
	if !st.Found || st.Compatible || st.Error == "" {
		t.Fatalf("unexpected status: %+v", st)
	}
}

func TestDiscoverExplicitDoesNotFallBack(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("shell script fixture")
	}
	dir := t.TempDir()
	working := filepath.Join(dir, "working-pi")
	if err := os.WriteFile(working, []byte("#!/bin/sh\necho '1.6.0'\n"), 0o755); err != nil {
		t.Fatal(err)
	}
	t.Setenv("PIS_PI", working)
	missing := filepath.Join(dir, "missing-pi")
	st := Discover(context.Background(), missing)
	if st.Found {
		t.Fatalf("explicit path fell back to another pi: %+v", st)
	}
	if !strings.Contains(st.Error, missing) {
		t.Fatalf("error %q does not name the configured path", st.Error)
	}
}

func TestDiscoverFindsBunInstall(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("shell script fixture")
	}
	bun := t.TempDir()
	if err := os.MkdirAll(filepath.Join(bun, "bin"), 0o755); err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(bun, "bin", "pi")
	if err := os.WriteFile(path, []byte("#!/bin/sh\necho '1.7.0'\n"), 0o755); err != nil {
		t.Fatal(err)
	}
	t.Setenv("BUN_INSTALL", bun)
	t.Setenv("PIS_PI", "")
	t.Setenv("PATH", t.TempDir())
	st := Discover(context.Background(), "")
	if !st.Found || !st.Compatible || st.Path != path || st.Source != "common" {
		t.Fatalf("unexpected status: %+v", st)
	}
}
