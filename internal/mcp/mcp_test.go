package mcp

import (
	"encoding/json"
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

func TestAddRejectsExistingServer(t *testing.T) {
	agentDir := t.TempDir()
	t.Setenv("PI_CODING_AGENT_DIR", agentDir)
	workspace := t.TempDir()
	write(t, filepath.Join(agentDir, "mcp.json"), `{"mcpServers":{"docs":{"url":"https://example.com","headers":{"Authorization":"secret"}}}}`)

	err := Add(workspace, AddRequest{Name: "docs", Command: "npx"})
	if err == nil {
		t.Fatal("adding an existing server must fail")
	}
	servers, err := List(workspace)
	if err != nil {
		t.Fatal(err)
	}
	if len(servers) != 1 || servers[0].URL != "https://example.com" {
		t.Fatalf("existing entry was replaced: %#v", servers)
	}
}

func TestWritePreservesUnknownTopLevelKeys(t *testing.T) {
	agentDir := t.TempDir()
	t.Setenv("PI_CODING_AGENT_DIR", agentDir)
	workspace := t.TempDir()
	path := filepath.Join(agentDir, "mcp.json")
	write(t, path, `{"mcpServers":{"docs":{"url":"https://example.com"}},"custom":{"keep":true}}`)

	if err := SetEnabled(workspace, "docs", false, false); err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	var doc map[string]json.RawMessage
	if err := json.Unmarshal(data, &doc); err != nil {
		t.Fatal(err)
	}
	if _, ok := doc["custom"]; !ok {
		t.Fatalf("unknown top-level key was dropped: %s", data)
	}
	var servers map[string]struct {
		Enabled *bool `json:"enabled"`
	}
	if err := json.Unmarshal(doc["mcpServers"], &servers); err != nil {
		t.Fatal(err)
	}
	if servers["docs"].Enabled == nil || *servers["docs"].Enabled {
		t.Fatalf("enabled did not persist: %s", data)
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

func TestListWithoutWorkspaceReturnsUserServers(t *testing.T) {
	agentDir := t.TempDir()
	t.Setenv("PI_CODING_AGENT_DIR", agentDir)
	write(t, filepath.Join(agentDir, "mcp.json"), `{"mcpServers":{"docs":{"url":"https://example.com/mcp"}}}`)
	servers, err := List("")
	if err != nil {
		t.Fatal(err)
	}
	if len(servers) != 1 || servers[0].Name != "docs" || servers[0].Source != "user" {
		t.Fatalf("servers = %#v", servers)
	}
}

func TestListWithoutWorkspaceIgnoresLaunchProject(t *testing.T) {
	agentDir := t.TempDir()
	t.Setenv("PI_CODING_AGENT_DIR", agentDir)
	write(t, filepath.Join(agentDir, "mcp.json"), `{"mcpServers":{"docs":{"url":"https://example.com/mcp"}}}`)
	cwd := t.TempDir()
	write(t, filepath.Join(cwd, ".pi", "mcp.json"), `{"mcpServers":{"project":{"command":"tool"}}}`)
	t.Chdir(cwd)
	servers, err := List("")
	if err != nil {
		t.Fatal(err)
	}
	if len(servers) != 1 || servers[0].Name != "docs" || servers[0].Source != "user" {
		t.Fatalf("servers = %#v", servers)
	}
}

func TestWriteKeepsDanglingSymlink(t *testing.T) {
	agentDir := t.TempDir()
	t.Setenv("PI_CODING_AGENT_DIR", agentDir)
	target := filepath.Join(t.TempDir(), "mcp.json")
	link := filepath.Join(agentDir, "mcp.json")
	if err := os.Symlink(target, link); err != nil {
		t.Skipf("symlink not available: %v", err)
	}
	if err := Add("", AddRequest{Name: "docs", Command: "tool"}); err != nil {
		t.Fatal(err)
	}
	info, err := os.Lstat(link)
	if err != nil || info.Mode()&os.ModeSymlink == 0 {
		t.Fatalf("the link must stay a symlink: %v %v", info, err)
	}
	if _, err := os.Stat(target); err != nil {
		t.Fatalf("the target must be created: %v", err)
	}
}
