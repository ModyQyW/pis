// Package settings stores Pi Mygo's own preferences. It never touches pi's
// configuration or session files.
package settings

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// Version is the current settings schema version.
const Version = 1

// Theme is the application appearance.
type Theme string

const (
	ThemeSystem Theme = "system"
	ThemeLight  Theme = "light"
	ThemeDark   Theme = "dark"
)

// PermissionPolicy selects how the bridge extension treats tool calls.
type PermissionPolicy string

const (
	// PolicySmart asks only for risky or out-of-workspace actions.
	PolicySmart PermissionPolicy = "smart"
	// PolicyAsk asks for every tool call.
	PolicyAsk PermissionPolicy = "ask"
	// PolicyAllow allows everything; the bridge still asks nothing.
	PolicyAllow PermissionPolicy = "allow"
)

// Recent is a project the user opened before.
type Recent struct {
	Path       string    `json:"path"`
	Name       string    `json:"name"`
	LastOpened time.Time `json:"lastOpened"`
}

// TrustDecision is the app's project trust choice. It is not pi's trust store.
type TrustDecision string

const (
	TrustUnknown   TrustDecision = ""
	TrustTrusted   TrustDecision = "trusted"
	TrustUntrusted TrustDecision = "untrusted"
)

// Settings is the on-disk shape. Fields are additive; unknown fields survive
// a load/save round trip only if they are part of this struct.
type Settings struct {
	Version       int                      `json:"version"`
	Theme         Theme                    `json:"theme"`
	SidebarWidth  int                      `json:"sidebarWidth"`
	RightWidth    int                      `json:"rightWidth"`
	LastWorkspace string                   `json:"lastWorkspace,omitempty"`
	Recents       []Recent                 `json:"recents"`
	Trust         map[string]TrustDecision `json:"trust"`
	Permissions   Permissions              `json:"permissions"`
	PiPath        string                   `json:"piPath,omitempty"`
	ShowWidgets   bool                     `json:"showWidgets"`
	Notifications bool                     `json:"notifications"`
	ReduceMotion  bool                     `json:"reduceMotion"`
	CodeFontSize  int                      `json:"codeFontSize"`
	UIFontSize    int                      `json:"uiFontSize"`
	SendOnEnter   bool                     `json:"sendOnEnter"`
	CheckUpdates  bool                     `json:"checkUpdates"`
	Language      string                   `json:"language"`
}

// Permissions configures the bundled bridge guard.
type Permissions struct {
	Policy PermissionPolicy `json:"policy"`
	// Disabled lets a user rely on another guard extension.
	Disabled bool `json:"disabled"`
	// Force enables Pi Mygo's guard even when another guard is detected.
	Force bool `json:"force"`
}

// Defaults returns the initial settings.
func Defaults() Settings {
	return Settings{
		Version:       Version,
		Theme:         ThemeSystem,
		SidebarWidth:  280,
		RightWidth:    360,
		Recents:       []Recent{},
		Trust:         map[string]TrustDecision{},
		Permissions:   Permissions{Policy: PolicySmart},
		ShowWidgets:   false,
		Notifications: true,
		CodeFontSize:  13,
		UIFontSize:    14,
		SendOnEnter:   true,
		CheckUpdates:  false,
		Language:      "en",
	}
}

// Store is a concurrency-safe settings file. A failed load returns defaults
// and an error; the file is not overwritten until an explicit Update.
type Store struct {
	mu   sync.RWMutex
	path string
	cfg  Settings
	// loadErr is reported to diagnostics; it does not block the app.
	loadErr error
}

