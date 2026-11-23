package auth

import (
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"
)

func TestLoginPtyRoundTrip(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("pty fixture")
	}
	dir := t.TempDir()
	script := filepath.Join(dir, "pi")
	if err := os.WriteFile(script, []byte("#!/bin/sh\nprintf 'Login prompt\\n'\nread line\necho \"got:$line\"\nexit 0\n"), 0o755); err != nil {
		t.Fatal(err)
	}
	var out strings.Builder
	exits := make(chan Exit, 1)
	m := New(func() string { return script }, func(o Output) { out.WriteString(o.Data) }, func(e Exit) { exits <- e })
	info, err := m.Start("test", false)
	if err != nil {
		t.Fatal(err)
	}
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) && !strings.Contains(out.String(), "Login prompt") {
		time.Sleep(20 * time.Millisecond)
	}
	if !strings.Contains(out.String(), "Login prompt") {
		t.Fatalf("no prompt: %q", out.String())
	}
	if err := m.Write(info.ID, "hello\n"); err != nil {
		t.Fatal(err)
	}
	select {
	case e := <-exits:
		if e.Code != 0 {
			t.Fatalf("exit: %+v", e)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("login did not exit")
	}
	if !strings.Contains(out.String(), "got:hello") {
		t.Fatalf("missing echo: %q", out.String())
	}
}
