// Package app exposes Pi Mygo's desktop services to the frontend. It owns
// workspace selection, app preferences, and pi discovery; agent sessions live
// in internal/agent once Phase 1 lands.
package app

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/egoist/mygo"

	"pi-mygo/internal/agent"
	"pi-mygo/internal/guard"
	"pi-mygo/internal/piinfo"
	"pi-mygo/internal/sessions"
	"pi-mygo/internal/settings"
)

// Workspace is a project the user can chat in.
type Workspace struct {
	Path       string    `json:"path"`
	Name       string    `json:"name"`
	LastOpened time.Time `json:"lastOpened"`
}

// PiStatus is the pi executable status sent to the page.
type PiStatus struct {
	Found      bool   `json:"found"`
	Path       string `json:"path,omitempty"`
	Version    string `json:"version,omitempty"`
	Compatible bool   `json:"compatible"`
	Error      string `json:"error,omitempty"`
	Source     string `json:"source,omitempty"`
	Checking   bool   `json:"checking"`
}

// Bootstrap is the initial state of the app.
type Bootstrap struct {
	AppName    string            `json:"appName"`
	AppVersion string            `json:"appVersion"`
	Platform   string            `json:"platform"`
	Arch       string            `json:"arch"`
	DataDir    string            `json:"dataDir"`
	Settings   settings.Settings `json:"settings"`
	Recents    []Workspace       `json:"recents"`
	Pi         PiStatus          `json:"pi"`
	Guard      GuardStatus       `json:"guard"`
}

// GuardStatus describes the approval extension state.
type GuardStatus struct {
	Policy   string   `json:"policy"`
	Detected []string `json:"detected"`
	Active   bool     `json:"active"`
	Force    bool     `json:"force"`
	Disabled bool     `json:"disabled"`
}

// Diagnostics is the local support report. It contains paths and versions,
// never prompts, credentials, or environment values.
type Diagnostics struct {
	AppVersion  string   `json:"appVersion"`
	Platform    string   `json:"platform"`
	Arch        string   `json:"arch"`
	DataDir     string   `json:"dataDir"`
	Settings    string   `json:"settings"`
	Pi          PiStatus `json:"pi"`
	SettingsErr string   `json:"settingsError,omitempty"`
	Notes       []string `json:"notes"`
}

// Service is bound to the page. Methods on it are safe from any goroutine;
// shared mutable state is guarded.
type Service struct {
	store *settings.Store
	dir   string
	agent *agent.Manager

	mu        sync.Mutex
	pi        PiStatus
	piStarted bool
}

// New creates the app service. dir is the user data directory. mgr may be nil
// in tests that only exercise preferences.
func New(store *settings.Store, dir string, mgr *agent.Manager) *Service {
	return &Service{store: store, dir: dir, agent: mgr, pi: PiStatus{Checking: true}}
}

// Bootstrap returns the app's initial state and starts pi discovery in the
// background. It never blocks the first paint on a process or the network.
func (s *Service) Bootstrap() Bootstrap {
	cfg := s.store.Snapshot()
	s.startPiDiscovery()
	return Bootstrap{
		AppName:    mygo.App.Name(),
		AppVersion: mygo.App.Version(),
		Platform:   osPlatform(),
		Arch:       osArch(),
		DataDir:    s.dir,
		Settings:   cfg,
		Recents:    recents(cfg),
		Pi:         s.piStatus(),
		Guard:      s.guardStatus(cfg),
	}
}

func (s *Service) guardStatus(cfg settings.Settings) GuardStatus {
	detected := guard.Detected(sessions.AgentDir())
	policy := EffectiveGuardPolicy(cfg, detected)
	return GuardStatus{
		Policy:   policy,
		Detected: detected,
		Active:   policy != "off",
		Force:    cfg.Permissions.Force,
		Disabled: cfg.Permissions.Disabled,
	}
}

// EffectiveGuardPolicy resolves app settings and detected guard packages to
// the env value passed to the bridge.
func EffectiveGuardPolicy(cfg settings.Settings, detected []string) string {
	if cfg.Permissions.Disabled || cfg.Permissions.Policy == settings.PolicyAllow {
		return "off"
	}
	if len(detected) > 0 && !cfg.Permissions.Force {
		return "off"
	}
	return string(cfg.Permissions.Policy)
}

func (s *Service) refreshGuardPolicy() {
	if s.agent == nil {
		return
	}
	cfg := s.store.Snapshot()
	s.agent.SetGuardPolicy(EffectiveGuardPolicy(cfg, guard.Detected(sessions.AgentDir())))
}

// Ping is a typed round-trip used by the frontend bootstrap check.
func (s *Service) Ping() string { return "pong" }

// Status returns the current pi status without starting a check.
func (s *Service) Status() PiStatus { return s.piStatus() }

