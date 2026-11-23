package bridge

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestEnsureWritesVersionedExtension(t *testing.T) {
	dir := t.TempDir()
	path, err := Ensure(dir)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(path, "pis-bridge-"+Version+".ts") {
		t.Fatalf("path = %s", path)
	}
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(data), "pis-navigate") || !strings.Contains(string(data), "pis-plan") {
		t.Fatal("bridge source missing commands")
	}
	if strings.Contains(string(data), "mygo-") {
		t.Fatal("bridge source still uses the old namespace")
	}
	old := filepath.Join(dir, "extensions", "pis-bridge-0.ts")
	if err := os.WriteFile(old, []byte("old"), 0o600); err != nil {
		t.Fatal(err)
	}
	legacy := filepath.Join(dir, "extensions", "mygo-bridge-0.ts")
	if err := os.WriteFile(legacy, []byte("old"), 0o600); err != nil {
		t.Fatal(err)
	}
	again, err := Ensure(dir)
	if err != nil || again != path {
		t.Fatalf("second ensure: %q %v", again, err)
	}
	if _, err := os.Stat(old); !os.IsNotExist(err) {
		t.Fatal("old bridge version was not removed")
	}
	if _, err := os.Stat(legacy); !os.IsNotExist(err) {
		t.Fatal("legacy bridge was not removed")
	}
}

func TestEnsureRejectsEmptyDir(t *testing.T) {
	if _, err := Ensure(""); err == nil {
		t.Fatal("want error")
	}
	_ = filepath.Separator
}
