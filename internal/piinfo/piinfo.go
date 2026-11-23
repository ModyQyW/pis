// Package piinfo finds the installed pi executable and checks its version.
// It never installs, updates, or authenticates pi.
package piinfo

import (
	"context"
	"errors"
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
// It checks the explicit path, PI_MYGO_PI, PATH, and common install locations.
// Login-shell PATH resolution is added by the caller when this fails.
func Discover(ctx context.Context, explicit string) Status {
	type candidate struct {
		path   string
		source string
	}
	var candidates []candidate
	if explicit != "" {
		candidates = append(candidates, candidate{explicit, "settings"})
	}
	if env := os.Getenv("PI_MYGO_PI"); env != "" {
		candidates = append(candidates, candidate{env, "environment"})
	}
	if p, err := exec.LookPath("pi"); err == nil {
		candidates = append(candidates, candidate{p, "PATH"})
	}
	for _, p := range commonPaths() {
		candidates = append(candidates, candidate{p, "common"})
	}
	seen := map[string]bool{}
	var lastErr string
	for _, c := range candidates {
		if c.path == "" || seen[c.path] {
			continue
		}
		seen[c.path] = true
		st, err := check(ctx, c.path, c.source)
		if err == nil {
			return st
		}
		lastErr = err.Error()
	}
	if lastErr == "" {
		lastErr = "pi was not found"
	}
	return Status{Error: lastErr}
}

func commonPaths() []string {
	home, _ := os.UserHomeDir()
	paths := []string{
		filepath.Join(home, ".bun", "bin", "pi"),
		"/opt/homebrew/bin/pi",
		"/usr/local/bin/pi",
		filepath.Join(home, ".local", "bin", "pi"),
	}
	if runtime.GOOS == "windows" {
		if appData := os.Getenv("APPDATA"); appData != "" {
			paths = append(paths, filepath.Join(appData, "npm", "pi.cmd"))
		}
	}
	return paths
}

func check(ctx context.Context, path, source string) (Status, error) {
	info, err := os.Stat(path)
	if err != nil || info.IsDir() {
		return Status{}, fmt.Errorf("%s is not a file", path)
	}
	cctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	out, err := exec.CommandContext(cctx, path, "--version").CombinedOutput()
	if err != nil {
		return Status{}, fmt.Errorf("%s --version: %w (%s)", path, err, strings.TrimSpace(string(out)))
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

// ErrNotFound is returned by helpers that require pi.
var ErrNotFound = errors.New("pi was not found")
