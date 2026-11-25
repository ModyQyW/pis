// Package mcp reads and edits pi's mcp.json files. It never connects to a
// server; pi owns connections and OAuth. The app only manages configuration.
package mcp

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"pis/internal/sessions"
)

// Service is the bound MCP configuration API.
type Service struct{}

// New creates an MCP configuration service.
func New() *Service { return &Service{} }

func (s *Service) List(workspace string) ([]Server, error) { return List(workspace) }
func (s *Service) SetEnabled(workspace, name string, enabled, local bool) error {
	return SetEnabled(workspace, name, enabled, local)
}
func (s *Service) Remove(workspace, name string, local bool) error {
	return Remove(workspace, name, local)
}
func (s *Service) Add(workspace string, req AddRequest) error { return Add(workspace, req) }

// Server is one merged MCP entry as the settings UI needs it.
type Server struct {
	Name        string   `json:"name"`
	Source      string   `json:"source"`
	Kind        string   `json:"kind"` // stdio or http
	Command     string   `json:"command,omitempty"`
	Args        []string `json:"args,omitempty"`
	URL         string   `json:"url,omitempty"`
	Description string   `json:"description,omitempty"`
	Exposure    string   `json:"exposure,omitempty"`
	Enabled     bool     `json:"enabled"`
}

// AddRequest creates a simple server entry. Environment, headers, OAuth, and
// per-tool exposure remain editable in mcp.json when a server needs them.
type AddRequest struct {
	Name        string   `json:"name"`
	Command     string   `json:"command,omitempty"`
	Args        []string `json:"args,omitempty"`
	URL         string   `json:"url,omitempty"`
	Description string   `json:"description,omitempty"`
	Local       bool     `json:"local"`
}

// configFile keeps the whole document so a write preserves top-level keys
// this app does not know about.
type configFile struct {
	doc     map[string]json.RawMessage
	Servers map[string]json.RawMessage
}

type entry struct {
	Type        string          `json:"type"`
	Command     string          `json:"command"`
	Args        []string        `json:"args"`
	URL         string          `json:"url"`
	Description string          `json:"description"`
	Exposure    string          `json:"exposure"`
	Enabled     *bool           `json:"enabled"`
	Raw         json.RawMessage `json:"-"`
}

// Paths returns the user and project mcp.json paths for a workspace.
func Paths(workspace string) (user, project string, err error) {
	agentDir := sessions.AgentDir()
	if agentDir == "" {
		return "", "", errors.New("pi agent directory is unavailable")
	}
	abs, err := filepath.Abs(workspace)
	if err != nil {
		return "", "", err
	}
	return filepath.Join(agentDir, "mcp.json"), filepath.Join(abs, ".pi", "mcp.json"), nil
}

