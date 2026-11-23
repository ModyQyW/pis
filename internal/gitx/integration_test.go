package gitx

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func git(t *testing.T, dir string, args ...string) {
	t.Helper()
	cmd := exec.Command("git", append([]string{"-C", dir}, args...)...)
	cmd.Env = append(os.Environ(), "GIT_AUTHOR_NAME=t", "GIT_AUTHOR_EMAIL=t@t", "GIT_COMMITTER_NAME=t", "GIT_COMMITTER_EMAIL=t@t")
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("git %v: %v %s", args, err, out)
	}
}

func TestStatusAndDiffRealRepo(t *testing.T) {
	if _, err := exec.LookPath("git"); err != nil {
		t.Skip("git not installed")
	}
	dir := t.TempDir()
	git(t, dir, "init", "-q")
	if err := os.WriteFile(filepath.Join(dir, "a.txt"), []byte("one\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	git(t, dir, "add", "a.txt")
	git(t, dir, "commit", "-qm", "init")
	if err := os.WriteFile(filepath.Join(dir, "a.txt"), []byte("one\ntwo\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "new.txt"), []byte("hello\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	st, err := New().Status(context.Background(), dir)
	if err != nil {
		t.Fatal(err)
	}
	if !st.IsRepo || len(st.Files) != 2 {
		t.Fatalf("status: %+v", st)
	}
	var modified, untracked bool
	for _, f := range st.Files {
		if f.Path == "a.txt" && f.Status == "M" && f.Additions == 1 {
			modified = true
		}
		if f.Path == "new.txt" && f.Status == "??" && f.Additions == 1 {
			untracked = true
		}
	}
	if !modified || !untracked {
		t.Fatalf("files: %+v", st.Files)
	}
	diff, err := New().Diff(context.Background(), dir, "a.txt")
	if err != nil || !strings.Contains(diff, "+two") {
		t.Fatalf("diff: %q %v", diff, err)
	}
	diff, err = New().Diff(context.Background(), dir, "new.txt")
	if err != nil || !strings.Contains(diff, "+hello") {
		t.Fatalf("untracked diff: %q %v", diff, err)
	}
}
