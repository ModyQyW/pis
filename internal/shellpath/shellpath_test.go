package shellpath

import (
	"os"
	"path/filepath"
	"runtime"
	"sync"
	"testing"
)

func TestParseTakesLastMarker(t *testing.T) {
	out := []byte("profile banner\n" + marker + "/before\n" + marker + "/one:/two\n")
	if got := parse(out); got != "/one:/two" {
		t.Fatalf("parse = %q", got)
	}
	if got := parse([]byte("no marker /bin")); got != "" {
		t.Fatalf("parse without marker = %q", got)
	}
}

func TestMergeDeduplicates(t *testing.T) {
	var got, want string
	if runtime.GOOS == "windows" {
		got = merge(`C:\a;C:\b`, `C:\b;C:\c`)
		want = `C:\a;C:\b;C:\c`
	} else {
		got = merge("/a:/b", "/b:/c")
		want = "/a:/b:/c"
	}
	if got != want {
		t.Fatalf("merge = %q want %q", got, want)
	}
}

func TestLoginReadsFakeShell(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("shell script fixture")
	}
	dir := t.TempDir()
	shell := filepath.Join(dir, "shell")
	script := "#!/bin/sh\nprintf '\\n" + marker + "/fake/bin:/usr/bin\\n'\n"
	if err := os.WriteFile(shell, []byte(script), 0o755); err != nil {
		t.Fatal(err)
	}
	t.Setenv("SHELL", shell)
	resetForTest()
	t.Cleanup(resetForTest)
	if got := Login(); got != "/fake/bin:/usr/bin" {
		t.Fatalf("Login = %q", got)
	}
}

func TestApplyPrependsLoginPath(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("login shell resolution is POSIX only")
	}
	dir := t.TempDir()
	shell := filepath.Join(dir, "shell")
	script := "#!/bin/sh\nprintf '\\n" + marker + "/login/bin\\n'\n"
	if err := os.WriteFile(shell, []byte(script), 0o755); err != nil {
		t.Fatal(err)
	}
	t.Setenv("SHELL", shell)
	t.Setenv("PATH", "/usr/bin:/bin")
	resetForTest()
	t.Cleanup(resetForTest)
	if got := Apply(); got != "/login/bin:/usr/bin:/bin" {
		t.Fatalf("Apply = %q", got)
	}
	if got := os.Getenv("PATH"); got != "/login/bin:/usr/bin:/bin" {
		t.Fatalf("process PATH = %q", got)
	}
}

func resetForTest() {
	once = sync.Once{}
	loginPath = ""
}
