package sessions

import (
	"os"
	"testing"
	"time"
)

func TestReadRealSession(t *testing.T) {
	path := os.Getenv("PI_MYGO_SESSION_FILE")
	if path == "" {
		t.Skip("set PI_MYGO_SESSION_FILE to a real pi session")
	}
	start := time.Now()
	tr, err := Read(path)
	if err != nil {
		t.Fatal(err)
	}
	t.Logf("read %d entries in %s; name=%q leaf=%s", len(tr.Entries), time.Since(start), tr.Name, tr.LeafID)
	if len(tr.Entries) == 0 {
		t.Fatal("no entries")
	}
}

func TestListRealWorkspace(t *testing.T) {
	cwd := os.Getenv("PI_MYGO_WORKSPACE")
	if cwd == "" {
		t.Skip("set PI_MYGO_WORKSPACE to a real project")
	}
	start := time.Now()
	list, err := List(cwd, 50)
	if err != nil {
		t.Fatal(err)
	}
	t.Logf("listed %d sessions in %s", len(list), time.Since(start))
	for i, s := range list {
		if i >= 3 {
			break
		}
		t.Logf("%s  %s  %s", s.ID, s.Title, s.Path)
	}
}
