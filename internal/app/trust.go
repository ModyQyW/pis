package app

import (
	"errors"
	"path/filepath"

	"pis/internal/sessions"
	"pis/internal/settings"
	"pis/internal/trust"
)

// WorkspaceTrust reports whether project-local pi resources may load.
func (s *Service) WorkspaceTrust(workspace string) (trust.Info, error) {
	abs, err := normalizeDir(workspace)
	if err != nil {
		return trust.Info{}, err
	}
	return trust.Inspect(abs, sessions.AgentDir(), s.store.Snapshot().Trust), nil
}

// SetTrust persists the app's trust decision for one workspace. Pi's own
// trust store is never written.
func (s *Service) SetTrust(workspace, decision string) (trust.Info, error) {
	abs, err := filepath.Abs(workspace)
	if err != nil {
		return trust.Info{}, err
	}
	var d settings.TrustDecision
	switch decision {
	case "trusted":
		d = settings.TrustTrusted
	case "untrusted":
		d = settings.TrustUntrusted
	case "undecided", "":
		d = settings.TrustUnknown
	default:
		return trust.Info{}, errors.New("trust decision must be trusted, untrusted, or undecided")
	}
	if err := s.store.Update(func(c *settings.Settings) error {
		if d == settings.TrustUnknown {
			delete(c.Trust, abs)
		} else {
			c.Trust[abs] = d
		}
		return nil
	}); err != nil {
		return trust.Info{}, err
	}
	return trust.Inspect(abs, sessions.AgentDir(), s.store.Snapshot().Trust), nil
}
