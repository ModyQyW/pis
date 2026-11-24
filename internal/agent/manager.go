package agent

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"pis/internal/shellpath"
)

type session struct {
	info SessionInfo
	proc *process
}

// Manager owns one pi RPC process per open session.
type Manager struct {
	mu          sync.Mutex
	sessions    map[string]*session
	executable  string
	bridgePath  string
	guardPolicy string
	emit        func(Event)
	coalesce    *coalescer
}

// NewManager creates a manager. emit receives every UI event, including
// coalesced deltas and extension UI requests.
func NewManager(emit func(Event)) *Manager {
	m := &Manager{
		sessions: map[string]*session{},
		emit:     emit,
	}
	m.coalesce = newCoalescer(emit)
	return m
}

// SetGuardPolicy sets the bridge approval policy for new sessions.
func (m *Manager) SetGuardPolicy(policy string) {
	switch policy {
	case "smart", "ask", "allow", "off":
	default:
		policy = "off"
	}
	m.mu.Lock()
	m.guardPolicy = policy
	m.mu.Unlock()
}

// SetBridgePath sets the bundled extension loaded into every new session.
func (m *Manager) SetBridgePath(path string) {
	m.mu.Lock()
	m.bridgePath = path
	m.mu.Unlock()
}

// SetExecutable sets the pi binary used for new sessions.
func (m *Manager) SetExecutable(path string) {
	m.mu.Lock()
	m.executable = path
	m.mu.Unlock()
}

// Executable returns the configured binary, or resolves pi from PATH.
func (m *Manager) Executable() string {
	m.mu.Lock()
	path := m.executable
	m.mu.Unlock()
	if path != "" {
		return path
	}
	if p, err := exec.LookPath("pi"); err == nil {
		return p
	}
	return ""
}

// Shutdown closes every session.
func (m *Manager) Shutdown() {
	m.mu.Lock()
	sessions := make([]*session, 0, len(m.sessions))
	for _, s := range m.sessions {
		sessions = append(sessions, s)
	}
	m.sessions = map[string]*session{}
	m.mu.Unlock()
	for _, s := range sessions {
		s.proc.close()
	}
	m.coalesce.Close()
}

// Start opens a pi session and waits until its state is readable.
func (m *Manager) Start(ctx context.Context, req StartRequest) (SessionInfo, error) {
	shellpath.Apply()
	exe := m.Executable()
	if exe == "" {
		return SessionInfo{}, errors.New("pi was not found; set its path in Settings")
	}
	cwd := strings.TrimSpace(req.Cwd)
	path := strings.TrimSpace(req.Path)
	if path != "" {
		abs, err := filepath.Abs(path)
		if err != nil {
			return SessionInfo{}, err
		}
		path = abs
		if _, err := os.Stat(path); err != nil {
			return SessionInfo{}, fmt.Errorf("session file: %w", err)
		}
		if cwd == "" {
			cwd = readSessionCwd(path)
		}
	}
	if cwd == "" {
		return SessionInfo{}, errors.New("a working directory is required")
	}
	absCwd, err := filepath.Abs(cwd)
	if err != nil {
		return SessionInfo{}, err
	}
	info, err := os.Stat(absCwd)
	if err != nil || !info.IsDir() {
		return SessionInfo{}, fmt.Errorf("%s is not a directory", absCwd)
	}
	cwd = absCwd

	id := strings.TrimSpace(req.ID)
	if path == "" {
		if id == "" {
			id = newID()
		}
		if !validSessionID(id) {
			return SessionInfo{}, fmt.Errorf("invalid session id %q", id)
		}
	} else {
		id = newID()
	}

	args := []string{"--mode", "rpc"}
	if path != "" {
		args = append(args, "--session", path)
	} else {
		args = append(args, "--session-id", id)
		if req.Name != "" {
			args = append(args, "--name", req.Name)
		}
	}
	if req.Trusted {
		args = append(args, "--approve")
	}
	bridgePath := req.BridgePath
	m.mu.Lock()
	if bridgePath == "" {
		bridgePath = m.bridgePath
	}
	m.mu.Unlock()
	if bridgePath != "" {
		args = append(args, "-e", bridgePath)
	}
	m.mu.Lock()
	guardPolicy := m.guardPolicy
	m.mu.Unlock()
	if guardPolicy == "" {
		guardPolicy = "off"
	}
	env := append(os.Environ(),
		"PIS=1",
		"PIS_SESSION_ID="+id,
		"PIS_GUARD="+guardPolicy,
		"PIS_WORKSPACE="+cwd,
	)

	s := &session{info: SessionInfo{
		ID:          id,
		PiSessionID: id,
		File:        path,
		Cwd:         cwd,
		Name:        req.Name,
		StartedAt:   time.Now(),
	}}
	m.mu.Lock()
	m.sessions[id] = s
	m.mu.Unlock()

	proc, err := startProcess(processOptions{
		executable: exe,
		cwd:        cwd,
		args:       args,
		env:        env,
		onRecord: func(raw []byte) {
			m.observe(id, raw)
			m.coalesce.Push(id, raw)
		},
		onUI: func(raw []byte) {
			m.emit(Event{SessionID: id, Kind: "extension-ui", Raw: RawJSON(raw)})
		},
		onExit: func(err error, tail string) {
			m.mu.Lock()
			delete(m.sessions, id)
			m.mu.Unlock()
			msg := ""
			if err != nil {
				msg = err.Error()
			}
			if tail != "" {
				msg = strings.TrimSpace(msg + "\n" + tail)
			}
			m.emit(Event{SessionID: id, Kind: "status", Status: "exited", Error: msg})
		},
	})
	if err != nil {
		m.mu.Lock()
		delete(m.sessions, id)
		m.mu.Unlock()
		return SessionInfo{}, err
	}
	s.proc = proc
	m.emit(Event{SessionID: id, Kind: "status", Status: "starting"})

	state, err := m.fetchState(ctx, id, 20*time.Second)
	if err != nil {
		proc.close()
		m.mu.Lock()
		delete(m.sessions, id)
		m.mu.Unlock()
		return SessionInfo{}, err
	}
	m.applyState(id, state)
	infoOut := m.Info(id)
	m.emit(Event{SessionID: id, Kind: "status", Status: "ready"})
	return infoOut, nil
}