// Checks the executable again, synchronously, with the configured path.
func (s *Service) CheckPi() PiStatus {
	s.startPiDiscovery()
	cfg := s.store.Snapshot()
	st := piinfo.Discover(context.Background(), cfg.PiPath)
	s.setPi(st)
	return s.piStatus()
}

// SetPiPath stores an explicit executable and rechecks it.
func (s *Service) SetPiPath(path string) (PiStatus, error) {
	path = strings.TrimSpace(path)
	if path != "" {
		abs, err := filepath.Abs(path)
		if err != nil {
			return PiStatus{}, err
		}
		path = abs
	}
	if err := s.store.Update(func(c *settings.Settings) error {
		c.PiPath = path
		return nil
	}); err != nil {
		return PiStatus{}, err
	}
	return s.CheckPi(), nil
}

// ChooseProject shows a directory picker and adds the result to recents.
// It returns a zero Workspace when the user cancels.
func (s *Service) ChooseProject(ctx context.Context) (Workspace, error) {
	paths, err := mygo.Dialog.Open(mygo.OpenDialogOptions{
		Parent:            mygo.CallerWindow(ctx),
		Title:             "Open a project",
		ButtonLabel:       "Open",
		Directory:         true,
		CreateDirectories: true,
	})
	if err != nil || len(paths) == 0 {
		return Workspace{}, err
	}
	return s.OpenProject(paths[0])
}

// OpenProject validates and records a workspace.
func (s *Service) OpenProject(path string) (Workspace, error) {
	abs, err := normalizeDir(path)
	if err != nil {
		return Workspace{}, err
	}
	ws := Workspace{Path: abs, Name: filepath.Base(abs), LastOpened: time.Now()}
	err = s.store.Update(func(c *settings.Settings) error {
		next := c.Recents[:0]
		for _, r := range c.Recents {
			if r.Path != abs {
				next = append(next, r)
			}
		}
		next = append(next, settings.Recent{Path: abs, Name: ws.Name, LastOpened: ws.LastOpened})
		sort.SliceStable(next, func(i, j int) bool { return next[i].LastOpened.After(next[j].LastOpened) })
		if len(next) > 20 {
			next = next[:20]
		}
		c.Recents = next
		c.LastWorkspace = abs
		return nil
	})
	if err != nil {
		return Workspace{}, err
	}
	return ws, nil
}

// RemoveRecent forgets a workspace without deleting any files.
func (s *Service) RemoveRecent(path string) error {
	abs, err := normalizeDir(path)
	if err != nil {
		return err
	}
	return s.store.Update(func(c *settings.Settings) error {
		next := c.Recents[:0]
		for _, r := range c.Recents {
			if r.Path != abs {
				next = append(next, r)
			}
		}
		c.Recents = next
		if c.LastWorkspace == abs {
			c.LastWorkspace = ""
		}
		return nil
	})
}

// SetTheme persists the appearance choice.
func (s *Service) SetTheme(theme string) error {
	t := settings.Theme(theme)
	if t != settings.ThemeSystem && t != settings.ThemeLight && t != settings.ThemeDark {
		return fmt.Errorf("unknown theme %q", theme)
	}
	if err := s.store.Update(func(c *settings.Settings) error {
		c.Theme = t
		return nil
	}); err != nil {
		return err
	}
	ApplyTheme(t)
	return nil
}

// ApplyTheme forces the app appearance. Pages follow it through
// prefers-color-scheme, so CSS needs no separate theme class.
func ApplyTheme(t settings.Theme) {
	switch t {
	case settings.ThemeLight:
		mygo.Theme.SetSource(mygo.ThemeLight)
	case settings.ThemeDark:
		mygo.Theme.SetSource(mygo.ThemeDark)
	default:
		mygo.Theme.SetSource(mygo.ThemeSystem)
	}
}

// SaveLayout persists sidebar/panel widths.
func (s *Service) SaveLayout(sidebar, right int) error {
	return s.store.Update(func(c *settings.Settings) error {
		if sidebar >= 220 && sidebar <= 480 {
			c.SidebarWidth = sidebar
		}
		if right >= 280 && right <= 720 {
			c.RightWidth = right
		}
		return nil
	})
}

// SetPreferences persists small UI preferences in one call.
type Preferences struct {
	ShowWidgets   *bool   `json:"showWidgets,omitempty"`
	Notifications *bool   `json:"notifications,omitempty"`
	ReduceMotion  *bool   `json:"reduceMotion,omitempty"`
	CodeFontSize  *int    `json:"codeFontSize,omitempty"`
	UIFontSize    *int    `json:"uiFontSize,omitempty"`
	SendOnEnter   *bool   `json:"sendOnEnter,omitempty"`
	Policy        *string `json:"policy,omitempty"`
	GuardDisabled *bool   `json:"guardDisabled,omitempty"`
	GuardForce    *bool   `json:"guardForce,omitempty"`
}

