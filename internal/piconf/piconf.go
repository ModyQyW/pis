// Package piconf reads and edits pi's user configuration: settings.json
// (defaults and resources) and models.json (providers and models). It writes
// only on explicit user actions, keeps unknown fields, and never returns a
// stored API key.
package piconf

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"pis/internal/jsonx"
	"pis/internal/mcp"
	"pis/internal/piinfo"
	"pis/internal/sessions"
	"pis/internal/settings"
	"pis/internal/trust"
)

// Service is the bound pi configuration API.
type Service struct {
	store *settings.Store
}

// New creates a pi configuration service.
func New(store *settings.Store) *Service { return &Service{store: store} }

func agentDir() (string, error) {
	dir := sessions.AgentDir()
	if dir == "" {
		return "", errors.New("pi's agent directory is not known")
	}
	return dir, nil
}

// Defaults are pi's startup model choices.
type Defaults struct {
	Provider string `json:"provider,omitempty"`
	Model    string `json:"model,omitempty"`
	Thinking string `json:"thinking,omitempty"`
}

// Provider is one entry in models.json. APIKeySet reports a stored key; the
// key itself is never sent to the page.
type Provider struct {
	ID        string          `json:"id"`
	Name      string          `json:"name,omitempty"`
	API       string          `json:"api,omitempty"`
	BaseURL   string          `json:"baseUrl,omitempty"`
	APIKeySet bool            `json:"apiKeySet"`
	APIKeyEnv bool            `json:"apiKeyEnv,omitempty"`
	Models    []ProviderModel `json:"models"`
}

// ProviderModel is one model under a configured provider.
type ProviderModel struct {
	ID            string `json:"id"`
	Name          string `json:"name,omitempty"`
	ContextWindow int    `json:"contextWindow,omitempty"`
	MaxTokens     int    `json:"maxTokens,omitempty"`
	Reasoning     bool   `json:"reasoning"`
}

// ProviderInput is a create or edit request. An empty APIKey keeps the stored
// key; ClearAPIKey removes it.
type ProviderInput struct {
	ID       string          `json:"id"`
	Create   bool            `json:"create"`
	Name     string          `json:"name"`
	API      string          `json:"api"`
	BaseURL  string          `json:"baseUrl"`
	APIKey   string          `json:"apiKey"`
	ClearKey bool            `json:"clearKey"`
	Models   []ProviderModel `json:"models"`
}

// Resource is a skill or extension pi can load.
type Resource struct {
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	Path        string `json:"path"`
	Source      string `json:"source"` // user | project | agents | configured
	Project     bool   `json:"project,omitempty"`
	Active      bool   `json:"active"`
	// Ref is the exact settings.json entry that created a configured resource.
	// Path may be resolved; removing must target Ref.
	Ref string `json:"ref,omitempty"`
}

// Package is one configured pi package source.
type Package struct {
	Source  string `json:"source"`
	Project bool   `json:"project"`
	Active  bool   `json:"active"`
}

// Snapshot is the configuration shown in the page.
type Snapshot struct {
	AgentDir   string       `json:"agentDir"`
	Defaults   Defaults     `json:"defaults"`
	Providers  []Provider   `json:"providers"`
	Skills     []Resource   `json:"skills"`
	Extensions []Resource   `json:"extensions"`
	Packages   []Package    `json:"packages"`
	MCP        []mcp.Server `json:"mcp"`
	Trusted    bool         `json:"trusted"`
	// ProjectDefaults is set when a trusted project overrides the startup
	// model. Defaults stay the user defaults that the dialog edits.
	ProjectDefaults *Defaults `json:"projectDefaults,omitempty"`
	Fingerprint     string    `json:"fingerprint"`
	Warnings        []string  `json:"warnings,omitempty"`
}

// AvailableModel is one row from `pi --list-models`.
type AvailableModel struct {
	Provider string `json:"provider"`
	ID       string `json:"id"`
	Context  string `json:"context,omitempty"`
}

