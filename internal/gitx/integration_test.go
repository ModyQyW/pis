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

func TestWorktreeLifecycle(t *testing.T) {
	if _, err := exec.LookPath("git"); err != nil {
		t.Skip("git not installed")
	}
	dir := t.TempDir()
	git(t, dir, "init", "-q", "-b", "main")
	if err := os.WriteFile(filepath.Join(dir, "a.txt"), []byte("one\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	git(t, dir, "add", "a.txt")
	git(t, dir, "commit", "-qm", "init")

	linked := filepath.Join(t.TempDir(), "linked")
	if err := New().AddWorktree(context.Background(), dir, linked, "feature", true); err != nil {
		t.Fatal(err)
	}
	list, err := New().Worktrees(context.Background(), dir)
	if err != nil {
		t.Fatal(err)
	}
	if len(list) != 2 {
		t.Fatalf("worktrees = %#v", list)
	}
	linkedCanonical, err := filepath.EvalSymlinks(linked)
	if err != nil {
		t.Fatal(err)
	}
	found := false
	for _, wt := range list {
		if wt.Path == linkedCanonical && wt.Branch == "feature" {
			found = true
		}
	}
	if !found {
		t.Fatalf("linked worktree missing: %#v", list)
	}
	if err := New().RemoveWorktree(context.Background(), dir, linked, true); err != nil {
		t.Fatal(err)
	}
	list, err = New().Worktrees(context.Background(), dir)
	if err != nil {
		t.Fatal(err)
	}
	if len(list) != 1 {
		t.Fatalf("after remove = %#v", list)
	}
}

func TestRevertTrackedPath(t *testing.T) {
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
	if err := os.WriteFile(filepath.Join(dir, "a.txt"), []byte("changed\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	git(t, dir, "add", "a.txt")
	if err := New().Revert(context.Background(), dir, "a.txt"); err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(filepath.Join(dir, "a.txt"))
	if err != nil {
		t.Fatal(err)
	}
	if string(data) != "one\n" {
		t.Fatalf("file = %q", data)
	}
	status, err := New().Status(context.Background(), dir)
	if err != nil {
		t.Fatal(err)
	}
	if len(status.Files) != 0 {
		t.Fatalf("status after revert = %#v", status.Files)
	}
}
