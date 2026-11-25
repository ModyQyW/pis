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
		c.CodeFontSize = 999
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
	if cfg.CodeFontSize < 10 || cfg.CodeFontSize > 22 {
		t.Fatalf("merge should clamp code font size, got %d", cfg.CodeFontSize)
	}
}

func TestSendOnEnterDefaultsForOldFile(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "settings.json"), []byte(`{"version":1,"theme":"dark"}`), 0o600); err != nil {
		t.Fatal(err)
	}
	store, err := Open(dir)
	if err != nil {
		t.Fatal(err)
	}
	cfg := store.Snapshot()
	if !cfg.SendOnEnter {
		t.Fatal("a version 1 file must keep Enter as the send key")
	}
	if cfg.Version != Version {
		t.Fatalf("version = %d, want %d", cfg.Version, Version)
	}
}

func TestLanguageValidation(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "settings.json"), []byte(`{"language":"zh"}`), 0o600); err != nil {
		t.Fatal(err)
	}
	store, err := Open(dir)
	if err != nil {
		t.Fatal(err)
	}
	if got := store.Snapshot().Language; got != "zh" {
		t.Fatalf("language = %q, want zh", got)
	}
	if err := store.Update(func(c *Settings) error {
		c.Language = "fr"
		return nil
	}); err != nil {
		t.Fatal(err)
	}
	again, err := Open(dir)
	if err != nil {
		t.Fatal(err)
	}
	if got := again.Snapshot().Language; got != "en" {
		t.Fatalf("invalid language = %q, want en", got)
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