// Inspect reads pi's user configuration and the workspace's project
// configuration. Before project trust, project-configured paths are listed
// without reading them; Active reports whether pi would load a resource.
func (s *Service) Inspect(workspace string) (Snapshot, error) {
	agentDir, err := agentDir()
	if err != nil {
		return Snapshot{}, err
	}
	snap := Snapshot{AgentDir: agentDir}
	user, warn := readObject(filepath.Join(agentDir, "settings.json"))
	if warn != nil {
		snap.Warnings = append(snap.Warnings, fmt.Sprintf("settings.json: %v", warn))
	}
	snap.Defaults = defaultsFrom(user)
	snap.Providers, snap.Warnings = providersFrom(filepath.Join(agentDir, "models.json"), snap.Warnings)

	ws := strings.TrimSpace(workspace)
	var project map[string]any
	trusted := false
	if ws != "" {
		abs, err := filepath.Abs(ws)
		if err == nil {
			ws = abs
			var decisions map[string]settings.TrustDecision
			if s.store != nil {
				decisions = s.store.Snapshot().Trust
			}
			trusted = trust.Inspect(ws, agentDir, decisions).Effective
			p, err := readObject(filepath.Join(ws, ".pi", "settings.json"))
			if err != nil {
				snap.Warnings = append(snap.Warnings, fmt.Sprintf(".pi/settings.json: %v", err))
			}
			project = p
		}
	}

	snap.Skills = discoverSkills(user, project, agentDir, ws, trusted)
	snap.Extensions = discoverExtensions(user, project, agentDir, ws, trusted)
	snap.Packages = packagesFrom(user, project, trusted)
	snap.Trusted = trusted
	if trusted && len(project) > 0 {
		overrides := defaultsFrom(project)
		if overrides.Provider != "" || overrides.Model != "" || overrides.Thinking != "" {
			snap.ProjectDefaults = &overrides
		}
	}
	if servers, err := mcp.List(ws); err != nil {
		snap.Warnings = append(snap.Warnings, fmt.Sprintf("mcp.json: %v", err))
	} else {
		snap.MCP = servers
	}
	snap.Fingerprint = fingerprint(snap)
	return snap, nil
}

// Models lists the models pi can use. It runs the installed pi, so the list
// includes built-in, configured, and signed-in providers.
func (s *Service) Models() ([]AvailableModel, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	cfg := settings.Settings{}
	if s.store != nil {
		cfg = s.store.Snapshot()
	}
	st := piinfo.Discover(ctx, cfg.PiPath)
	if !st.Found {
		if st.Error != "" {
			return nil, errors.New(st.Error)
		}
		return nil, errors.New("pi was not found")
	}
	dir, err := os.MkdirTemp("", "pis-models-")
	if err != nil {
		dir = os.TempDir()
	} else {
		defer os.RemoveAll(dir)
	}
	cmd := exec.CommandContext(ctx, st.Path, "--list-models")
	// List user-level models; a project .pi in the launch directory must not
	// change the list or load project extensions.
	cmd.Dir = dir
	out, err := cmd.Output()
	if err != nil {
		var exitErr *exec.ExitError
		if errors.As(err, &exitErr) && len(exitErr.Stderr) > 0 {
			return nil, fmt.Errorf("pi --list-models: %s", strings.TrimSpace(string(exitErr.Stderr)))
		}
		return nil, fmt.Errorf("pi --list-models: %w", err)
	}
	return parseModels(string(out)), nil
}

// SetDefaults writes pi's startup model choices. Empty values remove the key
// so pi falls back to its automatic choice.
func (s *Service) SetDefaults(provider, model, thinking string) error {
	provider = strings.TrimSpace(provider)
	model = strings.TrimSpace(model)
	thinking = strings.TrimSpace(thinking)
	if !validThinking(thinking) {
		return fmt.Errorf("unknown thinking level %q", thinking)
	}
	if len(provider) > 200 || len(model) > 200 {
		return errors.New("provider or model name is too long")
	}
	if (provider == "") != (model == "") {
		return errors.New("set both the default provider and model, or neither")
	}
	return s.updateSettings(func(root map[string]any) error {
		setOrDelete(root, "defaultProvider", provider)
		setOrDelete(root, "defaultModel", model)
		setOrDelete(root, "defaultThinkingLevel", thinking)
		return nil
	})
}

