package settings

import (
	"os"
	"path/filepath"
	"testing"
)

func TestOpenMissingUsesDefaults(t *testing.T) {
	dir := t.TempDir()
	store, err := Open(dir)
	if err != nil {
		t.Fatal(err)
	}
	cfg := store.Snapshot()
	if cfg.Theme != ThemeSystem || cfg.Permissions.Policy != PolicySmart {
		t.Fatalf("unexpected defaults: %+v", cfg)
	}
	if _, err := os.Stat(filepath.Join(dir, "settings.json")); !os.IsNotExist(err) {
		t.Fatalf("Open wrote a file without an update: %v", err)
	}
}

func TestCorruptFileKeepsDefaultsAndReports(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "settings.json"), []byte("{"), 0o600); err != nil {
		t.Fatal(err)
	}
	store, err := Open(dir)
	if err == nil {
		t.Fatal("want load error")
	}
	if store.Snapshot().Theme != ThemeSystem {
		t.Fatal("corrupt file should fall back to defaults")
	}
}

func TestUpdateRoundTripAndValidation(t *testing.T) {
	dir := t.TempDir()
	store, err := Open(dir)
	if err != nil {
		t.Fatal(err)
	}
	if err := store.Update(func(c *Settings) error {
		c.Theme = ThemeDark
		c.SidebarWidth = 999
		c.Permissions.Policy = PolicyAsk
		return nil
	}); err != nil {
		t.Fatal(err)
	}
	again, err := Open(dir)
	if err != nil {
		t.Fatal(err)
	}
	cfg := again.Snapshot()
	if cfg.Theme != ThemeDark || cfg.Permissions.Policy != PolicyAsk {
		t.Fatalf("round trip lost values: %+v", cfg)
	}
	if cfg.SidebarWidth < 220 {
		t.Fatalf("merge should clamp width, got %d", cfg.SidebarWidth)
	}
}

func TestSnapshotCopiesMapsAndSlices(t *testing.T) {
	store := &Store{cfg: Defaults()}
	store.cfg.Trust["/x"] = TrustTrusted
	store.cfg.Recents = append(store.cfg.Recents, Recent{Path: "/x", Name: "x"})
	snap := store.Snapshot()
	snap.Trust["/x"] = TrustUntrusted
	snap.Recents[0].Name = "changed"
	if store.cfg.Trust["/x"] != TrustTrusted || store.cfg.Recents[0].Name != "x" {
		t.Fatal("Snapshot leaked mutable state")
	}
}
