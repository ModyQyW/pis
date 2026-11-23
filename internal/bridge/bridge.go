// Package bridge writes the bundled pi extension to app data so pi can load
// it with -e. The extension only provides namespaced commands.
package bridge

import (
	_ "embed"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// Version changes whenever the extension source changes.
const Version = "5"

//go:embed bridge.ts
var source string

// Ensure writes the bridge extension under dir/extensions and returns its path.
func Ensure(dir string) (string, error) {
	if dir == "" {
		return "", fmt.Errorf("empty app data directory")
	}
	extDir := filepath.Join(dir, "extensions")
	if err := os.MkdirAll(extDir, 0o755); err != nil {
		return "", err
	}
	path := filepath.Join(extDir, "mygo-bridge-"+Version+".ts")
	if data, err := os.ReadFile(path); err == nil && string(data) == source {
		cleanupOld(extDir, filepath.Base(path))
		return path, nil
	}
	tmp, err := os.CreateTemp(extDir, ".mygo-bridge-*.ts")
	if err != nil {
		return "", err
	}
	name := tmp.Name()
	defer os.Remove(name)
	if _, err := tmp.WriteString(source); err != nil {
		tmp.Close()
		return "", err
	}
	if err := tmp.Close(); err != nil {
		return "", err
	}
	if err := os.Chmod(name, 0o600); err != nil {
		return "", err
	}
	if err := os.Rename(name, path); err != nil {
		return "", err
	}
	cleanupOld(extDir, filepath.Base(path))
	return path, nil
}

func cleanupOld(dir, keep string) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return
	}
	for _, entry := range entries {
		if entry.Name() == keep || entry.IsDir() {
			continue
		}
		if strings.HasPrefix(entry.Name(), "mygo-bridge-") && strings.HasSuffix(entry.Name(), ".ts") {
			_ = os.Remove(filepath.Join(dir, entry.Name()))
		}
	}
}