// SaveProvider creates or updates a provider in models.json.
func (s *Service) SaveProvider(in ProviderInput) error {
	in.ID = strings.TrimSpace(in.ID)
	in.Name = strings.TrimSpace(in.Name)
	in.API = strings.TrimSpace(in.API)
	in.BaseURL = strings.TrimSpace(in.BaseURL)
	in.APIKey = strings.TrimSpace(in.APIKey)
	if !validProviderID(in.ID) {
		return fmt.Errorf("invalid provider id %q", in.ID)
	}
	if len(in.Name) > 200 || len(in.API) > 80 || len(in.BaseURL) > 2048 || len(in.APIKey) > 8192 {
		return errors.New("provider field is too long")
	}
	if in.BaseURL != "" && !strings.HasPrefix(in.BaseURL, "http://") && !strings.HasPrefix(in.BaseURL, "https://") {
		return errors.New("base URL must start with http:// or https://")
	}
	if in.ClearKey && in.APIKey != "" {
		return errors.New("type a new key or remove the stored key, not both")
	}
	if len(in.Models) > 500 {
		return errors.New("too many models")
	}
	models := make([]ProviderModel, 0, len(in.Models))
	seen := map[string]bool{}
	for _, m := range in.Models {
		m.ID = strings.TrimSpace(m.ID)
		m.Name = strings.TrimSpace(m.Name)
		if m.ID == "" {
			return errors.New("every model needs an id")
		}
		if len(m.ID) > 200 || len(m.Name) > 200 {
			return fmt.Errorf("model %q has a long id or name", m.ID)
		}
		if seen[m.ID] {
			return fmt.Errorf("duplicate model %q", m.ID)
		}
		seen[m.ID] = true
		if m.ContextWindow < 0 || m.MaxTokens < 0 {
			return fmt.Errorf("model %q has a negative token count", m.ID)
		}
		models = append(models, m)
	}
	dir, err := agentDir()
	if err != nil {
		return err
	}
	path := filepath.Join(dir, "models.json")
	root, _, err := readModels(path)
	if err != nil {
		return err
	}
	rawProviders, ok := root["providers"]
	if !ok {
		rawProviders = map[string]any{}
		root["providers"] = rawProviders
	}
	providers, ok := rawProviders.(map[string]any)
	if !ok {
		return errors.New("models.json has an unexpected providers shape; edit it by hand")
	}
	entry, _ := providers[in.ID].(map[string]any)
	if in.Create && entry != nil {
		return fmt.Errorf("provider %q already exists", in.ID)
	}
	if entry == nil {
		if in.BaseURL == "" || len(models) == 0 {
			return errors.New("a new provider needs a base URL and at least one model")
		}
		entry = map[string]any{}
	}
	setOrDelete(entry, "name", in.Name)
	setOrDelete(entry, "api", in.API)
	setOrDelete(entry, "baseUrl", in.BaseURL)
	if in.APIKey != "" {
		entry["apiKey"] = in.APIKey
	}
	if in.ClearKey {
		delete(entry, "apiKey")
	}
	if len(models) > 0 {
		old := map[string]map[string]any{}
		if raw, exists := entry["models"]; exists {
			list, ok := raw.([]any)
			if !ok {
				return errors.New("models.json has an unexpected models shape; edit it by hand")
			}
			for _, item := range list {
				m, ok := item.(map[string]any)
				if !ok {
					return errors.New("models.json has an unexpected model entry; edit it by hand")
				}
				id, ok := m["id"].(string)
				if !ok || id == "" {
					return errors.New("models.json has a model without a string id; edit it by hand")
				}
				old[id] = m
			}
		}
		next := make([]any, 0, len(models))
		for _, m := range models {
			model := old[m.ID]
			if model == nil {
				model = map[string]any{}
			}
			model["id"] = m.ID
			setOrDelete(model, "name", m.Name)
			if m.ContextWindow > 0 {
				model["contextWindow"] = m.ContextWindow
			} else {
				delete(model, "contextWindow")
			}
			if m.MaxTokens > 0 {
				model["maxTokens"] = m.MaxTokens
			} else {
				delete(model, "maxTokens")
			}
			if m.Reasoning {
				model["reasoning"] = true
			} else {
				delete(model, "reasoning")
			}
			next = append(next, model)
		}
		entry["models"] = next
	} else {
		delete(entry, "models")
	}
	providers[in.ID] = entry
	root["providers"] = providers
	return writeObject(path, root)
}

// RemoveProvider deletes a provider from models.json.
func (s *Service) RemoveProvider(id string) error {
	id = strings.TrimSpace(id)
	if !validProviderID(id) {
		return fmt.Errorf("invalid provider id %q", id)
	}
	dir, err := agentDir()
	if err != nil {
		return err
	}
	path := filepath.Join(dir, "models.json")
	root, _, err := readModels(path)
	if err != nil {
		return err
	}
	raw, ok := root["providers"]
	if !ok {
		return nil
	}
	providers, ok := raw.(map[string]any)
	if !ok {
		return errors.New("models.json has an unexpected providers shape; edit it by hand")
	}
	delete(providers, id)
	root["providers"] = providers
	return writeObject(path, root)
}

// AddPath adds a skill or extension path to pi's user settings.
func (s *Service) AddPath(kind, path string) error {
	key, err := resourceKey(kind)
	if err != nil {
		return err
	}
	path = strings.TrimSpace(path)
	if path == "" || len(path) > 4096 || strings.ContainsAny(path, "\r\n") {
		return errors.New("invalid path")
	}
	return s.updateSettings(func(root map[string]any) error {
		list := resourcePaths(root, key)
		for _, item := range list {
			if item == path {
				return nil
			}
		}
		setResourcePaths(root, key, append(append([]string{}, list...), path))
		return nil
	})
}

// RemovePath removes a configured skill or extension path from user settings.
func (s *Service) RemovePath(kind, path string) error {
	key, err := resourceKey(kind)
	if err != nil {
		return err
	}
	path = strings.TrimSpace(path)
	if len(path) > 4096 {
		return errors.New("invalid path")
	}
	return s.updateSettings(func(root map[string]any) error {
		list := resourcePaths(root, key)
		next := make([]string, 0, len(list))
		for _, item := range list {
			if item != path {
				next = append(next, item)
			}
		}
		setResourcePaths(root, key, next)
		return nil
	})
}

// AddPackage adds a package source to pi's user settings.
func (s *Service) AddPackage(source string) error {
	source = strings.TrimSpace(source)
	if source == "" || len(source) > 1024 || strings.ContainsAny(source, "\r\n") {
		return errors.New("invalid package source")
	}
	return s.updateSettings(func(root map[string]any) error {
		list := packageEntries(root["packages"])
		for _, item := range list {
			if packageSource(item) == source {
				return nil
			}
		}
		root["packages"] = append(list, source)
		return nil
	})
}

