// Package trust decides whether project-local pi resources may load. It reads
// pi's trust store, never writes it; the app keeps its own decision.
package trust

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"pis/internal/settings"
)

// Info is the trust state shown to the user.
type Info struct {
	Path          string   `json:"path"`
	RequiresTrust bool     `json:"requiresTrust"`
	Resources     []string `json:"resources"`
	Decision      string   `json:"decision"` // trusted | untrusted | undecided
	Source        string   `json:"source"`   // app | pi | none
	Effective     bool     `json:"effective"`
	DefaultTrust  string   `json:"defaultTrust,omitempty"`
}

var resourcePaths = []string{
	".pi/settings.json",
	".pi/mcp.json",
	".pi/extensions",
	".pi/skills",
	".pi/prompts",
	".pi/themes",
	".pi/SYSTEM.md",
	".pi/APPEND_SYSTEM.md",
	"SYSTEM.md",
	"APPEND_SYSTEM.md",
	".agents/skills",
}

// Inspect computes the effective trust for workspace.
func Inspect(workspace, agentDir string, app map[string]settings.TrustDecision) Info {
	abs, err := filepath.Abs(workspace)
	if err != nil {
		abs = workspace
	}
	info := Info{Path: abs, Resources: resources(abs)}
	info.RequiresTrust = len(info.Resources) > 0
	if !info.RequiresTrust {
		info.Decision = "trusted"
		info.Source = "none"
		info.Effective = true
		return info
	}
	if d, ok := app[abs]; ok && d != settings.TrustUnknown {
		info.Decision = string(d)
		info.Source = "app"
		info.Effective = d == settings.TrustTrusted
		return info
	}
	// pi's nearest-ancestor decision is read-only input.
	if decision, ok := piDecision(abs, filepath.Join(agentDir, "trust.json")); ok {
		info.Source = "pi"
		if decision {
			info.Decision = "trusted"
			info.Effective = true
		} else {
			info.Decision = "untrusted"
		}
		return info
	}
	info.Decision = "undecided"
	info.Source = "none"
	info.Effective = false
	info.DefaultTrust = readDefaultTrust(filepath.Join(agentDir, "settings.json"))
	return info
}

func resources(dir string) []string {
	home, _ := os.UserHomeDir()
	userSkills := ""
	if home != "" {
		userSkills = filepath.Clean(filepath.Join(home, ".agents", "skills"))
	}
	var out []string
	for _, rel := range resourcePaths {
		path := filepath.Join(dir, rel)
		if rel == ".agents/skills" && filepath.Clean(path) == userSkills {
			continue
		}
		if present(path) {
			out = append(out, rel)
		}
	}
	// pi also gates .agents/skills from any ancestor directory.
	for current := filepath.Dir(dir); ; current = filepath.Dir(current) {
		skills := filepath.Clean(filepath.Join(current, ".agents", "skills"))
		if skills != userSkills && present(skills) {
			out = append(out, skills)
		}
		parent := filepath.Dir(current)
		if parent == current {
			break
		}
	}
	sort.Strings(out)
	return out
}

// present reports a resource that would actually load. An empty directory
// has nothing for pi to load, so it does not need a decision.
func present(path string) bool {
	info, err := os.Stat(path)
	if err != nil {
		return false
	}
	if !info.IsDir() {
		return true
	}
	entries, err := os.ReadDir(path)
	return err == nil && len(entries) > 0
}

func piDecision(workspace, trustFile string) (bool, bool) {
	data, err := os.ReadFile(trustFile)
	if err != nil {
		return false, false
	}
	var store map[string]any
	if json.Unmarshal(data, &store) != nil {
		return false, false
	}
	current, err := filepath.Abs(workspace)
	if err != nil {
		return false, false
	}
	for {
		for key, raw := range store {
			if filepath.Clean(key) != filepath.Clean(current) {
				continue
			}
			if v, ok := raw.(bool); ok {
				return v, true
			}
			if raw == nil {
				return false, true
			}
		}
		parent := filepath.Dir(current)
		if parent == current {
			return false, false
		}
		current = parent
	}
}

func readDefaultTrust(path string) string {
	data, err := os.ReadFile(path)
	if err != nil {
		return ""
	}
	var cfg struct {
		DefaultProjectTrust string `json:"defaultProjectTrust"`
	}
	if json.Unmarshal(data, &cfg) != nil {
		return ""
	}
	return strings.TrimSpace(cfg.DefaultProjectTrust)
}