// SetPreferences applies non-nil preference fields.
func (s *Service) SetPreferences(p Preferences) error {
	err := s.store.Update(func(c *settings.Settings) error {
		if p.ShowWidgets != nil {
			c.ShowWidgets = *p.ShowWidgets
		}
		if p.Notifications != nil {
			c.Notifications = *p.Notifications
		}
		if p.ReduceMotion != nil {
			c.ReduceMotion = *p.ReduceMotion
		}
		if p.CodeFontSize != nil && *p.CodeFontSize >= 10 && *p.CodeFontSize <= 22 {
			c.CodeFontSize = *p.CodeFontSize
		}
		if p.UIFontSize != nil && *p.UIFontSize >= 11 && *p.UIFontSize <= 22 {
			c.UIFontSize = *p.UIFontSize
		}
		if p.SendOnEnter != nil {
			c.SendOnEnter = *p.SendOnEnter
		}
		if p.Policy != nil {
			pol := settings.PermissionPolicy(*p.Policy)
			if pol != settings.PolicySmart && pol != settings.PolicyAsk && pol != settings.PolicyAllow {
				return fmt.Errorf("unknown permission policy %q", *p.Policy)
			}
			c.Permissions.Policy = pol
		}
		if p.GuardDisabled != nil {
			c.Permissions.Disabled = *p.GuardDisabled
		}
		if p.GuardForce != nil {
			c.Permissions.Force = *p.GuardForce
		}
		return nil
	})
	if err == nil {
		s.refreshGuardPolicy()
	}
	return err
}

// Reveal opens a path with the default application. It does not interpret
// it as a command.
func (s *Service) Reveal(path string) error {
	if path == "" {
		return errors.New("empty path")
	}
	return mygo.Shell.OpenPath(path)
}

// OpenExternal opens an http(s) URL in the browser.
func (s *Service) OpenExternal(raw string) error {
	u, err := url.Parse(raw)
	if err != nil {
		return err
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		return fmt.Errorf("refusing to open scheme %q", u.Scheme)
	}
	return mygo.Shell.OpenExternal(u.String())
}

// Diagnostics returns paths and versions for a support report.
func (s *Service) Diagnostics() Diagnostics {
	d := Diagnostics{
		AppVersion: mygo.App.Version(),
		Platform:   osPlatform(),
		Arch:       osArch(),
		DataDir:    s.dir,
		Settings:   filepath.Join(s.dir, "settings.json"),
		Pi:         s.piStatus(),
	}
	if err := s.store.LoadError(); err != nil {
		d.SettingsErr = err.Error()
	}
	d.Notes = []string{
		"Logs contain operational metadata only; prompts and credentials are never written.",
		"pi owns sessions, auth, models, and its own settings.",
	}
	return d
}

func (s *Service) startPiDiscovery() {
	s.mu.Lock()
	if s.piStarted {
		s.mu.Unlock()
		return
	}
	s.piStarted = true
	s.pi = PiStatus{Checking: true}
	s.mu.Unlock()
	cfg := s.store.Snapshot()
	go func() {
		st := piinfo.Discover(context.Background(), cfg.PiPath)
		s.setPi(st)
		PiStatusEvent.Broadcast(PiStatusChanged{Status: s.piStatus()})
	}()
}

func (s *Service) setPi(st piinfo.Status) {
	if st.Found && st.Compatible && s.agent != nil {
		s.agent.SetExecutable(st.Path)
	}
	s.mu.Lock()
	s.pi = PiStatus{
		Found:      st.Found,
		Path:       st.Path,
		Version:    st.Version,
		Compatible: st.Compatible,
		Error:      st.Error,
		Source:     st.Source,
		Checking:   false,
	}
	s.mu.Unlock()
}

func (s *Service) piStatus() PiStatus {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.pi
}

func recents(cfg settings.Settings) []Workspace {
	out := make([]Workspace, 0, len(cfg.Recents))
	for _, r := range cfg.Recents {
		out = append(out, Workspace{Path: r.Path, Name: r.Name, LastOpened: r.LastOpened})
	}
	sort.SliceStable(out, func(i, j int) bool { return out[i].LastOpened.After(out[j].LastOpened) })
	return out
}

func normalizeDir(path string) (string, error) {
	path = strings.TrimSpace(path)
	if path == "" {
		return "", errors.New("empty path")
	}
	abs, err := filepath.Abs(path)
	if err != nil {
		return "", err
	}
	info, err := os.Stat(abs)
	if err != nil {
		return "", err
	}
	if !info.IsDir() {
		return "", fmt.Errorf("%s is not a directory", abs)
	}
	return abs, nil
}