// List merges user and project entries. A project entry replaces a user entry
// with the same name, except that an override without command/url/type keeps
// the user entry's transport fields.
func List(workspace string) ([]Server, error) {
	userPath, projectPath, err := Paths(workspace)
	if err != nil {
		return nil, err
	}
	user, err := readConfig(userPath)
	if err != nil {
		return nil, err
	}
	project, err := readConfig(projectPath)
	if err != nil {
		return nil, err
	}
	merged := map[string]Server{}
	for name, raw := range user.Servers {
		merged[name] = serverFrom(name, "user", raw, nil)
	}
	for name, raw := range project.Servers {
		base, ok := merged[name]
		if !ok {
			merged[name] = serverFrom(name, "project", raw, nil)
			continue
		}
		merged[name] = serverFrom(name, "project", raw, &base)
	}
	out := make([]Server, 0, len(merged))
	for _, server := range merged {
		out = append(out, server)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out, nil
}

// SetEnabled updates only the enabled field of an entry. A local override may
// be created when the server itself is defined at user level.
func SetEnabled(workspace, name string, enabled, local bool) error {
	path, err := targetPath(workspace, local)
	if err != nil {
		return err
	}
	cfg, err := readConfig(path)
	if err != nil {
		return err
	}
	raw, ok := cfg.Servers[name]
	if !ok && !local {
		return fmt.Errorf("MCP server %q not found", name)
	}
	var fields map[string]json.RawMessage
	if ok {
		if err := json.Unmarshal(raw, &fields); err != nil {
			return fmt.Errorf("MCP server %q: %w", name, err)
		}
	}
	if fields == nil {
		fields = map[string]json.RawMessage{}
	}
	value, _ := json.Marshal(enabled)
	fields["enabled"] = value
	updated, err := json.Marshal(fields)
	if err != nil {
		return err
	}
	cfg.Servers[name] = updated
	return writeConfig(path, cfg)
}

// Remove deletes a server from the selected file.
func Remove(workspace, name string, local bool) error {
	path, err := targetPath(workspace, local)
	if err != nil {
		return err
	}
	cfg, err := readConfig(path)
	if err != nil {
		return err
	}
	if _, ok := cfg.Servers[name]; !ok {
		return fmt.Errorf("MCP server %q not found", name)
	}
	delete(cfg.Servers, name)
	return writeConfig(path, cfg)
}

// Add creates a stdio or HTTP server entry in the selected file.
func Add(workspace string, req AddRequest) error {
	name := strings.TrimSpace(req.Name)
	if !validName(name) {
		return errors.New("server name may contain letters, digits, _ and - only")
	}
	path, err := targetPath(workspace, req.Local)
	if err != nil {
		return err
	}
	cfg, err := readConfig(path)
	if err != nil {
		return err
	}
	if _, exists := cfg.Servers[name]; exists {
		return fmt.Errorf("MCP server %q already exists", name)
	}
	fields := map[string]any{}
	if strings.TrimSpace(req.URL) != "" {
		fields["url"] = strings.TrimSpace(req.URL)
	} else {
		command := strings.TrimSpace(req.Command)
		if command == "" {
			return errors.New("a command or URL is required")
		}
		fields["command"] = command
		if len(req.Args) > 0 {
			fields["args"] = req.Args
		}
	}
	if desc := strings.TrimSpace(req.Description); desc != "" {
		fields["description"] = desc
	}
	raw, err := json.Marshal(fields)
	if err != nil {
		return err
	}
	cfg.Servers[name] = raw
	return writeConfig(path, cfg)
}

func targetPath(workspace string, local bool) (string, error) {
	user, project, err := Paths(workspace)
	if err != nil {
		return "", err
	}
	if local {
		return project, nil
	}
	return user, nil
}

func readConfig(path string) (configFile, error) {
	cfg := configFile{doc: map[string]json.RawMessage{}, Servers: map[string]json.RawMessage{}}
	data, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return cfg, nil
	}
	if err != nil {
		return cfg, err
	}
	if err := json.Unmarshal(data, &cfg.doc); err != nil {
		return cfg, fmt.Errorf("%s: %w", path, err)
	}
	if cfg.doc == nil {
		cfg.doc = map[string]json.RawMessage{}
	}
	if raw, ok := cfg.doc["mcpServers"]; ok {
		if err := json.Unmarshal(raw, &cfg.Servers); err != nil {
			return cfg, fmt.Errorf("%s: %w", path, err)
		}
	}
	if cfg.Servers == nil {
		cfg.Servers = map[string]json.RawMessage{}
	}
	return cfg, nil
}

func writeConfig(path string, cfg configFile) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	servers, err := json.Marshal(cfg.Servers)
	if err != nil {
		return err
	}
	if cfg.doc == nil {
		cfg.doc = map[string]json.RawMessage{}
	}
	cfg.doc["mcpServers"] = servers
	data, err := json.MarshalIndent(cfg.doc, "", "  ")
	if err != nil {
		return err
	}
	data = append(data, '\n')
	tmp, err := os.CreateTemp(filepath.Dir(path), ".mcp-*.json")
	if err != nil {
		return err
	}
	tmpName := tmp.Name()
	defer os.Remove(tmpName)
	if err := tmp.Chmod(0o600); err != nil {
		tmp.Close()
		return err
	}
	if _, err := tmp.Write(data); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	return os.Rename(tmpName, path)
}

func serverFrom(name, source string, raw json.RawMessage, base *Server) Server {
	out := Server{Name: name, Source: source, Enabled: true}
	if base != nil {
		out = *base
		out.Source = source
	}
	var e entry
	if err := json.Unmarshal(raw, &e); err != nil {
		out.Description = "invalid entry"
		return out
	}
	if e.Command != "" {
		out.Kind = "stdio"
		out.Command = e.Command
		out.Args = e.Args
		out.URL = ""
	} else if e.URL != "" {
		out.Kind = "http"
		out.URL = e.URL
		out.Command = ""
		out.Args = nil
	} else if e.Type != "" {
		out.Kind = e.Type
	}
	if e.Description != "" {
		out.Description = e.Description
	}
	if e.Exposure != "" {
		out.Exposure = e.Exposure
	}
	if e.Enabled != nil {
		out.Enabled = *e.Enabled
	}
	return out
}

func validName(name string) bool {
	if name == "" {
		return false
	}
	for _, r := range name {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '_' || r == '-' {
			continue
		}
		return false
	}
	return true
}
