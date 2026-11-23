package sessions

import (
	"os"
	"path/filepath"
	"testing"
)

func TestAllowedPath(t *testing.T) {
	base := t.TempDir()
	t.Setenv("PI_CODING_AGENT_SESSION_DIR", base)
	file := filepath.Join(base, "x.jsonl")
	if err := os.WriteFile(file, []byte("{}\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if !AllowedPath(file) {
		t.Fatal("session file should be allowed")
	}
	outside := filepath.Join(t.TempDir(), "x.jsonl")
	if err := os.WriteFile(outside, []byte("{}\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if AllowedPath(outside) {
		t.Fatal("outside file should be rejected")
	}
	if AllowedPath(filepath.Join(base, "x.txt")) {
		t.Fatal("non-jsonl should be rejected")
	}
}