// RemovePackage removes a package source from pi's user settings.
func (s *Service) RemovePackage(source string) error {
	source = strings.TrimSpace(source)
	return s.updateSettings(func(root map[string]any) error {
		list := packageEntries(root["packages"])
		next := make([]any, 0, len(list))
		for _, item := range list {
			if packageSource(item) != source {
				next = append(next, item)
			}
		}
		if len(next) == 0 {
			delete(root, "packages")
		} else {
			root["packages"] = next
		}
		return nil
	})
}

func (s *Service) updateSettings(fn func(map[string]any) error) error {
	dir, err := agentDir()
	if err != nil {
		return err
	}
	path := filepath.Join(dir, "settings.json")
	return withFileLock(path, func() error {
		root, _, err := readObjectStrict(path)
		if err != nil {
			return err
		}
		if err := fn(root); err != nil {
			return err
		}
		return writeObject(path, root)
	})
}

func resourcePaths(root map[string]any, key string) []string {
	switch value := root[key].(type) {
	case []any:
		return stringList(value)
	case map[string]any:
		if key == "skills" {
			return stringList(value["customDirectories"])
		}
	}
	return nil
}

func setResourcePaths(root map[string]any, key string, paths []string) {
	var list any
	if len(paths) > 0 {
		items := make([]any, 0, len(paths))
		for _, path := range paths {
			items = append(items, path)
		}
		list = items
	}
	if key == "skills" {
		if object, ok := root[key].(map[string]any); ok {
			if list == nil {
				delete(object, "customDirectories")
			} else {
				object["customDirectories"] = list
			}
			root[key] = object
			return
		}
	}
	if list == nil {
		delete(root, key)
	} else {
		root[key] = list
	}
}

func resourceKey(kind string) (string, error) {
	switch kind {
	case "skills":
		return "skills", nil
	case "extensions":
		return "extensions", nil
	}
	return "", fmt.Errorf("unknown resource kind %q", kind)
}

func defaultsFrom(root map[string]any) Defaults {
	return Defaults{
		Provider: stringValue(root["defaultProvider"]),
		Model:    stringValue(root["defaultModel"]),
		Thinking: stringValue(root["defaultThinkingLevel"]),
	}
}

func providersFrom(path string, warnings []string) ([]Provider, []string) {
	root, jsonc, warn := readModels(path)
	if warn != nil {
		warnings = append(warnings, fmt.Sprintf("models.json: %v", warn))
	}
	if jsonc {
		warnings = append(warnings, "models.json uses comments or trailing commas; saving from PiS writes plain JSON.")
	}
	raw, _ := root["providers"].(map[string]any)
	out := make([]Provider, 0, len(raw))
	for id, value := range raw {
		entry, _ := value.(map[string]any)
		if entry == nil {
			continue
		}
		p := Provider{
			ID:        id,
			Name:      stringValue(entry["name"]),
			API:       stringValue(entry["api"]),
			BaseURL:   stringValue(entry["baseUrl"]),
			APIKeySet: stringValue(entry["apiKey"]) != "",
			APIKeyEnv: strings.HasPrefix(stringValue(entry["apiKey"]), "$"),
		}
		if list, ok := entry["models"].([]any); ok {
			for _, item := range list {
				m, _ := item.(map[string]any)
				if m == nil {
					continue
				}
				id := stringValue(m["id"])
				if id == "" {
					continue
				}
				p.Models = append(p.Models, ProviderModel{
					ID:            id,
					Name:          stringValue(m["name"]),
					ContextWindow: intValue(m["contextWindow"]),
					MaxTokens:     intValue(m["maxTokens"]),
					Reasoning:     m["reasoning"] == true,
				})
			}
		}
		sort.Slice(p.Models, func(i, j int) bool { return p.Models[i].ID < p.Models[j].ID })
		out = append(out, p)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].ID < out[j].ID })
	return out, warnings
}

type sourceDir struct {
	path    string
	source  string
	active  bool
	ref     string
	project bool
}

func discoverSkills(user, project map[string]any, agentDir, ws string, trusted bool) []Resource {
	dirs := []sourceDir{{path: filepath.Join(agentDir, "skills"), source: "user", active: true}}
	if home, err := os.UserHomeDir(); err == nil {
		dirs = append(dirs, sourceDir{path: filepath.Join(home, ".agents", "skills"), source: "agents", active: true})
	}
	var unresolved []Resource
	if ws != "" {
		if trusted {
			dirs = append(dirs, sourceDir{path: filepath.Join(ws, ".pi", "skills"), source: "project", active: true, project: true})
			for current := ws; ; current = filepath.Dir(current) {
				dirs = append(dirs, sourceDir{path: filepath.Join(current, ".agents", "skills"), source: "project", active: true, project: true})
				if _, err := os.Stat(filepath.Join(current, ".git")); err == nil {
					break
				}
				parent := filepath.Dir(current)
				if parent == current {
					break
				}
			}
		} else {
			unresolved = configuredEntries(project, "skills", filepath.Join(ws, ".pi"))
		}
	}
	dirs = append(dirs, configuredDirs(user, "skills", agentDir, "configured", true, false)...)
	if ws != "" && trusted {
		dirs = append(dirs, configuredDirs(project, "skills", filepath.Join(ws, ".pi"), "configured", true, true)...)
	}
	out := skillsIn(dirs)
	return append(out, unresolved...)
}

