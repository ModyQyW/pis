// Package files provides read-only workspace file search for the composer.
// It never writes or executes project files.
package files

import (
	"bytes"
	"errors"
	"io/fs"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"
)

// Hit is one file suggestion.
type Hit struct {
	Path string `json:"path"`
	Name string `json:"name"`
}

type cacheEntry struct {
	files []string
	at    time.Time
}

// Service caches workspace file lists briefly; search is local and cheap.
type Service struct {
	mu    sync.Mutex
	cache map[string]cacheEntry
}

// New creates a file service.
func New() *Service { return &Service{cache: map[string]cacheEntry{}} }

const cacheTTL = 20 * time.Second

// Search returns workspace-relative paths matching query, best first.
func (s *Service) Search(workspace, query string, limit int) ([]Hit, error) {
	if strings.TrimSpace(workspace) == "" {
		return nil, errors.New("empty workspace")
	}
	if limit <= 0 || limit > 50 {
		limit = 12
	}
	abs, err := filepath.Abs(workspace)
	if err != nil {
		return nil, err
	}
	info, err := os.Stat(abs)
	if err != nil || !info.IsDir() {
		return nil, errors.New("workspace is not a directory")
	}
	files, err := s.list(abs)
	if err != nil {
		return nil, err
	}
	query = strings.TrimSpace(query)
	if query == "" {
		out := make([]Hit, 0, min(limit, len(files)))
		for _, path := range files[:min(limit, len(files))] {
			out = append(out, Hit{Path: path, Name: filepath.Base(path)})
		}
		return out, nil
	}
	type scored struct {
		hit   Hit
		score int
	}
	var matches []scored
	for _, path := range files {
		score := rank(path, query)
		if score <= 0 {
			continue
		}
		matches = append(matches, scored{Hit{Path: path, Name: filepath.Base(path)}, score})
	}
	sort.SliceStable(matches, func(i, j int) bool {
		if matches[i].score != matches[j].score {
			return matches[i].score > matches[j].score
		}
		return matches[i].hit.Path < matches[j].hit.Path
	})
	if len(matches) > limit {
		matches = matches[:limit]
	}
	out := make([]Hit, len(matches))
	for i, m := range matches {
		out[i] = m.hit
	}
	return out, nil
}

func (s *Service) list(workspace string) ([]string, error) {
	s.mu.Lock()
	if ent, ok := s.cache[workspace]; ok && time.Since(ent.at) < cacheTTL {
		files := ent.files
		s.mu.Unlock()
		return files, nil
	}
	s.mu.Unlock()

	files, err := gitFiles(workspace)
	if err != nil {
		files, err = walkFiles(workspace)
		if err != nil {
			return nil, err
		}
	}
	s.mu.Lock()
	s.cache[workspace] = cacheEntry{files: files, at: time.Now()}
	s.mu.Unlock()
	return files, nil
}

func gitFiles(workspace string) ([]string, error) {
	cmd := exec.Command("git", "-C", workspace, "ls-files", "--cached", "--others", "--exclude-standard", "-z")
	out, err := cmd.Output()
	if err != nil {
		return nil, err
	}
	parts := strings.Split(string(out), "\x00")
	files := make([]string, 0, len(parts))
	for _, p := range parts {
		if p != "" {
			files = append(files, p)
		}
		if len(files) >= 50000 {
			break
		}
	}
	if len(files) == 0 {
		return nil, errors.New("no files")
	}
	return files, nil
}

func walkFiles(workspace string) ([]string, error) {
	var files []string
	skip := map[string]bool{
		".git": true, "node_modules": true, "dist": true, "build": true,
		".mygo": true, ".next": true, "target": true, "vendor": true,
		"Pods": true, ".cache": true,
	}
	err := filepath.WalkDir(workspace, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return nil
		}
		if d.IsDir() {
			if path != workspace && skip[d.Name()] {
				return filepath.SkipDir
			}
			return nil
		}
		rel, err := filepath.Rel(workspace, path)
		if err != nil || strings.HasPrefix(rel, "..") {
			return nil
		}
		files = append(files, filepath.ToSlash(rel))
		if len(files) >= 50000 {
			return filepath.SkipAll
		}
		return nil
	})
	if err != nil && !errors.Is(err, filepath.SkipAll) {
		return nil, err
	}
	if len(files) == 0 {
		return nil, errors.New("no files")
	}
	return files, nil
}

