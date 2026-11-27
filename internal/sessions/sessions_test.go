package sessions

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func writeSession(t *testing.T, dir, name string, lines []map[string]any, cwd string) string {
	t.Helper()
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(dir, name)
	var b strings.Builder
	for _, line := range lines {
		data, err := json.Marshal(line)
		if err != nil {
			t.Fatal(err)
		}
		b.Write(data)
		b.WriteByte('\n')
	}
	if err := os.WriteFile(path, []byte(b.String()), 0o600); err != nil {
		t.Fatal(err)
	}
	return path
}

func msg(id, parent, role, text string) map[string]any {
	return map[string]any{
		"type": "message", "id": id, "parentId": parent, "timestamp": "2026-01-01T00:00:00Z",
		"message": map[string]any{"role": role, "content": text, "timestamp": 1},
	}
}

func TestReadActiveBranch(t *testing.T) {
	cwd := t.TempDir()
	path := writeSession(t, t.TempDir(), "s.jsonl", []map[string]any{
		{"type": "session", "version": 3, "id": "sess-1", "timestamp": "2026-01-01T00:00:00Z", "cwd": cwd},
		msg("a", "", "user", "hello"),
		msg("b", "a", "assistant", "hi"),
		msg("c", "b", "user", "abandoned"),
		msg("d", "b", "user", "follow this"),
		{"type": "custom", "id": "e", "parentId": "d", "customType": "rpiv-todo-state", "data": map[string]any{"tasks": []any{}}},
		msg("f", "e", "assistant", "done"),
		{"type": "session_info", "id": "g", "parentId": "f", "name": "Named session"},
	}, cwd)
	tr, err := Read(path)
	if err != nil {
		t.Fatal(err)
	}
	if tr.ID != "sess-1" || tr.LeafID != "g" || tr.Name != "Named session" {
		t.Fatalf("bad header: %+v", tr)
	}
	var texts []string
	for _, e := range tr.Entries {
		if e.Role == "user" || e.Role == "assistant" {
			var m struct {
				Content string `json:"content"`
			}
			_ = json.Unmarshal(e.Message, &m)
			texts = append(texts, m.Content)
		}
	}
	want := []string{"hello", "hi", "follow this", "done"}
	if strings.Join(texts, "|") != strings.Join(want, "|") {
		t.Fatalf("entries = %v, want %v", texts, want)
	}
}

func TestCustomMessageKeepsMetadata(t *testing.T) {
	cwd := t.TempDir()
	path := writeSession(t, t.TempDir(), "s.jsonl", []map[string]any{
		{"type": "session", "version": 3, "id": "sess-1", "timestamp": "2026-01-01T00:00:00Z", "cwd": cwd},
		{
			"type": "custom_message", "id": "a", "parentId": "",
			"timestamp":  "2026-01-01T00:00:00Z",
			"customType": "background-task-notification",
			"content":    "<background-task-notification>failed</background-task-notification>",
			"display":    true,
			"details":    map[string]any{"name": "Build", "status": "failed"},
		},
	}, cwd)
	tr, err := Read(path)
	if err != nil {
		t.Fatal(err)
	}
	if len(tr.Entries) != 1 {
		t.Fatalf("entries = %d, want 1", len(tr.Entries))
	}
	entry := tr.Entries[0]
	if entry.CustomType != "background-task-notification" {
		t.Fatalf("customType = %q", entry.CustomType)
	}
	var details struct {
		Name   string `json:"name"`
		Status string `json:"status"`
	}
	if err := json.Unmarshal(entry.Data, &details); err != nil {
		t.Fatal(err)
	}
	if details.Name != "Build" || details.Status != "failed" {
		t.Fatalf("details = %+v", details)
	}
}