func discoverExtensions(user, project map[string]any, agentDir, ws string, trusted bool) []Resource {
	dirs := []sourceDir{{path: filepath.Join(agentDir, "extensions"), source: "user", active: true}}
	var unresolved []Resource
	if ws != "" {
		if trusted {
			dirs = append(dirs, sourceDir{path: filepath.Join(ws, ".pi", "extensions"), source: "project", active: true, project: true})
		} else {
			unresolved = configuredEntries(project, "extensions", filepath.Join(ws, ".pi"))
		}
	}
	dirs = append(dirs, configuredDirs(user, "extensions", agentDir, "configured", true, false)...)
	if ws != "" && trusted {
		dirs = append(dirs, configuredDirs(project, "extensions", filepath.Join(ws, ".pi"), "configured", true, true)...)
	}
	out := extensionsIn(dirs)
	return append(out, unresolved...)
}

// shortcut: 500 entries bounds project-controlled lists; raise it if a real
// configuration grows beyond that.
func configuredDirs(root map[string]any, key, base, source string, active, project bool) []sourceDir {
	var out []sourceDir
	for _, raw := range resourcePaths(root, key) {
		if len(out) >= 500 {
			break
		}
		if key == "extensions" && skipExtensionEntry(raw) {
			continue
		}
		path := resolvePath(base, raw)
		if path == "" {
			continue
		}
		out = append(out, sourceDir{path: path, source: source, active: active, ref: raw, project: project})
	}
	return out
}

// configuredEntries lists project paths without resolving, stat, or walking
// them before the project is trusted. Removing is disabled because the entry
// belongs to the project, not the user's settings.
func configuredEntries(root map[string]any, key, base string) []Resource {
	var out []Resource
	for _, raw := range resourcePaths(root, key) {
		if len(out) >= 500 {
			break
		}
		if key == "extensions" && skipExtensionEntry(raw) {
			continue
		}
		path := resolvePath(base, raw)
		if path == "" {
			continue
		}
		out = append(out, Resource{
			Name:    filepath.Base(path),
			Path:    path,
			Source:  "configured",
			Project: true,
			Ref:     raw,
		})
	}
	return out
}

func skipExtensionEntry(raw string) bool {
	raw = strings.TrimSpace(raw)
	return strings.HasPrefix(raw, "builtin:") ||
		strings.HasPrefix(raw, "!") ||
		strings.HasPrefix(raw, "+") ||
		strings.HasPrefix(raw, "-")
}

func resolvePath(base, path string) string {
	path = strings.TrimSpace(path)
	if path == "" {
		return ""
	}
	if path == "~" {
		home, err := os.UserHomeDir()
		if err != nil {
			return ""
		}
		return home
	}
	if strings.HasPrefix(path, "~/") {
		home, err := os.UserHomeDir()
		if err != nil {
			return ""
		}
		return filepath.Join(home, path[2:])
	}
	if filepath.IsAbs(path) {
		return filepath.Clean(path)
	}
	return filepath.Join(base, path)
}

func skillsIn(dirs []sourceDir) []Resource {
	var out []Resource
	seen := map[string]bool{}
	for _, dir := range dirs {
		if len(out) >= 1000 {
			break
		}
		entries := skillFiles(dir.path)
		added := 0
		for _, skillPath := range entries {
			key := filepath.Clean(skillPath)
			if seen[key] {
				continue
			}
			skillFile := filepath.Join(skillPath, "SKILL.md")
			if info, err := os.Stat(skillPath); err == nil && !info.IsDir() {
				skillFile = skillPath
			}
			name, description := readSkill(skillFile)
			if description == "" {
				continue
			}
			seen[key] = true
			if name == "" {
				name = strings.TrimSuffix(filepath.Base(skillPath), filepath.Ext(skillPath))
			}
			added++
			out = append(out, Resource{
				Name:        name,
				Description: description,
				Path:        skillPath,
				Source:      dir.source,
				Project:     dir.project,
				Active:      dir.active,
				Ref:         dir.ref,
			})
		}
		if added == 0 && dir.ref != "" {
			key := filepath.Clean(dir.path)
			if !seen[key] {
				seen[key] = true
				out = append(out, Resource{
					Name:    filepath.Base(dir.path),
					Path:    dir.path,
					Source:  dir.source,
					Project: dir.project,
					Ref:     dir.ref,
				})
			}
		}
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Source != out[j].Source {
			return out[i].Source < out[j].Source
		}
		return out[i].Name < out[j].Name
	})
	return out
}