func readSessionCwd(path string) string {
	f, err := os.Open(path)
	if err != nil {
		return ""
	}
	defer f.Close()
	buf := make([]byte, 64*1024)
	n, _ := f.Read(buf)
	line := strings.SplitN(string(buf[:n]), "\n", 2)[0]
	var head struct {
		Cwd string `json:"cwd"`
	}
	if json.Unmarshal([]byte(line), &head) == nil {
		return head.Cwd
	}
	return ""
}

func (m *Manager) fetchState(ctx context.Context, id string, timeout time.Duration) (SessionState, error) {
	m.mu.Lock()
	s := m.sessions[id]
	m.mu.Unlock()
	if s == nil {
		return SessionState{}, ErrNoSession
	}
	cctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	resp, err := s.proc.call(cctx, map[string]any{"type": "get_state", "_timeout": timeout})
	if err != nil {
		return SessionState{}, err
	}
	return decodeData[SessionState](resp)
}

func (m *Manager) applyState(id string, state SessionState) {
	m.mu.Lock()
	defer m.mu.Unlock()
	s := m.sessions[id]
	if s == nil {
		return
	}
	if state.Model != nil {
		model := *state.Model
		s.info.Model = &model
	}
	s.info.Thinking = state.ThinkingLevel
	s.info.Streaming = state.IsStreaming
	s.info.Compacting = state.IsCompacting
	s.info.AutoCompaction = state.AutoCompaction
	s.info.MessageCount = state.MessageCount
	if state.SessionFile != "" {
		s.info.File = state.SessionFile
	}
	if state.SessionID != "" {
		s.info.PiSessionID = state.SessionID
	}
	if state.SessionName != "" {
		s.info.Name = state.SessionName
	}
}