// Open loads settings from dir/settings.json, creating defaults when absent.
func Open(dir string) (*Store, error) {
	s := &Store{path: filepath.Join(dir, "settings.json"), cfg: Defaults()}
	data, err := os.ReadFile(s.path)
	if errors.Is(err, os.ErrNotExist) {
		return s, nil
	}
	if err != nil {
		s.loadErr = fmt.Errorf("read settings: %w", err)
		return s, s.loadErr
	}
	var cfg Settings
	if err := json.Unmarshal(data, &cfg); err != nil {
		s.loadErr = fmt.Errorf("parse settings: %w", err)
		return s, s.loadErr
	}
	s.cfg = merge(Defaults(), cfg)
	return s, nil
}

// merge fills missing fields and keeps valid values. A zero version is an
// older/unknown file; defaults win for safety.
func merge(def, cfg Settings) Settings {
	if cfg.Version <= 0 {
		cfg.Version = def.Version
	}
	if cfg.Theme != ThemeLight && cfg.Theme != ThemeDark {
		cfg.Theme = def.Theme
	}
	if cfg.SidebarWidth < 220 || cfg.SidebarWidth > 480 {
		cfg.SidebarWidth = def.SidebarWidth
	}
	if cfg.RightWidth < 280 || cfg.RightWidth > 720 {
		cfg.RightWidth = def.RightWidth
	}
	if cfg.Permissions.Policy != PolicyAsk && cfg.Permissions.Policy != PolicyAllow {
		cfg.Permissions.Policy = def.Permissions.Policy
	}
	if cfg.CodeFontSize < 10 || cfg.CodeFontSize > 22 {
		cfg.CodeFontSize = def.CodeFontSize
	}
	if cfg.UIFontSize < 11 || cfg.UIFontSize > 22 {
		cfg.UIFontSize = def.UIFontSize
	}
	if cfg.Language != "en" && cfg.Language != "zh" {
		cfg.Language = def.Language
	}
	if cfg.Recents == nil {
		cfg.Recents = []Recent{}
	}
	if cfg.Trust == nil {
		cfg.Trust = map[string]TrustDecision{}
	}
	return cfg
}

// Snapshot returns a copy for the UI.
func (s *Store) Snapshot() Settings {
	s.mu.RLock()
	defer s.mu.RUnlock()
	cfg := s.cfg
	cfg.Recents = append([]Recent(nil), s.cfg.Recents...)
	cfg.Trust = make(map[string]TrustDecision, len(s.cfg.Trust))
	for k, v := range s.cfg.Trust {
		cfg.Trust[k] = v
	}
	return cfg
}

// LoadError reports a non-fatal load failure.
func (s *Store) LoadError() error {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.loadErr
}

// Update applies fn and writes atomically. A write error leaves the in-memory
// value changed but reports the failure; the next Update retries.
func (s *Store) Update(fn func(*Settings) error) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	cfg := s.cfg
	if err := fn(&cfg); err != nil {
		return err
	}
	if cfg.Version == 0 {
		cfg.Version = Version
	}
	if err := writeAtomic(s.path, cfg); err != nil {
		return err
	}
	s.cfg = cfg
	s.loadErr = nil
	return nil
}

func writeAtomic(path string, cfg Settings) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return fmt.Errorf("create settings directory: %w", err)
	}
	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return fmt.Errorf("encode settings: %w", err)
	}
	data = append(data, '\n')
	tmp, err := os.CreateTemp(filepath.Dir(path), ".settings-*.json")
	if err != nil {
		return fmt.Errorf("create settings temp: %w", err)
	}
	name := tmp.Name()
	defer os.Remove(name)
	if _, err := tmp.Write(data); err != nil {
		tmp.Close()
		return fmt.Errorf("write settings: %w", err)
	}
	if err := tmp.Sync(); err != nil {
		tmp.Close()
		return fmt.Errorf("sync settings: %w", err)
	}
	if err := tmp.Close(); err != nil {
		return fmt.Errorf("close settings: %w", err)
	}
	if err := os.Chmod(name, 0o600); err != nil {
		return fmt.Errorf("chmod settings: %w", err)
	}
	if err := os.Rename(name, path); err != nil {
		return fmt.Errorf("replace settings: %w", err)
	}
	return nil
}