// shortcut: skill walks cap depth, visited roots, and rows; raise them if a
// real configuration exceeds these bounds.
func skillFiles(root string) []string {
	info, err := os.Stat(root)
	if err != nil {
		return nil
	}
	if !info.IsDir() {
		if filepath.Base(root) == "SKILL.md" {
			return []string{filepath.Dir(root)}
		}
		if strings.EqualFold(filepath.Ext(root), ".md") {
			return []string{root}
		}
		return nil
	}
	var out []string
	visited := map[string]bool{}
	var walk func(path string, depth int)
	walk = func(path string, depth int) {
		if depth > 8 || len(out) >= 500 {
			return
		}
		real, err := filepath.EvalSymlinks(path)
		if err != nil {
			real = path
		}
		if visited[real] {
			return
		}
		visited[real] = true
		info, err := os.Stat(path)
		if err != nil || !info.IsDir() {
			return
		}
		if _, err := os.Stat(filepath.Join(path, "SKILL.md")); err == nil {
			out = append(out, path)
			return
		}
		entries, err := os.ReadDir(path)
		if err != nil {
			return
		}
		for _, entry := range entries {
			if len(out) >= 500 {
				return
			}
			name := entry.Name()
			child := filepath.Join(path, name)
			if entry.IsDir() || entry.Type()&os.ModeSymlink != 0 {
				switch name {
				case "node_modules", ".git", "scripts", "references", "assets":
					continue
				}
				if entry.Type()&os.ModeSymlink != 0 {
					target, err := os.Stat(child)
					if err == nil && !target.IsDir() {
						if depth == 0 && strings.EqualFold(filepath.Ext(name), ".md") {
							out = append(out, child)
						}
						continue
					}
				}
				walk(child, depth+1)
				continue
			}
			if depth == 0 && strings.EqualFold(filepath.Ext(name), ".md") {
				out = append(out, child)
			}
		}
	}
	walk(root, 0)
	return out
}

func readSkill(path string) (string, string) {
	file, err := os.Open(path)
	if err != nil {
		return "", ""
	}
	defer file.Close()
	buf := make([]byte, 32*1024)
	n, _ := file.Read(buf)
	text := strings.TrimPrefix(strings.ReplaceAll(string(buf[:n]), "\r\n", "\n"), "\ufeff")
	lines := strings.Split(text, "\n")
	if len(lines) < 3 || strings.TrimSpace(lines[0]) != "---" {
		return "", ""
	}
	var name, description string
	for i := 1; i < len(lines); i++ {
		line := lines[i]
		if strings.TrimSpace(line) == "---" {
			break
		}
		key, value, ok := strings.Cut(line, ":")
		if !ok {
			continue
		}
		key = strings.TrimSpace(key)
		value = strings.TrimSpace(value)
		if strings.HasPrefix(value, ">") || strings.HasPrefix(value, "|") {
			var parts []string
			for i+1 < len(lines) && (strings.HasPrefix(lines[i+1], " ") || strings.HasPrefix(lines[i+1], "\t")) {
				i++
				parts = append(parts, strings.TrimSpace(lines[i]))
			}
			value = strings.Join(parts, " ")
		}
		value = strings.Trim(value, `"'`)
		switch key {
		case "name":
			name = value
		case "description":
			description = value
		}
	}
	if len([]rune(description)) > 280 {
		description = string([]rune(description)[:279]) + "…"
	}
	return name, description
}

func extensionsIn(dirs []sourceDir) []Resource {
	var out []Resource
	seen := map[string]bool{}
	add := func(path, name, source, ref string, project, active bool) {
		key := filepath.Clean(path)
		if seen[key] || len(out) >= 2000 {
			return
		}
		seen[key] = true
		out = append(out, Resource{
			Name:    name,
			Path:    path,
			Source:  source,
			Project: project,
			Active:  active,
			Ref:     ref,
		})
	}
	for _, dir := range dirs {
		info, err := os.Stat(dir.path)
		if err != nil {
			if dir.ref != "" {
				add(dir.path, filepath.Base(dir.path), dir.source, dir.ref, dir.project, false)
			}
			continue
		}
		if !info.IsDir() {
			valid := isExtensionFile(info.Name())
			if dir.ref == "" && !valid {
				continue
			}
			add(dir.path, strings.TrimSuffix(filepath.Base(dir.path), filepath.Ext(dir.path)), dir.source, dir.ref, dir.project, dir.active && valid)
			continue
		}
		if dir.ref != "" && isExtensionDir(dir.path) {
			add(dir.path, filepath.Base(dir.path), dir.source, dir.ref, dir.project, dir.active)
			continue
		}
		entries, err := os.ReadDir(dir.path)
		if err != nil {
			if dir.ref != "" {
				add(dir.path, filepath.Base(dir.path), dir.source, dir.ref, dir.project, false)
			}
			continue
		}
		added := 0
		for _, entry := range entries {
			if strings.HasPrefix(entry.Name(), ".") || added >= 500 {
				continue
			}
			path := filepath.Join(dir.path, entry.Name())
			name := strings.TrimSuffix(entry.Name(), filepath.Ext(entry.Name()))
			if entry.IsDir() {
				valid := isExtensionDir(path)
				if dir.ref == "" && !valid {
					continue
				}
				add(path, entry.Name(), dir.source, dir.ref, dir.project, dir.active && valid)
				added++
				continue
			}
			valid := isExtensionFile(entry.Name())
			if dir.ref == "" && !valid {
				continue
			}
			add(path, name, dir.source, dir.ref, dir.project, dir.active && valid)
			added++
		}
		if added == 0 && dir.ref != "" {
			add(dir.path, filepath.Base(dir.path), dir.source, dir.ref, dir.project, false)
		}
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Source != out[j].Source {
			return out[i].Source < out[j].Source
		}
		return out[i].Name < out[j].Name
	})
	return out
}

