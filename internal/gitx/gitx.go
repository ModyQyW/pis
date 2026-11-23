// Package gitx reads the workspace's Git state for the changes panel. It is
// read-only: it runs status, diff, and numstat, never checkout/reset/commit.
package gitx

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

// File is one changed path.
type File struct {
	Path      string `json:"path"`
	OldPath   string `json:"oldPath,omitempty"`
	Status    string `json:"status"` // M A D R C ?? U
	Staged    bool   `json:"staged"`
	Additions int    `json:"additions"`
	Deletions int    `json:"deletions"`
	Binary    bool   `json:"binary"`
}

// Status is the workspace's Git summary.
type Status struct {
	IsRepo   bool   `json:"isRepo"`
	Root     string `json:"root,omitempty"`
	Branch   string `json:"branch,omitempty"`
	Files    []File `json:"files"`
	Error    string `json:"error,omitempty"`
	Ahead    int    `json:"ahead"`
	Behind   int    `json:"behind"`
	Upstream string `json:"upstream,omitempty"`
}

// Service reads Git state.
type Service struct{}

// New creates a Git service.
func New() *Service { return &Service{} }

// Status returns the working tree summary for workspace.
func (s *Service) Status(ctx context.Context, workspace string) (Status, error) {
	dir, err := workspaceDir(workspace)
	if err != nil {
		return Status{}, err
	}
	root, err := run(ctx, dir, "rev-parse", "--show-toplevel")
	if err != nil {
		return Status{IsRepo: false, Error: "not a git repository"}, nil
	}
	out := Status{IsRepo: true, Root: strings.TrimSpace(root), Files: []File{}}
	if branch, err := run(ctx, dir, "rev-parse", "--abbrev-ref", "HEAD"); err == nil {
		out.Branch = strings.TrimSpace(branch)
	}
	if upstream, err := run(ctx, dir, "rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"); err == nil {
		out.Upstream = strings.TrimSpace(upstream)
		if counts, err := run(ctx, dir, "rev-list", "--left-right", "--count", "@{upstream}...HEAD"); err == nil {
			fields := strings.Fields(counts)
			if len(fields) == 2 {
				out.Behind, _ = strconv.Atoi(fields[0])
				out.Ahead, _ = strconv.Atoi(fields[1])
			}
		}
	}
	statusOut, err := run(ctx, dir, "status", "--porcelain=v1", "-z")
	if err != nil {
		return out, nil
	}
	out.Files = parseStatus(statusOut)
	adds := numstat(ctx, dir)
	for i := range out.Files {
		f := &out.Files[i]
		if stat, ok := adds[f.Path]; ok {
			f.Additions, f.Deletions, f.Binary = stat[0], stat[1], stat[2] != 0
		} else if f.Status == "??" {
			f.Additions = countLines(filepath.Join(out.Root, f.Path))
		}
	}
	return out, nil
}

func workspaceDir(workspace string) (string, error) {
	if strings.TrimSpace(workspace) == "" {
		return "", errors.New("empty workspace")
	}
	abs, err := filepath.Abs(workspace)
	if err != nil {
		return "", err
	}
	info, err := os.Stat(abs)
	if err != nil || !info.IsDir() {
		return "", errors.New("workspace is not a directory")
	}
	return abs, nil
}

func run(ctx context.Context, dir string, args ...string) (string, error) {
	cctx, cancel := context.WithTimeout(ctx, 8*time.Second)
	defer cancel()
	cmd := exec.CommandContext(cctx, "git", append([]string{"-C", dir}, args...)...)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		msg := strings.TrimSpace(stderr.String())
		if msg == "" {
			msg = err.Error()
		}
		return "", errors.New(msg)
	}
	return stdout.String(), nil
}