func TestContextBreakdownMergesSystemPrompt(t *testing.T) {
	cwd := t.TempDir()
	path := writeSession(t, t.TempDir(), "s.jsonl", []map[string]any{
		{"type": "session", "version": 3, "id": "sess-1", "timestamp": "2026-01-01T00:00:00Z", "cwd": cwd},
		{
			"type": "message", "id": "s1", "parentId": "", "timestamp": "2026-01-01T00:00:00Z",
			"message": map[string]any{
				"role":    "system",
				"content": "",
				"sections": map[string]any{
					"preamble":        "abcdefgh",
					"tools":           "12345678",
					"skills":          "1234",
					"project_context": "123456",
					"ponytail":        "12",
				},
			},
		},
		{
			"type": "message", "id": "s2", "parentId": "s1", "timestamp": "2026-01-01T00:00:01Z",
			"message": map[string]any{
				"role":    "system",
				"content": "",
				"sections": map[string]any{
					"preamble": "abcdefghijkl",
					"ponytail": nil,
				},
			},
		},
		{
			"type": "compaction", "id": "c1", "parentId": "s2", "timestamp": "2026-01-01T00:00:02Z",
			"summary": "older work", "tokensBefore": 100,
			"systemMessage": map[string]any{
				"role":    "system",
				"content": "",
				"sections": map[string]any{
					"skills": "12345678",
				},
			},
		},
	}, cwd)
	tr, err := Read(path)
	if err != nil {
		t.Fatal(err)
	}
	want := &ContextBreakdown{System: 3, Tools: 2, Skills: 2, Project: 2}
	if tr.Context == nil || *tr.Context != *want {
		t.Fatalf("context = %+v, want %+v", tr.Context, want)
	}
}

func TestListExcludesNestedSubagentRuns(t *testing.T) {
	base := t.TempDir()
	t.Setenv("PI_CODING_AGENT_SESSION_DIR", base)
	cwd := t.TempDir()
	dir := filepath.Join(base, EncodeWorkspace(cwd))
	writeSession(t, dir, "main.jsonl", []map[string]any{
		{"type": "session", "version": 3, "id": "main-1", "timestamp": "2026-01-01T00:00:00Z", "cwd": cwd},
		msg("a", "", "user", "main task"),
	}, cwd)
	nested := filepath.Join(dir, "main", "run-0")
	writeSession(t, nested, "session.jsonl", []map[string]any{
		{"type": "session", "version": 3, "id": "child-1", "timestamp": "2026-01-01T00:00:00Z", "cwd": cwd},
		msg("a", "", "user", "child task"),
	}, cwd)
	list, err := List(cwd, 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(list) != 1 || list[0].ID != "main-1" {
		t.Fatalf("unexpected list: %+v", list)
	}
	if list[0].Title != "main task" {
		t.Fatalf("title = %q", list[0].Title)
	}
}

func TestListRefreshesRewrittenSession(t *testing.T) {
	base := t.TempDir()
	t.Setenv("PI_CODING_AGENT_SESSION_DIR", base)
	cwd := t.TempDir()
	dir := filepath.Join(base, EncodeWorkspace(cwd))
	writeSession(t, dir, "main.jsonl", []map[string]any{
		{"type": "session", "version": 3, "id": "main-1", "timestamp": "2026-01-01T00:00:00Z", "cwd": cwd},
		msg("a", "", "user", "first title"),
		{"type": "session_info", "id": "b", "parentId": "a", "name": "first"},
	}, cwd)
	list, err := List(cwd, 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(list) != 1 || list[0].Title != "first" {
		t.Fatalf("list = %#v", list)
	}
	writeSession(t, dir, "main.jsonl", []map[string]any{
		{"type": "session", "version": 3, "id": "main-1", "timestamp": "2026-01-01T00:00:00Z", "cwd": cwd},
		msg("a", "", "user", "first title"),
		{"type": "session_info", "id": "b", "parentId": "a", "name": "renamed after the cache"},
	}, cwd)
	list, err = List(cwd, 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(list) != 1 || list[0].Title != "renamed after the cache" {
		t.Fatalf("cache returned a stale title: %#v", list)
	}
}

func TestSearchFindsActiveBranchText(t *testing.T) {
	base := t.TempDir()
	t.Setenv("PI_CODING_AGENT_SESSION_DIR", base)
	cwd := t.TempDir()
	dir := filepath.Join(base, EncodeWorkspace(cwd))
	writeSession(t, dir, "main.jsonl", []map[string]any{
		{"type": "session", "version": 3, "id": "main-1", "timestamp": "2026-01-01T00:00:00Z", "cwd": cwd},
		msg("a", "", "user", "please fix the cache invalidation bug"),
		msg("b", "a", "assistant", "I found the watcher rename branch."),
		msg("c", "b", "assistant", "abandoned branch mention"),
	}, cwd)

	hits, err := Search(cwd, "WATCHER", 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(hits) != 1 {
		t.Fatalf("hits = %d, want 1: %+v", len(hits), hits)
	}
	if hits[0].ID != "main-1" || hits[0].Role != "assistant" {
		t.Fatalf("unexpected hit: %+v", hits[0])
	}
	if !strings.Contains(hits[0].Snippet, "watcher rename") {
		t.Fatalf("snippet = %q", hits[0].Snippet)
	}
}
