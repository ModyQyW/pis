// Package piinfo finds the installed pi executable and checks its version.
// It never installs, updates, or authenticates pi.
package piinfo

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"time"
)

// Min is the oldest supported pi version (inclusive).
const Min = "1.6.0"

// MaxMajor is the last supported major version (exclusive of the next).
const MaxMajor = 2

// Status is the result of discovery, safe to send to the UI.
type Status struct {
	Found      bool   `json:"found"`
	Path       string `json:"path,omitempty"`
	Version    string `json:"version,omitempty"`
	Compatible bool   `json:"compatible"`
	Error      string `json:"error,omitempty"`
	Source     string `json:"source,omitempty"`
}

var versionRE = regexp.MustCompile(`(\d+)\.(\d+)\.(\d+)`)

// Version is a parsed semantic version.
type Version struct {
	Major, Minor, Patch int
}

// String formats a version.
func (v Version) String() string { return fmt.Sprintf("%d.%d.%d", v.Major, v.Minor, v.Patch) }

// ParseVersion finds the first x.y.z in text.
func ParseVersion(text string) (Version, bool) {
	m := versionRE.FindStringSubmatch(text)
	if m == nil {
		return Version{}, false
	}
	var v Version
	fmt.Sscanf(strings.Join(m[1:], "."), "%d.%d.%d", &v.Major, &v.Minor, &v.Patch)
	return v, true
}

// Compatible reports whether v is within the supported range.
func Compatible(v Version) bool {
	min, ok := ParseVersion(Min)
	if !ok {
		return false
	}
	if v.Major != min.Major {
		return v.Major > min.Major && v.Major < MaxMajor
	}
	return v.Minor > min.Minor || (v.Minor == min.Minor && v.Patch >= min.Patch)
}

// Discover finds pi. explicit is the user's configured path, if any.
//
// An explicit path is authoritative: when it cannot run, Discover reports
// that path's error instead of silently using another installation. Without
// one, it checks PIS_PI, PATH, and common install locations.
func Discover(ctx context.Context, explicit string) Status {
	explicit = strings.TrimSpace(explicit)
	if explicit != "" {
		st, err := check(ctx, explicit, "settings")
		if err != nil {
			return Status{Error: err.Error()}
		}
		return st
	}
	type candidate struct {
		path   string
		source string
	}
	var candidates []candidate
	if env := os.Getenv("PIS_PI"); env != "" {
		candidates = append(candidates, candidate{env, "environment"})
	}
	if p, err := exec.LookPath("pi"); err == nil {
		candidates = append(candidates, candidate{p, "PATH"})
	}
	for _, p := range commonPaths() {
		candidates = append(candidates, candidate{p, "common"})
	}
	seen := map[string]bool{}
	var firstErr, lastErr string
	for _, c := range candidates {
		if c.path == "" || seen[c.path] {
			continue
		}
		seen[c.path] = true
		st, err := check(ctx, c.path, c.source)
		if err == nil {
			return st
		}
		// A path that exists but cannot run is more useful than a later
		// candidate that was never installed.
		if _, statErr := os.Stat(c.path); statErr == nil && firstErr == "" {
			firstErr = err.Error()
		}
		lastErr = err.Error()
	}
	if firstErr != "" {
		lastErr = firstErr
	}
	if lastErr == "" {
		lastErr = "pi was not found"
	}
	return Status{Error: lastErr}
}

func commonPaths() []string {
	home, _ := os.UserHomeDir()
	var paths []string
	// Bun installs global packages into $BUN_INSTALL/bin (default ~/.bun/bin).
	bunInstalls := []string{os.Getenv("BUN_INSTALL")}
	if home != "" {
		bunInstalls = append(bunInstalls, filepath.Join(home, ".bun"))
	}
	for _, dir := range bunInstalls {
		if dir != "" {
			paths = append(paths, filepath.Join(dir, "bin", "pi"))
		}
	}
	if home != "" {
		paths = append(paths,
			filepath.Join(home, "Library", "pnpm", "pi"),
			filepath.Join(home, ".local", "share", "pnpm", "pi"),
			filepath.Join(home, ".npm-global", "bin", "pi"),
			filepath.Join(home, ".volta", "bin", "pi"),
		)
	}
	paths = append(paths,
		"/opt/homebrew/bin/pi",
		"/usr/local/bin/pi",
	)
	if home != "" {
		paths = append(paths, filepath.Join(home, ".local", "bin", "pi"))
	}
	if runtime.GOOS == "windows" {
		if appData := os.Getenv("APPDATA"); appData != "" {
			paths = append(paths, filepath.Join(appData, "npm", "pi.cmd"))
		}
		if home != "" {
			paths = append(paths,
				filepath.Join(home, ".bun", "bin", "pi.exe"),
				filepath.Join(home, ".bun", "bin", "pi.cmd"),
			)
		}
	}
	return paths
}

func check(ctx context.Context, path, source string) (Status, error) {
	info, err := os.Stat(path)
	if err != nil {
		return Status{}, fmt.Errorf("%s: %w", path, err)
	}
	if info.IsDir() {
		return Status{}, fmt.Errorf("%s is a directory, not the pi executable", path)
	}
	cctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	out, err := exec.CommandContext(cctx, path, "--version").CombinedOutput()
	if err != nil {
		detail := strings.TrimSpace(string(out))
		if detail != "" {
			return Status{}, fmt.Errorf("%s --version: %w (%s)", path, err, detail)
		}
		return Status{}, fmt.Errorf("%s --version: %w", path, err)
	}
	v, ok := ParseVersion(string(out))
	if !ok {
		return Status{}, fmt.Errorf("%s --version returned no version", path)
	}
	st := Status{Found: true, Path: path, Version: v.String(), Source: source}
	if !Compatible(v) {
		st.Error = fmt.Sprintf("pi %s is outside the supported range (>=%s, <%d.0.0)", v, Min, MaxMajor)
		return st, nil
	}
	st.Compatible = true
	return st, nil
}