func isExtensionDir(path string) bool {
	for _, name := range []string{"index.ts", "index.js"} {
		if info, err := os.Stat(filepath.Join(path, name)); err == nil && !info.IsDir() {
			return true
		}
	}
	data, exists, err := jsonx.ReadFile(filepath.Join(path, "package.json"), 1<<20)
	if err != nil || !exists {
		return false
	}
	var manifest struct {
		Pi struct {
			Extensions any `json:"extensions"`
		} `json:"pi"`
	}
	if json.Unmarshal(data, &manifest) != nil {
		return false
	}
	return manifest.Pi.Extensions != nil
}

func isExtensionFile(name string) bool {
	switch strings.ToLower(filepath.Ext(name)) {
	case ".ts", ".js":
		return true
	}
	return false
}

func packagesFrom(user, project map[string]any, trusted bool) []Package {
	var out []Package
	for _, item := range packageEntries(user["packages"]) {
		if len(out) >= 500 {
			break
		}
		if source := packageSource(item); source != "" {
			out = append(out, Package{Source: source, Active: true})
		}
	}
	for _, item := range packageEntries(project["packages"]) {
		if len(out) >= 1000 {
			break
		}
		if source := packageSource(item); source != "" {
			out = append(out, Package{Source: source, Project: true, Active: trusted})
		}
	}
	return out
}

func packageEntries(value any) []any {
	if list, ok := value.([]any); ok {
		return list
	}
	return nil
}

func packageSource(value any) string {
	switch item := value.(type) {
	case string:
		return item
	case map[string]any:
		return stringValue(item["source"])
	}
	return ""
}

func parseModels(output string) []AvailableModel {
	var out []AvailableModel
	header := false
	for _, line := range strings.Split(output, "\n") {
		fields := strings.Fields(line)
		if len(fields) >= 2 && fields[0] == "provider" && fields[1] == "model" {
			header = true
			continue
		}
		if !header || len(fields) < 2 {
			continue
		}
		m := AvailableModel{Provider: fields[0], ID: fields[1]}
		if len(fields) > 2 {
			m.Context = fields[2]
		}
		out = append(out, m)
	}
	return out
}

func fingerprint(snap Snapshot) string {
	var b strings.Builder
	fmt.Fprintf(&b, "defaults|%s|%s|%s\n", snap.Defaults.Provider, snap.Defaults.Model, snap.Defaults.Thinking)
	for _, provider := range snap.Providers {
		fmt.Fprintf(&b, "provider|%s|%s|%s|%t", provider.ID, provider.API, provider.BaseURL, provider.APIKeySet)
		for _, model := range provider.Models {
			fmt.Fprintf(&b, "|%s", model.ID)
		}
		b.WriteByte('\n')
	}
	for _, list := range [][]Resource{snap.Skills, snap.Extensions} {
		for _, resource := range list {
			if resource.Project {
				continue
			}
			fmt.Fprintf(&b, "resource|%s\n", resource.Path)
		}
	}
	for _, pkg := range snap.Packages {
		if !pkg.Project {
			fmt.Fprintf(&b, "package|%s\n", pkg.Source)
		}
	}
	for _, server := range snap.MCP {
		if server.Source == "user" {
			fmt.Fprintf(&b, "mcp|%s|%t|%s|%s|%s|%s\n",
				server.Name, server.Enabled, server.Kind, server.URL, server.Command, strings.Join(server.Args, "\x00"))
		}
	}
	sum := sha256.Sum256([]byte(b.String()))
	return hex.EncodeToString(sum[:])
}

func validThinking(level string) bool {
	switch level {
	case "", "off", "minimal", "low", "medium", "high", "xhigh", "max":
		return true
	}
	return false
}

func validProviderID(id string) bool {
	if id == "" || len(id) > 80 {
		return false
	}
	for _, r := range id {
		if r <= ' ' || r == 0x7f {
			return false
		}
	}
	return true
}

func setOrDelete(root map[string]any, key, value string) {
	if value == "" {
		delete(root, key)
		return
	}
	root[key] = value
}

