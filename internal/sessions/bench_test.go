package sessions

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"testing"
)

func BenchmarkRead1000Messages(b *testing.B) {
	dir := b.TempDir()
	path := filepath.Join(dir, "big.jsonl")
	f, err := os.Create(path)
	if err != nil {
		b.Fatal(err)
	}
	enc := json.NewEncoder(f)
	_ = enc.Encode(map[string]any{"type": "session", "version": 3, "id": "big", "timestamp": "2026-01-01T00:00:00Z", "cwd": dir})
	parent := ""
	for i := 0; i < 1000; i++ {
		role := "user"
		if i%2 == 1 {
			role = "assistant"
		}
		id := fmt.Sprintf("e%d", i)
		content := "message " + string(rune('a'+i%26))
		msg := map[string]any{"role": role, "content": content, "timestamp": i}
		if role == "assistant" {
			msg["content"] = []any{map[string]any{"type": "text", "text": content}}
			msg["usage"] = map[string]any{"input": 10, "output": 2, "cacheRead": 0, "cacheWrite": 0, "totalTokens": 12, "cost": map[string]any{"input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0, "total": 0}}
		}
		_ = enc.Encode(map[string]any{"type": "message", "id": id, "parentId": parent, "timestamp": "2026-01-01T00:00:00Z", "message": msg})
		parent = id
	}
	_ = f.Close()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		tr, err := Read(path)
		if err != nil {
			b.Fatal(err)
		}
		if len(tr.Entries) != 1000 {
			b.Fatalf("got %d entries", len(tr.Entries))
		}
	}
}
