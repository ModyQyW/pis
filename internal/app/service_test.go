package app

import (
	"os"
	"path/filepath"
	"testing"

	"pis/internal/settings"
)

func TestNormalizeDirResolvesSymlinks(t *testing.T) {
	root := t.TempDir()
	target := filepath.Join(root, "real")
	if err := os.Mkdir(target, 0o755); err != nil {
		t.Fatal(err)
	}
	link := filepath.Join(root, "link")
	if err := os.Symlink(target, link); err != nil {
		t.Skipf("symlinks unavailable: %v", err)
	}

	got, err := normalizeDir(link)
	if err != nil {
		t.Fatal(err)
	}
	want, err := filepath.EvalSymlinks(target)
	if err != nil {
		t.Fatal(err)
	}
	if got != want {
		t.Fatalf("normalizeDir(%q) = %q, want %q", link, got, want)
	}
}

func TestRecentsDeduplicatesSymlinkedPaths(t *testing.T) {
	root := t.TempDir()
	target := filepath.Join(root, "real")
	if err := os.Mkdir(target, 0o755); err != nil {
		t.Fatal(err)
	}
	link := filepath.Join(root, "link")
	if err := os.Symlink(target, link); err != nil {
		t.Skipf("symlinks unavailable: %v", err)
	}

	got := recents(settings.Settings{Recents: []settings.Recent{
		{Path: target},
		{Path: link},
	}})
	if len(got) != 1 {
		t.Fatalf("recents returned %d entries for one workspace: %#v", len(got), got)
	}
	if got[0].Name != "real" {
		t.Fatalf("recent name = %q, want real", got[0].Name)
	}
}