func stringValue(value any) string {
	text, _ := value.(string)
	return text
}

func intValue(value any) int {
	switch n := value.(type) {
	case float64:
		return int(n)
	case int:
		return n
	}
	return 0
}

func stringList(value any) []string {
	list, ok := value.([]any)
	if !ok {
		return nil
	}
	out := make([]string, 0, len(list))
	for _, item := range list {
		if text, ok := item.(string); ok {
			out = append(out, text)
		}
	}
	return out
}

// readModels accepts the comments and trailing commas that pi's model loader
// accepts. Saving rewrites plain JSON, so the caller warns when the input used
// them.
func readModels(path string) (map[string]any, bool, error) {
	data, exists, err := jsonx.ReadFile(path, 4<<20)
	if err != nil {
		return map[string]any{}, false, fmt.Errorf("read %s: %w", filepath.Base(path), err)
	}
	if !exists {
		return map[string]any{}, false, nil
	}
	clean, changed := jsonx.StripJSONC(data)
	var root map[string]any
	if err := json.Unmarshal(clean, &root); err != nil {
		return map[string]any{}, changed, fmt.Errorf("parse %s: %w", filepath.Base(path), err)
	}
	if root == nil {
		root = map[string]any{}
	}
	return root, changed, nil
}

// withFileLock takes pi's settings lock: a "<path>.lock" directory. pi uses
// the same protocol, so a concurrent pi write waits for PiS instead of losing
// a change. A lock older than 30 seconds is stale after a crash.
func withFileLock(path string, fn func() error) error {
	lock := path + ".lock"
	if err := os.MkdirAll(filepath.Dir(lock), 0o700); err != nil {
		return fmt.Errorf("create config directory: %w", err)
	}
	deadline := time.Now().Add(2 * time.Second)
	for {
		err := os.Mkdir(lock, 0o700)
		if err == nil {
			break
		}
		if !errors.Is(err, fs.ErrExist) {
			return fmt.Errorf("lock %s: %w", filepath.Base(path), err)
		}
		if info, statErr := os.Stat(lock); statErr == nil && time.Since(info.ModTime()) > 30*time.Second {
			_ = os.RemoveAll(lock)
			continue
		}
		if time.Now().After(deadline) {
			return fmt.Errorf("%s is locked by pi; try again", filepath.Base(path))
		}
		time.Sleep(20 * time.Millisecond)
	}
	defer os.Remove(lock)
	return fn()
}

// readObject reads a JSON object. A missing file is an empty object.
func readObject(path string) (map[string]any, error) {
	root, _, err := readObjectStrict(path)
	return root, err
}

// readObjectStrict also reports whether the file existed. Parse errors must
// stop writes: replacing a file PiS cannot understand would lose settings.
func readObjectStrict(path string) (map[string]any, bool, error) {
	data, exists, err := jsonx.ReadFile(path, 4<<20)
	if err != nil {
		return map[string]any{}, exists, fmt.Errorf("read %s: %w", filepath.Base(path), err)
	}
	if !exists {
		return map[string]any{}, false, nil
	}
	var root map[string]any
	if err := json.Unmarshal(data, &root); err != nil {
		return map[string]any{}, true, fmt.Errorf("parse %s: %w", filepath.Base(path), err)
	}
	if root == nil {
		root = map[string]any{}
	}
	return root, true, nil
}

func writeObject(path string, root map[string]any) error {
	// Dotfile setups often symlink the config into a repository. Replace the
	// target, not the link, so the link keeps working.
	if resolved, err := filepath.EvalSymlinks(path); err == nil {
		path = resolved
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return fmt.Errorf("create config directory: %w", err)
	}
	data, err := json.MarshalIndent(root, "", "  ")
	if err != nil {
		return fmt.Errorf("encode %s: %w", filepath.Base(path), err)
	}
	data = append(data, '\n')
	mode := os.FileMode(0o600)
	if filepath.Base(path) == "settings.json" {
		mode = 0o644
		if info, err := os.Stat(path); err == nil {
			mode = info.Mode().Perm()
		}
	}
	tmp, err := os.CreateTemp(filepath.Dir(path), "."+filepath.Base(path)+".*")
	if err != nil {
		return fmt.Errorf("create temp file: %w", err)
	}
	name := tmp.Name()
	defer os.Remove(name)
	if _, err := tmp.Write(data); err != nil {
		tmp.Close()
		return fmt.Errorf("write %s: %w", filepath.Base(path), err)
	}
	if err := tmp.Sync(); err != nil {
		tmp.Close()
		return fmt.Errorf("sync %s: %w", filepath.Base(path), err)
	}
	if err := tmp.Close(); err != nil {
		return fmt.Errorf("close %s: %w", filepath.Base(path), err)
	}
	if err := os.Chmod(name, mode); err != nil {
		return fmt.Errorf("chmod %s: %w", filepath.Base(path), err)
	}
	if err := os.Rename(name, path); err != nil {
		return fmt.Errorf("replace %s: %w", filepath.Base(path), err)
	}
	return nil
}
