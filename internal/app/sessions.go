package app

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"strings"

	"github.com/egoist/mygo"

	"pis/internal/agent"
	"pis/internal/sessions"
)

// SessionsService exposes pi's session files for display and management.
// It never writes session content; deletion goes through the system trash.
type SessionsService struct {
	agent *agent.Manager
}

// NewSessions creates the session service. mgr may be nil in tests.
func NewSessions(mgr *agent.Manager) *SessionsService {
	return &SessionsService{agent: mgr}
}

// List returns recent sessions for a workspace.
func (s *SessionsService) List(workspace string, limit int) ([]sessions.Summary, error) {
	if strings.TrimSpace(workspace) == "" {
		return nil, errors.New("empty workspace")
	}
	return sessions.List(workspace, limit)
}

// Search returns session text matches for the command palette.
func (s *SessionsService) Search(workspace, query string, limit int) ([]sessions.SearchHit, error) {
	if strings.TrimSpace(workspace) == "" {
		return nil, errors.New("empty workspace")
	}
	return sessions.Search(workspace, query, limit)
}

// Read returns the fast display transcript for a session file.
func (s *SessionsService) Read(path string) (sessions.Transcript, error) {
	if !sessions.AllowedPath(path) {
		return sessions.Transcript{}, errors.New("not a pi session file")
	}
	return sessions.Read(path)
}

// ReadAt returns the active branch ending at a specific leaf.
func (s *SessionsService) ReadAt(path, leafID string) (sessions.Transcript, error) {
	if !sessions.AllowedPath(path) {
		return sessions.Transcript{}, errors.New("not a pi session file")
	}
	return sessions.ReadAt(path, leafID)
}

// Summary returns one session's sidebar metadata.
func (s *SessionsService) Summary(path string) (sessions.Summary, error) {
	if !sessions.AllowedPath(path) {
		return sessions.Summary{}, errors.New("not a pi session file")
	}
	return sessions.ReadSummary(path)
}

// Delete closes a live process for the file, then moves it to the trash.
func (s *SessionsService) Delete(path string) error {
	if !sessions.AllowedPath(path) {
		return errors.New("not a pi session file")
	}
	abs, err := filepath.Abs(path)
	if err != nil {
		return err
	}
	if s.agent != nil {
		s.agent.CloseByFile(abs)
	}
	return mygo.Shell.TrashItem(abs)
}

// Reveal shows a session file in the file manager.
func (s *SessionsService) Reveal(path string) error {
	if !sessions.AllowedPath(path) {
		return errors.New("not a pi session file")
	}
	if _, err := os.Stat(path); err != nil {
		return err
	}
	return mygo.Shell.OpenPath(filepath.Dir(path))
}

// ExportHtml asks pi to export a session, returning the output path.
func (s *SessionsService) ExportHtml(ctx context.Context, path string) (string, error) {
	if !sessions.AllowedPath(path) {
		return "", errors.New("not a pi session file")
	}
	if s.agent == nil {
		return "", errors.New("agent is not available")
	}
	return s.agent.ExportHtml(ctx, path)
}
