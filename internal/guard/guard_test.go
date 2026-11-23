package guard

import (
	"os"
	"path/filepath"
	"testing"
)

func TestDetectedFromSettings(t *testing.T) {
	dir := t.TempDir()
	settings := `{"packages":["npm:pi-subagents","npm:cc-safety-net"]}`
	if err := os.WriteFile(filepath.Join(dir, "settings.json"), []byte(settings), 0o600); err != nil {
		t.Fatal(err)
	}
	got := Detected(dir)
	if len(got) != 1 || got[0] != "cc-safety-net" {
		t.Fatalf("got %v", got)
	}
}
