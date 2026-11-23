package gitx

import (
	"context"
	"errors"
	"path/filepath"
	"strings"
)

// Worktree is one entry of `git worktree list --porcelain`.
type Worktree struct {
	Path     string `json:"path"`
	Head     string `json:"head,omitempty"`
	Branch   string `json:"branch,omitempty"`
	Bare     bool   `json:"bare,omitempty"`
	Detached bool   `json:"detached,omitempty"`
	Locked   bool   `json:"locked,omitempty"`
	Prunable bool   `json:"prunable,omitempty"`
}

// Worktrees lists the repository's worktrees.
func (s *Service) Worktrees(ctx context.Context, workspace string) ([]Worktree, error) {
	dir, err := workspaceDir(workspace)
	if err != nil {
		return nil, err
	}
	out, err := run(ctx, dir, "worktree", "list", "--porcelain")
	if err != nil {
		return nil, err
	}
	var list []Worktree
	var current *Worktree
	flush := func() {
		if current != nil && current.Path != "" {
			list = append(list, *current)
		}
		current = nil
	}
	for _, line := range strings.Split(out, "\n") {
		line = strings.TrimRight(line, "\r")
		if line == "" {
			flush()
			continue
		}
		key, value, _ := strings.Cut(line, " ")
		if key == "worktree" {
			flush()
			current = &Worktree{Path: value}
			continue
		}
		if current == nil {
			continue
		}
		switch key {
		case "HEAD":
			current.Head = value
		case "branch":
			current.Branch = strings.TrimPrefix(value, "refs/heads/")
		case "bare":
			current.Bare = true
		case "detached":
			current.Detached = true
		case "locked":
			current.Locked = true
		case "prunable":
			current.Prunable = true
		}
	}
	flush()
	for i := range list {
		if resolved, err := filepath.EvalSymlinks(list[i].Path); err == nil {
			list[i].Path = resolved
		}
	}
	return list, nil
}

// AddWorktree creates a worktree at path. When createBranch is true, branch is
// created from HEAD; otherwise it is checked out.
func (s *Service) AddWorktree(ctx context.Context, workspace, path, branch string, createBranch bool) error {
	dir, err := workspaceDir(workspace)
	if err != nil {
		return err
	}
	path = strings.TrimSpace(path)
	branch = strings.TrimSpace(branch)
	if path == "" {
		return errors.New("worktree path is required")
	}
	abs, err := filepath.Abs(path)
	if err != nil {
		return err
	}
	args := []string{"worktree", "add"}
	if createBranch {
		if branch == "" {
			return errors.New("branch name is required")
		}
		args = append(args, "-b", branch, abs)
	} else {
		args = append(args, abs)
		if branch != "" {
			args = append(args, branch)
		}
	}
	_, err = run(ctx, dir, args...)
	return err
}

// RemoveWorktree removes a linked worktree. The main worktree cannot be
// removed by git and is reported as an error.
func (s *Service) RemoveWorktree(ctx context.Context, workspace, path string, force bool) error {
	dir, err := workspaceDir(workspace)
	if err != nil {
		return err
	}
	path = strings.TrimSpace(path)
	if path == "" {
		return errors.New("worktree path is required")
	}
	abs, err := filepath.Abs(path)
	if err != nil {
		return err
	}
	args := []string{"worktree", "remove"}
	if force {
		args = append(args, "--force")
	}
	args = append(args, abs)
	_, err = run(ctx, dir, args...)
	return err
}
