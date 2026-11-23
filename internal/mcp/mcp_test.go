package mcp

import (
	"os"
	"path/filepath"
	"testing"
)

func TestListMergesProjectOverride(t *testing.T) {
	agentDir := t.TempDir()
	t.Setenv("PI_CODING_AGENT_DIR", agentDir)
	workspace := t.TempDir()
	write(t, filepath.Join(agentDir, "mcp.json"), `{
  "mcpServers": {
    "docs": {"url": "https://example.com/mcp", "description": "Docs"},
    "local": {"command": "npx", "args": ["-y", "tool"]}
  }
}`)
	write(t, filepath.Join(workspace, ".pi", "mcp.json"), `{
  "mcpServers": {
    "docs": {"enabled": false},
    "project": {"command": "uvx", "args": ["project-tool"]}
  }
}`)

	servers, err := List(workspace)
	if err != nil {
		t.Fatal(err)
	}
	if len(servers) != 3 {
		t.Fatalf("servers = %#v", servers)
	}
	if servers[0].Name != "docs" || servers[0].Enabled || servers[0].URL != "https://example.com/mcp" {
		t.Fatalf("docs merge = %#v", servers[0])
	}
	if servers[1].Name != "local" || !servers[1].Enabled || servers[1].Kind != "stdio" {
		t.Fatalf("local = %#v", servers[1])
	}
	if servers[2].Name != "project" || servers[2].Source != "project" {
		t.Fatalf("project = %#v", servers[2])
	}
}

func TestAddSetEnabledRemove(t *testing.T) {
	agentDir := t.TempDir()
	t.Setenv("PI_CODING_AGENT_DIR", agentDir)
	workspace := t.TempDir()

	if err := Add(workspace, AddRequest{
		Name:    "docs",
		Command: "npx",
		Args:    []string{"-y", "server"},
	}); err != nil {
		t.Fatal(err)
	}
	servers, err := List(workspace)
	if err != nil {
		t.Fatal(err)
	}
	if len(servers) != 1 || servers[0].Name != "docs" || !servers[0].Enabled {
		t.Fatalf("after add = %#v", servers)
	}
	if err := SetEnabled(workspace, "docs", false, false); err != nil {
		t.Fatal(err)
	}
	servers, _ = List(workspace)
	if servers[0].Enabled {
		t.Fatalf("enabled did not persist: %#v", servers[0])
	}
	if err := Remove(workspace, "docs", false); err != nil {
		t.Fatal(err)
	}
	servers, _ = List(workspace)
	if len(servers) != 0 {
		t.Fatalf("after remove = %#v", servers)
	}
}

func TestLocalOverrideForUserServer(t *testing.T) {
	agentDir := t.TempDir()
	t.Setenv("PI_CODING_AGENT_DIR", agentDir)
	workspace := t.TempDir()
	write(t, filepath.Join(agentDir, "mcp.json"), `{"mcpServers":{"docs":{"url":"https://example.com"}}}`)

	if err := SetEnabled(workspace, "docs", false, true); err != nil {
		t.Fatal(err)
	}
	servers, err := List(workspace)
	if err != nil {
		t.Fatal(err)
	}
	if len(servers) != 1 || servers[0].Enabled || servers[0].URL != "https://example.com" {
		t.Fatalf("override = %#v", servers)
	}
}

func write(t *testing.T, path, content string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatal(err)
	}
}