// rank scores a path for a query. Basename matches beat path-only matches,
// and a prefix beats a substring.
func rank(path, query string) int {
	p := strings.ToLower(path)
	q := strings.ToLower(query)
	base := strings.ToLower(filepath.Base(path))
	score := 0
	switch {
	case strings.HasPrefix(base, q):
		score = 3000
	case strings.Contains(base, q):
		score = 2000 - min(strings.Index(base, q), 200)
	default:
		if idx := strings.Index(p, q); idx >= 0 {
			score = 1000 - min(idx, 300)
			if idx == 0 || p[idx-1] == '/' {
				score += 150
			}
		} else {
			score = subseqScore(p, q)
		}
	}
	if score > 0 {
		// Prefer shorter paths among equal matches.
		score -= min(len(path)/12, 60)
	}
	return score
}

func subseqScore(s, q string) int {
	if q == "" {
		return 0
	}
	qi := 0
	gaps := 0
	last := -1
	for i := 0; i < len(s) && qi < len(q); i++ {
		if s[i] != q[qi] {
			continue
		}
		if last >= 0 && i != last+1 {
			gaps += i - last - 1
		}
		last = i
		qi++
	}
	if qi != len(q) {
		return 0
	}
	return max(80, 500-gaps*4)
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

// FileView is a read-only text preview.
type FileView struct {
	Path      string `json:"path"`
	Text      string `json:"text"`
	Size      int64  `json:"size"`
	Truncated bool   `json:"truncated"`
	Binary    bool   `json:"binary"`
}

// List returns up to limit workspace-relative files.
func (s *Service) List(workspace string, limit int) ([]Hit, error) {
	if limit <= 0 || limit > 500 {
		limit = 300
	}
	abs, err := filepath.Abs(workspace)
	if err != nil {
		return nil, err
	}
	files, err := s.list(abs)
	if err != nil {
		return nil, err
	}
	if len(files) > limit {
		files = files[:limit]
	}
	out := make([]Hit, len(files))
	for i, path := range files {
		out[i] = Hit{Path: path, Name: filepath.Base(path)}
	}
	return out, nil
}

// Read returns a UTF-8 preview, refusing paths outside the workspace.
func (s *Service) Read(workspace, rel string, maxBytes int) (FileView, error) {
	abs, err := filepath.Abs(workspace)
	if err != nil {
		return FileView{}, err
	}
	root := abs
	if resolved, err := filepath.EvalSymlinks(abs); err == nil {
		root = resolved
	}
	if rel == "" || filepath.IsAbs(rel) {
		return FileView{}, errors.New("invalid path")
	}
	clean := filepath.Clean(rel)
	if clean == ".." || strings.HasPrefix(clean, ".."+string(filepath.Separator)) {
		return FileView{}, errors.New("path escapes the workspace")
	}
	full, err := filepath.EvalSymlinks(filepath.Join(abs, clean))
	if err != nil {
		return FileView{}, errors.New("file not found")
	}
	if !within(root, full) {
		return FileView{}, errors.New("path escapes the workspace")
	}
	info, err := os.Stat(full)
	if err != nil || info.IsDir() {
		return FileView{}, errors.New("file not found")
	}
	if !info.Mode().IsRegular() {
		return FileView{}, errors.New("not a regular file")
	}
	if maxBytes <= 0 || maxBytes > 2<<20 {
		maxBytes = 512 << 10
	}
	view := FileView{Path: clean, Size: info.Size()}
	if info.Size() > int64(maxBytes) {
		view.Truncated = true
	}
	f, err := os.Open(full)
	if err != nil {
		return FileView{}, err
	}
	defer f.Close()
	buf := make([]byte, maxBytes)
	n, _ := f.Read(buf)
	data := buf[:n]
	if bytes.IndexByte(data, 0) >= 0 {
		view.Binary = true
		return view, nil
	}
	view.Text = string(data)
	return view, nil
}

// within reports whether target is root or below it. Both must be resolved.
func within(root, target string) bool {
	rel, err := filepath.Rel(root, target)
	if err != nil {
		return false
	}
	return rel == "." || (rel != ".." && !strings.HasPrefix(rel, ".."+string(filepath.Separator)))
}