// observe updates session bookkeeping from pi's event stream. It never logs
// event contents.
func (m *Manager) observe(id string, raw []byte) {
	var head struct {
		Type string `json:"type"`
		Name string `json:"name"`
	}
	if json.Unmarshal(raw, &head) != nil {
		return
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	s := m.sessions[id]
	if s == nil {
		return
	}
	switch head.Type {
	case "agent_start", "turn_start":
		s.info.Streaming = true
	case "agent_settled":
		s.info.Streaming = false
	case "compaction_start":
		s.info.Compacting = true
	case "compaction_end":
		s.info.Compacting = false
	case "session_info_changed":
		s.info.Name = head.Name
	case "model_select":
		// The next get_state fills the full model. A short refresh is enough
		// for the UI to stop showing a stale name after a switch.
		var ev struct {
			Model *Model `json:"model"`
		}
		if json.Unmarshal(raw, &ev) == nil && ev.Model != nil {
			model := *ev.Model
			s.info.Model = &model
		}
	}
}

// Info returns one session.
func (m *Manager) Info(id string) SessionInfo {
	m.mu.Lock()
	defer m.mu.Unlock()
	if s := m.sessions[id]; s != nil {
		return s.info
	}
	return SessionInfo{}
}

// RunningCount reports sessions with active model or tool work.
func (m *Manager) RunningCount() int {
	m.mu.Lock()
	defer m.mu.Unlock()
	n := 0
	for _, s := range m.sessions {
		if s.info.Streaming || s.info.Compacting {
			n++
		}
	}
	return n
}

// List returns live sessions, newest first.
func (m *Manager) List() []SessionInfo {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := make([]SessionInfo, 0, len(m.sessions))
	for _, s := range m.sessions {
		out = append(out, s.info)
	}
	sort.SliceStable(out, func(i, j int) bool { return out[i].StartedAt.After(out[j].StartedAt) })
	return out
}

// GetState refreshes and returns state.
func (m *Manager) GetState(ctx context.Context, id string) (SessionState, error) {
	state, err := m.fetchState(ctx, id, 15*time.Second)
	if err == nil {
		m.applyState(id, state)
	}
	return state, err
}

// GetMessages returns pi's authoritative conversation.
func (m *Manager) GetMessages(ctx context.Context, id string) ([]RawJSON, error) {
	resp, err := m.call(ctx, id, map[string]any{"type": "get_messages"}, 30*time.Second)
	if err != nil {
		return nil, err
	}
	var data struct {
		Messages []json.RawMessage `json:"messages"`
	}
	if err := json.Unmarshal(resp.Data, &data); err != nil {
		return nil, err
	}
	out := make([]RawJSON, len(data.Messages))
	for i, msg := range data.Messages {
		out[i] = RawJSON(msg)
	}
	return out, nil
}

// GetCommands returns pi's extension commands, prompt templates, and skills.
func (m *Manager) GetCommands(ctx context.Context, id string) (RawJSON, error) {
	resp, err := m.call(ctx, id, map[string]any{"type": "get_commands"}, 20*time.Second)
	if err != nil {
		return nil, err
	}
	return RawJSON(resp.Data), nil
}

// GetStats returns token, cost, and context usage.
func (m *Manager) GetStats(ctx context.Context, id string) (RawJSON, error) {
	resp, err := m.call(ctx, id, map[string]any{"type": "get_session_stats"}, 20*time.Second)
	if err != nil {
		return nil, err
	}
	return RawJSON(resp.Data), nil
}

// GetTree returns the session tree.
func (m *Manager) GetTree(ctx context.Context, id string) (RawJSON, error) {
	resp, err := m.call(ctx, id, map[string]any{"type": "get_tree"}, 30*time.Second)
	if err != nil {
		return nil, err
	}
	return RawJSON(resp.Data), nil
}

// GetEntries returns the append-only entries and the active leaf.
func (m *Manager) GetEntries(ctx context.Context, id string) (RawJSON, error) {
	resp, err := m.call(ctx, id, map[string]any{"type": "get_entries"}, 30*time.Second)
	if err != nil {
		return nil, err
	}
	return RawJSON(resp.Data), nil
}

// GetForkMessages returns the user messages available for forking.
func (m *Manager) GetForkMessages(ctx context.Context, id string) (RawJSON, error) {
	resp, err := m.call(ctx, id, map[string]any{"type": "get_fork_messages"}, 20*time.Second)
	if err != nil {
		return nil, err
	}
	return RawJSON(resp.Data), nil
}

// Fork creates a new independent session from an earlier user message.
func (m *Manager) Fork(ctx context.Context, id, entryID string) (SessionInfo, error) {
	if entryID == "" {
		return SessionInfo{}, errors.New("empty entry id")
	}
	if _, err := m.call(ctx, id, map[string]any{"type": "fork", "entryId": entryID}, 60*time.Second); err != nil {
		return SessionInfo{}, err
	}
	return m.refreshInfo(ctx, id)
}

// Clone duplicates the active branch into a new session.
func (m *Manager) Clone(ctx context.Context, id string) (SessionInfo, error) {
	if _, err := m.call(ctx, id, map[string]any{"type": "clone"}, 60*time.Second); err != nil {
		return SessionInfo{}, err
	}
	return m.refreshInfo(ctx, id)
}

// NavigateTree moves the active leaf through the bridge extension.
func (m *Manager) NavigateTree(ctx context.Context, id, entryID string, summarize bool) error {
	if entryID == "" {
		return errors.New("empty entry id")
	}
	message := "/pis-navigate " + entryID
	if summarize {
		message += " summarize"
	}
	resp, err := m.call(ctx, id, map[string]any{"type": "prompt", "message": message}, 120*time.Second)
	if err != nil {
		return err
	}
	var data struct {
		Disposition string `json:"disposition"`
	}
	_ = json.Unmarshal(resp.Data, &data)
	if data.Disposition != "handled" {
		return errors.New("tree navigation was not handled; restart the session to load the bridge")
	}
	return nil
}

func (m *Manager) refreshInfo(ctx context.Context, id string) (SessionInfo, error) {
	state, err := m.fetchState(ctx, id, 20*time.Second)
	if err != nil {
		return SessionInfo{}, err
	}
	m.applyState(id, state)
	return m.Info(id), nil
}

// Prompt sends a message and returns pi's disposition.
func (m *Manager) Prompt(ctx context.Context, req PromptRequest) (PromptResult, error) {
	if strings.TrimSpace(req.Message) == "" && len(req.Images) == 0 {
		return PromptResult{}, errors.New("empty prompt")
	}
	command := map[string]any{"type": "prompt", "message": req.Message}
	if len(req.Images) > 0 {
		command["images"] = req.Images
	}
	if req.Behavior != "" {
		command["streamingBehavior"] = req.Behavior
	}
	resp, err := m.call(ctx, req.SessionID, command, 30*time.Second)
	if err != nil {
		return PromptResult{}, err
	}
	var data struct {
		Disposition string `json:"disposition"`
	}
	_ = json.Unmarshal(resp.Data, &data)
	if data.Disposition == "started" || data.Disposition == "queued" {
		m.mu.Lock()
		if s := m.sessions[req.SessionID]; s != nil {
			s.info.Streaming = true
		}
		m.mu.Unlock()
	}
	return PromptResult{Disposition: data.Disposition}, nil
}

// Abort stops the current operation.
func (m *Manager) Abort(ctx context.Context, id string) error {
	_, err := m.call(ctx, id, map[string]any{"type": "abort"}, 60*time.Second)
	return err
}

// GetModels returns the models pi can currently use.
func (m *Manager) GetModels(ctx context.Context, id string) ([]Model, error) {
	resp, err := m.call(ctx, id, map[string]any{"type": "get_available_models"}, 30*time.Second)
	if err != nil {
		return nil, err
	}
	var data struct {
		Models []Model `json:"models"`
	}
	if err := json.Unmarshal(resp.Data, &data); err != nil {
		return nil, err
	}
	return data.Models, nil
}

// GetThinkingLevels returns the levels the current model supports.
func (m *Manager) GetThinkingLevels(ctx context.Context, id string) ([]string, error) {
	resp, err := m.call(ctx, id, map[string]any{"type": "get_available_thinking_levels"}, 15*time.Second)
	if err != nil {
		return nil, err
	}
	var data struct {
		Levels []string `json:"levels"`
	}
	if err := json.Unmarshal(resp.Data, &data); err != nil {
		return nil, err
	}
	return data.Levels, nil
}

// SetAutoCompaction turns automatic context compaction on or off.
func (m *Manager) SetAutoCompaction(ctx context.Context, id string, enabled bool) error {
	_, err := m.call(ctx, id, map[string]any{"type": "set_auto_compaction", "enabled": enabled}, 15*time.Second)
	return err
}

// SetModel switches the session model.
func (m *Manager) SetModel(ctx context.Context, id, provider, model string) (Model, error) {
	resp, err := m.call(ctx, id, map[string]any{
		"type": "set_model", "provider": provider, "modelId": model,
	}, 20*time.Second)
	if err != nil {
		return Model{}, err
	}
	var out Model
	if err := json.Unmarshal(resp.Data, &out); err != nil {
		return Model{}, err
	}
	m.mu.Lock()
	if s := m.sessions[id]; s != nil {
		mcopy := out
		s.info.Model = &mcopy
	}
	m.mu.Unlock()
	return out, nil
}

// SetThinking switches the reasoning level.
func (m *Manager) SetThinking(ctx context.Context, id, level string) error {
	_, err := m.call(ctx, id, map[string]any{"type": "set_thinking_level", "level": level}, 15*time.Second)
	if err == nil {
		m.mu.Lock()
		if s := m.sessions[id]; s != nil {
			s.info.Thinking = level
		}
		m.mu.Unlock()
	}
	return err
}

// SetName renames the current pi session.
func (m *Manager) SetName(ctx context.Context, id, name string) error {
	if strings.TrimSpace(name) == "" {
		return errors.New("empty session name")
	}
	_, err := m.call(ctx, id, map[string]any{"type": "set_session_name", "name": strings.TrimSpace(name)}, 15*time.Second)
	if err == nil {
		m.mu.Lock()
		if s := m.sessions[id]; s != nil {
			s.info.Name = strings.TrimSpace(name)
		}
		m.mu.Unlock()
	}
	return err
}

// Compact compacts the context manually.
func (m *Manager) Compact(ctx context.Context, id string) (RawJSON, error) {
	resp, err := m.call(ctx, id, map[string]any{"type": "compact"}, 180*time.Second)
	if err != nil {
		return nil, err
	}
	return RawJSON(resp.Data), nil
}

// Close stops one session.
func (m *Manager) Close(id string) {
	m.mu.Lock()
	s := m.sessions[id]
	delete(m.sessions, id)
	m.mu.Unlock()
	if s != nil {
		s.proc.close()
	}
}

func (m *Manager) call(ctx context.Context, id string, command map[string]any, timeout time.Duration) (Response, error) {
	m.mu.Lock()
	s := m.sessions[id]
	m.mu.Unlock()
	if s == nil {
		return Response{}, ErrNoSession
	}
	cctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	command["_timeout"] = timeout
	return s.proc.call(cctx, command)
}

func newID() string {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		return fmt.Sprintf("s%d", time.Now().UnixNano())
	}
	return hex.EncodeToString(b[:])
}

