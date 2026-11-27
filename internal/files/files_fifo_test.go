//go:build darwin || linux

package files

import (
	"path/filepath"
	"strings"
	"syscall"
	"testing"
)

func TestReadRejectsNonRegularFile(t *testing.T) {
	workspace := t.TempDir()
	path := filepath.Join(workspace, "pipe")
	if err := syscall.Mkfifo(path, 0o600); err != nil {
		t.Skipf("mkfifo unavailable: %v", err)
	}
	if _, err := New().Read(workspace, "pipe", 0); err == nil || !strings.Contains(err.Error(), "regular") {
		t.Fatalf("want a regular-file error, got %v", err)
	}
}
