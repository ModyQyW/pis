// Package auth runs pi's own login command in a pty. Output stays in memory
// and is never logged or persisted by the app.
package auth

import (
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/creack/pty"
)

// Info identifies a running login terminal.
type Info struct {
	ID       string `json:"id"`
	Provider string `json:"provider"`
}

// Output is a chunk of terminal output.
type Output struct {
	ID   string `json:"id"`
	Data string `json:"data"`
}

// Exit reports that the login process ended.
type Exit struct {
	ID   string `json:"id"`
	Code int    `json:"code"`
	Err  string `json:"error,omitempty"`
}

type session struct {
	id       string
	provider string
	cmd      *exec.Cmd
	ptmx     *os.File
	writeMu  sync.Mutex
	done     chan struct{}
	readDone chan struct{}
	once     sync.Once
}

// Manager owns at most one login terminal at a time.
type Manager struct {
	mu       sync.Mutex
	active   *session
	exec     func() string
	emit     func(Output)
	emitExit func(Exit)
}

// New creates a login manager. exec resolves the pi executable.
func New(executable func() string, emit func(Output), emitExit func(Exit)) *Manager {
	return &Manager{exec: executable, emit: emit, emitExit: emitExit}
}

var providerRE = regexp.MustCompile(`^[A-Za-z0-9._-]+$`)

// Start launches `pi auth login <provider>` (account) or with --api-key.
func (m *Manager) Start(provider string, apiKey bool) (Info, error) {
	provider = strings.TrimSpace(provider)
	if !providerRE.MatchString(provider) {
		return Info{}, errors.New("provider must be a simple id such as anthropic or openai")
	}
	exe := m.exec()
	if exe == "" {
		return Info{}, errors.New("pi was not found")
	}
	args := []string{"auth", "login", provider}
	if apiKey {
		args = append(args, "--api-key")
	}
	cmd := exec.Command(exe, args...)
	cmd.Env = append(os.Environ(),
		"TERM=xterm-256color",
		"COLORTERM=truecolor",
		"PIS=1",
	)
	ptmx, err := pty.Start(cmd)
	if err != nil {
		return Info{}, fmt.Errorf("start pi auth: %w", err)
	}
	id := fmt.Sprintf("login-%d", time.Now().UnixNano())
	s := &session{
		id: id, provider: provider, cmd: cmd, ptmx: ptmx,
		done: make(chan struct{}), readDone: make(chan struct{}),
	}

	m.mu.Lock()
	if m.active != nil {
		m.mu.Unlock()
		ptmx.Close()
		_ = cmd.Process.Kill()
		return Info{}, errors.New("a login terminal is already open")
	}
	m.active = s
	m.mu.Unlock()

	go m.read(s)
	go m.wait(s)
	return Info{ID: id, Provider: provider}, nil
}

func (m *Manager) read(s *session) {
	defer close(s.readDone)
	buf := make([]byte, 4096)
	for {
		n, err := s.ptmx.Read(buf)
		if n > 0 {
			m.emit(Output{ID: s.id, Data: string(buf[:n])})
		}
		if err != nil {
			return
		}
	}
}

func (m *Manager) wait(s *session) {
	err := s.cmd.Wait()
	code := 0
	msg := ""
	if err != nil {
		msg = err.Error()
		if exit, ok := err.(*exec.ExitError); ok {
			code = exit.ExitCode()
		}
	}
	s.once.Do(func() {
		// The child can exit while the pty still has the final bytes buffered.
		// Let the reader drain them before closing the descriptor and telling
		// the UI that the login ended.
		select {
		case <-s.readDone:
		case <-time.After(2 * time.Second):
		}
		close(s.done)
		m.mu.Lock()
		if m.active == s {
			m.active = nil
		}
		m.mu.Unlock()
		_ = s.ptmx.Close()
		m.emitExit(Exit{ID: s.id, Code: code, Err: msg})
	})
}

// Write sends terminal input.
func (m *Manager) Write(id, data string) error {
	m.mu.Lock()
	s := m.active
	m.mu.Unlock()
	if s == nil || s.id != id {
		return errors.New("login terminal not found")
	}
	s.writeMu.Lock()
	defer s.writeMu.Unlock()
	_, err := io.WriteString(s.ptmx, data)
	return err
}

// Resize changes the terminal size.
func (m *Manager) Resize(id string, cols, rows int) error {
	m.mu.Lock()
	s := m.active
	m.mu.Unlock()
	if s == nil || s.id != id {
		return errors.New("login terminal not found")
	}
	if cols <= 0 || rows <= 0 {
		return nil
	}
	return pty.Setsize(s.ptmx, &pty.Winsize{Cols: uint16(cols), Rows: uint16(rows)})
}

// Cancel interrupts the login and kills it if it does not exit.
func (m *Manager) Cancel(id string) error {
	m.mu.Lock()
	s := m.active
	m.mu.Unlock()
	if s == nil || s.id != id {
		return nil
	}
	s.writeMu.Lock()
	_, _ = s.ptmx.Write([]byte{3})
	s.writeMu.Unlock()
	go func() {
		select {
		case <-s.done:
		case <-time.After(2 * time.Second):
			_ = s.cmd.Process.Kill()
		}
	}()
	return nil
}

// Shutdown stops a login left open when the app quits.
func (m *Manager) Shutdown() {
	m.mu.Lock()
	s := m.active
	m.active = nil
	m.mu.Unlock()
	if s != nil {
		_ = s.cmd.Process.Kill()
		_ = s.ptmx.Close()
	}
}
