// Package agent runs pi in RPC mode and exposes its sessions to the app.
//
// The package owns process lifecycle, JSONL framing, command correlation,
// delta coalescing, and a small typed view of session state. It never writes
// pi's session, auth, model, or settings files.
package agent

import (
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"pi-mygo/internal/jsonx"
)

// RawJSON is a JSON value passed through without decoding.
type RawJSON = jsonx.RawJSON

// Response is one RPC command response.
type Response struct {
	Type    string          `json:"type"`
	ID      string          `json:"id,omitempty"`
	Command string          `json:"command"`
	Success bool            `json:"success"`
	Data    json.RawMessage `json:"data,omitempty"`
	Error   string          `json:"error,omitempty"`
}

// ErrCommand reports a pi command that returned success:false.
type ErrCommand struct {
	Command string
	Message string
}

func (e *ErrCommand) Error() string {
	if e.Message == "" {
		return "pi command " + e.Command + " failed"
	}
	return "pi " + e.Command + ": " + e.Message
}

// Model is the subset of pi's model object the UI needs.
type Model struct {
	ID            string   `json:"id"`
	Name          string   `json:"name"`
	Provider      string   `json:"provider"`
	API           string   `json:"api"`
	ContextWindow int      `json:"contextWindow"`
	MaxTokens     int      `json:"maxTokens"`
	Reasoning     bool     `json:"reasoning"`
	Input         []string `json:"input"`
}

// SessionState is get_state's useful subset.
type SessionState struct {
	Model          *Model `json:"model"`
	ThinkingLevel  string `json:"thinkingLevel"`
	IsStreaming    bool   `json:"isStreaming"`
	IsCompacting   bool   `json:"isCompacting"`
	SessionFile    string `json:"sessionFile"`
	SessionID      string `json:"sessionId"`
	SessionName    string `json:"sessionName"`
	AutoCompaction bool   `json:"autoCompactionEnabled"`
	MessageCount   int    `json:"messageCount"`
	PendingCount   int    `json:"pendingMessageCount"`
	SteeringMode   string `json:"steeringMode"`
	FollowUpMode   string `json:"followUpMode"`
}

// SessionInfo is the app's view of one live pi process.
type SessionInfo struct {
	ID             string    `json:"id"`
	PiSessionID    string    `json:"piSessionId"`
	File           string    `json:"file"`
	Cwd            string    `json:"cwd"`
	Name           string    `json:"name"`
	Model          *Model    `json:"model"`
	Thinking       string    `json:"thinkingLevel"`
	Streaming      bool      `json:"streaming"`
	Compacting     bool      `json:"compacting"`
	AutoCompaction bool      `json:"autoCompaction"`
	MessageCount   int       `json:"messageCount"`
	StartedAt      time.Time `json:"startedAt"`
}

// StartRequest opens a new session or resumes an existing one.
type StartRequest struct {
	// ID is an optional app id for a new session (letters, numbers, . _ -).
	// Ignored when Path is set.
	ID string `json:"id,omitempty"`
	// Cwd is the project directory. Required for a new session; for a resume
	// it defaults to the session header's cwd when empty.
	Cwd string `json:"cwd,omitempty"`
	// Path resumes a session JSONL file.
	Path string `json:"path,omitempty"`
	// Name sets the display name of a new session.
	Name string `json:"name,omitempty"`
	// Trusted passes --approve, allowing project-local pi resources.
	Trusted bool `json:"trusted"`
	// BridgePath is the bundled extension loaded with -e.
	BridgePath string `json:"bridgePath,omitempty"`
}

// Image is an image attached to a prompt.
type Image struct {
	Type     string `json:"type"` // "image"
	Data     string `json:"data"` // base64
	MimeType string `json:"mimeType"`
}

// PromptRequest sends a message.
type PromptRequest struct {
	SessionID string  `json:"sessionId"`
	Message   string  `json:"message"`
	Images    []Image `json:"images,omitempty"`
	// Behavior is "" for a new run, "steer" or "followUp" while streaming.
	Behavior string `json:"behavior,omitempty"`
}

// PromptResult reports what happened to a submitted prompt.
type PromptResult struct {
	Disposition string `json:"disposition"`
}

// UIResponse answers an extension dialog request.
type UIResponse struct {
	ID        string  `json:"id"`
	Value     *string `json:"value,omitempty"`
	Confirmed *bool   `json:"confirmed,omitempty"`
	Cancelled *bool   `json:"cancelled,omitempty"`
}

// Event is the app-wide stream for one session.
type Event struct {
	SessionID string  `json:"sessionId"`
	Kind      string  `json:"kind"` // status | event | text | thinking | error
	Status    string  `json:"status,omitempty"`
	Error     string  `json:"error,omitempty"`
	Raw       RawJSON `json:"raw,omitempty"`
	Index     int     `json:"contentIndex,omitempty"`
	Delta     string  `json:"delta,omitempty"`
}

// ErrNoSession is returned for an unknown app session id.
var ErrNoSession = errors.New("session not found")

// maxRecordBytes bounds one protocol line. Tool results can be large; this is
// a safety limit, not a normal truncation point.
const maxRecordBytes = 64 << 20

func decodeData[T any](r Response) (T, error) {
	var v T
	if !r.Success {
		return v, &ErrCommand{Command: r.Command, Message: r.Error}
	}
	if len(r.Data) == 0 {
		return v, nil
	}
	if err := json.Unmarshal(r.Data, &v); err != nil {
		return v, fmt.Errorf("decode %s response: %w", r.Command, err)
	}
	return v, nil
}
