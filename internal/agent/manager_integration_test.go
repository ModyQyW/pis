package agent

import (
	"context"
	"os"
	"testing"
	"time"

	"pi-mygo/internal/piinfo"
)

// This test starts the installed pi. It never sends a prompt, so it does not
// spend model tokens. Run with PI_MYGO_INTEGRATION=1.
func TestStartAndInspectRealPi(t *testing.T) {
	if os.Getenv("PI_MYGO_INTEGRATION") != "1" {
		t.Skip("set PI_MYGO_INTEGRATION=1 to run against the installed pi")
	}
	st := piinfo.Discover(context.Background(), os.Getenv("PI_MYGO_PI"))
	if !st.Found || !st.Compatible {
		t.Fatalf("pi is not usable: %+v", st)
	}
	t.Setenv("PI_CODING_AGENT_SESSION_DIR", t.TempDir())
	ctx, cancel := context.WithTimeout(context.Background(), 40*time.Second)
	defer cancel()

	events := make(chan Event, 256)
	m := NewManager(func(ev Event) {
		select {
		case events <- ev:
		default:
		}
	})
	defer m.Shutdown()
	m.SetExecutable(st.Path)

	info, err := m.Start(ctx, StartRequest{Cwd: t.TempDir()})
	if err != nil {
		t.Fatalf("Start: %v", err)
	}
	if info.ID == "" || info.Cwd == "" {
		t.Fatalf("bad info: %+v", info)
	}
	if info.Model == nil {
		t.Log("no model selected; that is valid for a fresh unauthenticated state")
	}
	state, err := m.GetState(ctx, info.ID)
	if err != nil {
		t.Fatalf("GetState: %v", err)
	}
	if state.SessionID == "" {
		t.Fatalf("empty session id: %+v", state)
	}
	commands, err := m.GetCommands(ctx, info.ID)
	if err != nil {
		t.Fatalf("GetCommands: %v", err)
	}
	if len(commands) == 0 {
		t.Fatal("empty commands payload")
	}
	m.Close(info.ID)
}