func parseStatus(out string) []File {
	records := strings.Split(out, "\x00")
	var files []File
	for i := 0; i < len(records); i++ {
		rec := records[i]
		if len(rec) < 4 {
			continue
		}
		x, y := rec[0], rec[1]
		path := rec[3:]
		if x == '!' {
			continue
		}
		file := File{Path: filepath.ToSlash(path), Staged: x != ' ' && x != '?'}
		switch {
		case x == '?' && y == '?':
			file.Status = "??"
		case x == 'R' || y == 'R':
			file.Status = "R"
		case x == 'C' || y == 'C':
			file.Status = "C"
		case x == 'U' || y == 'U':
			file.Status = "U"
		case x == 'A' || y == 'A':
			file.Status = "A"
		case x == 'D' || y == 'D':
			file.Status = "D"
		default:
			file.Status = "M"
		}
		if (x == 'R' || x == 'C') && i+1 < len(records) {
			file.OldPath = filepath.ToSlash(records[i+1])
			i++
		}
		files = append(files, file)
	}
	return files
}

func numstat(ctx context.Context, dir string) map[string][3]int {
	res := map[string][3]int{}
	out, err := run(ctx, dir, "diff", "HEAD", "--numstat", "-z", "--no-ext-diff")
	if err != nil {
		return res
	}
	records := strings.Split(out, "\x00")
	for i := 0; i < len(records); i++ {
		rec := records[i]
		if rec == "" {
			continue
		}
		parts := strings.SplitN(rec, "\t", 3)
		if len(parts) < 3 {
			continue
		}
		path := parts[2]
		if path == "" && i+1 < len(records) {
			path = records[i+1]
			i++
		}
		add, del := 0, 0
		binary := 0
		if parts[0] == "-" || parts[1] == "-" {
			binary = 1
		} else {
			add, _ = strconv.Atoi(parts[0])
			del, _ = strconv.Atoi(parts[1])
		}
		res[filepath.ToSlash(path)] = [3]int{add, del, binary}
	}
	return res
}

func countLines(path string) int {
	info, err := os.Stat(path)
	if err != nil || info.IsDir() || info.Size() > 2<<20 {
		return 0
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return 0
	}
	if bytes.IndexByte(data, 0) >= 0 {
		return 0
	}
	n := bytes.Count(data, []byte("\n"))
	if len(data) > 0 && data[len(data)-1] != '\n' {
		n++
	}
	return n
}

// Diff returns a unified diff for one path.
func (s *Service) Diff(ctx context.Context, workspace, path string) (string, error) {
	dir, err := workspaceDir(workspace)
	if err != nil {
		return "", err
	}
	if !safeRel(path) {
		return "", errors.New("invalid path")
	}
	out, err := run(ctx, dir, "diff", "HEAD", "--no-ext-diff", "--unified=3", "--", path)
	if err == nil && strings.TrimSpace(out) != "" {
		return out, nil
	}
	// Untracked: show the whole file as an addition.
	full := filepath.Join(dir, path)
	info, statErr := os.Stat(full)
	if statErr != nil || info.IsDir() || info.Size() > 2<<20 {
		return out, nil
	}
	data, readErr := os.ReadFile(full)
	if readErr != nil || bytes.IndexByte(data, 0) >= 0 {
		return out, nil
	}
	lines := strings.Split(string(data), "\n")
	var b strings.Builder
	fmt.Fprintf(&b, "@@ -0,0 +1,%d @@\n", len(lines))
	for _, line := range lines {
		b.WriteByte('+')
		b.WriteString(line)
		b.WriteByte('\n')
	}
	return b.String(), nil
}

// Revert restores one tracked path to HEAD in both the index and worktree.
// Untracked paths have no HEAD version and are rejected.
func (s *Service) Revert(ctx context.Context, workspace, path string) error {
	dir, err := workspaceDir(workspace)
	if err != nil {
		return err
	}
	if !safeRel(path) {
		return errors.New("invalid path")
	}
	statusOut, err := run(ctx, dir, "status", "--porcelain=v1", "-z", "--", path)
	if err != nil {
		return err
	}
	if strings.HasPrefix(statusOut, "??") {
		return errors.New("untracked file has no HEAD version to restore")
	}
	_, err = run(ctx, dir, "restore", "--source=HEAD", "--staged", "--worktree", "--", path)
	return err
}

func safeRel(path string) bool {
	if path == "" || filepath.IsAbs(path) {
		return false
	}
	clean := filepath.Clean(path)
	return clean != ".." && !strings.HasPrefix(clean, ".."+string(filepath.Separator))
}
