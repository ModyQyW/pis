// Package shellpath resolves the PATH of the user's login shell.
//
// An app opened from Finder or a desktop launcher receives a minimal PATH,
// not the one the user's shell builds. pi installed by bun or npm is often a
// script whose interpreter (node) is only on the login-shell PATH, so
// discovery and the pi process itself need that PATH.
package shellpath

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"
)

// timeout bounds one login-shell start. A slow profile must not delay the app.
const timeout = 2 * time.Second

// marker separates profile output from the PATH on stdout.
const marker = "__PIS_LOGIN_PATH__"

var (
	once      sync.Once
	loginPath string
)

// Apply prepends the login shell's PATH to the process PATH and returns the
// result. It is safe to call from any goroutine and does the work once.
// Windows keeps the inherited PATH.
func Apply() string {
	current := os.Getenv("PATH")
	login := Login()
	if login == "" {
		return current
	}
	merged := merge(login, current)
	if merged != current {
		_ = os.Setenv("PATH", merged)
	}
	return merged
}

// Login returns the PATH of the user's login shell, or "" when it cannot be
// read. The result is cached for the process lifetime.
func Login() string {
	once.Do(func() {
		if runtime.GOOS == "windows" {
			return
		}
		for _, args := range [][]string{{"-lic"}, {"-lc"}} {
			if p := read(args); p != "" {
				loginPath = p
				return
			}
		}
	})
	return loginPath
}

func read(args []string) string {
	for _, shell := range shells() {
		ctx, cancel := context.WithTimeout(context.Background(), timeout)
		cmd := exec.CommandContext(ctx, shell, append(args, script(shell))...)
		out, err := cmd.Output()
		cancel()
		if err != nil {
			continue
		}
		if p := parse(out); p != "" {
			return p
		}
	}
	return ""
}

func script(shell string) string {
	if strings.Contains(strings.ToLower(filepath.Base(shell)), "fish") {
		return `printf '\n` + marker + `%s\n' (string join : $PATH)`
	}
	return `printf '\n` + marker + `%s\n' "$PATH"`
}

func shells() []string {
	var out []string
	seen := map[string]bool{}
	add := func(path string) {
		if path != "" && !seen[path] {
			seen[path] = true
			out = append(out, path)
		}
	}
	add(os.Getenv("SHELL"))
	if runtime.GOOS == "darwin" {
		add("/bin/zsh")
	}
	add("/bin/sh")
	return out
}

func parse(out []byte) string {
	text := string(out)
	idx := strings.LastIndex(text, marker)
	if idx < 0 {
		return ""
	}
	path, _, _ := strings.Cut(text[idx+len(marker):], "\n")
	return strings.TrimSpace(path)
}

// merge joins two PATH values, dropping empty and repeated entries. The first
// value wins.
func merge(first, second string) string {
	sep := string(os.PathListSeparator)
	seen := map[string]bool{}
	var out []string
	for _, entry := range strings.Split(first+sep+second, sep) {
		if entry == "" || seen[entry] {
			continue
		}
		seen[entry] = true
		out = append(out, entry)
	}
	return strings.Join(out, sep)
}
