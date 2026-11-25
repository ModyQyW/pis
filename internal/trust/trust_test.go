package trust

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"pis/internal/settings"
)

func TestInspectResourcesAndAppDecision(t *testing.T) {
	dir := t.TempDir()
	if err := os.MkdirAll(filepath.Join(dir, ".pi", "extensions"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, ".pi", "extensions", "x.ts"), []byte("x"), 0o600); err != nil {
		t.Fatal(err)
	}
	info := Inspect(dir, t.TempDir(), map[string]settings.TrustDecision{dir: settings.TrustTrusted})
	if !info.RequiresTrust || info.Source != "app" || !info.Effective {
		t.Fatalf("unexpected: %+v", info)
	}
	info = Inspect(dir, t.TempDir(), map[string]settings.TrustDecision{dir: settings.TrustUntrusted})
	if info.Effective || info.Decision != "untrusted" {
		t.Fatalf("unexpected: %+v", info)
	}
}

func TestInspectHonorsPiAncestor(t *testing.T) {
	root := t.TempDir()
	project := filepath.Join(root, "project")
	sub := filepath.Join(project, "sub")
	if err := os.MkdirAll(sub, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(sub, "SYSTEM.md"), []byte("x"), 0o600); err != nil {
		t.Fatal(err)
	}
	agent := t.TempDir()
	trustFile := filepath.Join(agent, "trust.json")
	if err := os.WriteFile(trustFile, []byte(`{"`+project+`":true}`), 0o600); err != nil {
		t.Fatal(err)
	}
	info := Inspect(sub, agent, nil)
	if info.Source != "pi" || !info.Effective {
		t.Fatalf("unexpected: %+v", info)
	}
}

func TestInspectRequiresTrustForAncestorSkills(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	root := t.TempDir()
	if err := os.MkdirAll(filepath.Join(root, ".agents", "skills", "example"), 0o755); err != nil {
		t.Fatal(err)
	}
	sub := filepath.Join(root, "packages", "app")
	if err := os.MkdirAll(sub, 0o755); err != nil {
		t.Fatal(err)
	}
	info := Inspect(sub, t.TempDir(), nil)
	if !info.RequiresTrust {
		t.Fatalf("ancestor skills must require trust: %+v", info)
	}
	found := false
	for _, resource := range info.Resources {
		if strings.Contains(resource, ".agents/skills") {
			found = true
		}
	}
	if !found {
		t.Fatalf("resources = %v", info.Resources)
	}
}

func TestInspectIgnoresUserSkillsAtHome(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	if err := os.MkdirAll(filepath.Join(home, ".agents", "skills", "example"), 0o755); err != nil {
		t.Fatal(err)
	}
	info := Inspect(home, t.TempDir(), nil)
	if info.RequiresTrust {
		t.Fatalf("the user's own skills are global: %+v", info)
	}
}