func validSessionID(id string) bool {
	if len(id) < 2 || len(id) > 128 {
		return false
	}
	for _, r := range id {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '.' || r == '_' || r == '-' {
			continue
		}
		return false
	}
	return true
}

// RespondUI answers an extension dialog. Fire-and-forget requests should not
// be answered.
func (m *Manager) RespondUI(ctx context.Context, sessionID string, resp UIResponse) error {
	if resp.ID == "" {
		return errors.New("empty extension UI id")
	}
	m.mu.Lock()
	s := m.sessions[sessionID]
	m.mu.Unlock()
	if s == nil {
		return ErrNoSession
	}
	command := map[string]any{"type": "extension_ui_response", "id": resp.ID}
	if resp.Value != nil {
		command["value"] = *resp.Value
	}
	if resp.Confirmed != nil {
		command["confirmed"] = *resp.Confirmed
	}
	if resp.Cancelled != nil {
		command["cancelled"] = *resp.Cancelled
	}
	return s.proc.write(command)
}

// CloseByFile stops the live process for a session file, if any.
func (m *Manager) CloseByFile(path string) {
	abs, err := filepath.Abs(path)
	if err != nil {
		return
	}
	var target string
	m.mu.Lock()
	for id, s := range m.sessions {
		if s.info.File == abs {
			target = id
			break
		}
	}
	m.mu.Unlock()
	if target != "" {
		m.Close(target)
	}
}

// ExportHtml asks a live session's pi to export HTML next to the session.
func (m *Manager) ExportHtml(ctx context.Context, path string) (string, error) {
	abs, err := filepath.Abs(path)
	if err != nil {
		return "", err
	}
	m.mu.Lock()
	var target string
	for id, s := range m.sessions {
		if s.info.File == abs {
			target = id
			break
		}
	}
	m.mu.Unlock()
	if target == "" {
		return "", errors.New("open the session before exporting it")
	}
	resp, err := m.call(ctx, target, map[string]any{"type": "export_html"}, 60*time.Second)
	if err != nil {
		return "", err
	}
	var data struct {
		Path string `json:"path"`
	}
	if err := json.Unmarshal(resp.Data, &data); err != nil {
		return "", err
	}
	return data.Path, nil
}
