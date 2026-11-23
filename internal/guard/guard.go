// Package guard detects existing pi permission/safety packages so PiS's
// own approvals do not double-prompt.
package guard

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
)

// Detected returns known guard packages configured or installed on this
// machine. Detection is advisory; the app never disables a user package.
func Detected(agentDir string) []string {
	var out []string
	seen := map[string]bool{}
	add := func(name string) {
		low := strings.ToLower(name)
		if strings.Contains(low, "cc-safety-net") {
			name = "cc-safety-net"
		}
		if name != "" && !seen[name] {
			seen[name] = true
			out = append(out, name)
		}
	}
	data, err := os.ReadFile(filepath.Join(agentDir, "settings.json"))
	if err == nil {
		var cfg struct {
			Packages []any `json:"packages"`
		}
		if json.Unmarshal(data, &cfg) == nil {
			for _, raw := range cfg.Packages {
				source := ""
				switch v := raw.(type) {
				case string:
					source = v
				case map[string]any:
					if s, ok := v["source"].(string); ok {
						source = s
					}
				}
				low := strings.ToLower(source)
				if strings.Contains(low, "cc-safety-net") || strings.Contains(low, "permission") || strings.Contains(low, "safety") {
					add(source)
				}
			}
		}
	}
	for _, rel := range []string{"cc-safety-net", "@juicesharp/rpiv-permissions"} {
		if _, err := os.Stat(filepath.Join(agentDir, "npm", "node_modules", rel)); err == nil {
			add(rel)
		}
	}
	return out
}
