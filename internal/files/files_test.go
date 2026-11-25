package files

import (
	"os"
	"path/filepath"
	"testing"
)

func TestRankPrefersBasenamePrefix(t *testing.T) {
	base := "src/cache/watch.ts"
	other := "docs/rewatch-guide.md"
	if rank(base, "watch") <= rank(other, "watch") {
		t.Fatalf("expected basename watch match to rank higher: %d vs %d", rank(base, "watch"), rank(other, "watch"))
	}
	if rank("src/cache/watcher.ts", "watch") <= 0 {
		t.Fatal("want a match")
	}
	if rank("src/cache/watch.ts", "zzz") != 0 {
		t.Fatal("unexpected match")
	}
}

func TestReadStaysInsideWorkspaceAfterSymlinks(t *testing.T) {
	workspace := t.TempDir()
	outside := filepath.Join(t.TempDir(), "secret.txt")
	if err := os.WriteFile(outside, []byte("secret"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(outside, filepath.Join(workspace, "escape")); err != nil {
		t.Skipf("symlinks unavailable: %v", err)
	}
	if _, err := New().Read(workspace, "escape", 0); err == nil {
		t.Fatal("reading a symlink outside the workspace must fail")
	}

	if err := os.WriteFile(filepath.Join(workspace, "real.txt"), []byte("real"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(filepath.Join(workspace, "real.txt"), filepath.Join(workspace, "alias")); err != nil {
		t.Fatal(err)
	}
	view, err := New().Read(workspace, "alias", 0)
	if err != nil {
		t.Fatal(err)
	}
	if view.Text != "real" {
		t.Fatalf("text = %q", view.Text)
	}
}
