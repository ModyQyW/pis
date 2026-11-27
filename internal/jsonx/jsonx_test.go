package jsonx

import (
	"os"
	"testing"
)

func TestStripJSONCRemovesCommentsAndTrailingCommas(t *testing.T) {
	input := `{
  // endpoint
  "url": "https://example.com/a//b",
  "text": "a, }",
  "list": [1, 2,],
}`
	out, changed := StripJSONC([]byte(input))
	if !changed {
		t.Fatal("changed must be true")
	}
	want := `{
  
  "url": "https://example.com/a//b",
  "text": "a, }",
  "list": [1, 2]
}`
	if string(out) != want {
		t.Fatalf("out:\n%s\nwant:\n%s", out, want)
	}
	if _, again := StripJSONC(out); again {
		t.Fatal("clean JSON must not change")
	}
}

func TestReadFileTrimsBOM(t *testing.T) {
	path := t.TempDir() + "/settings.json"
	data := append([]byte{0xef, 0xbb, 0xbf}, []byte(`{"a":1}`)...)
	if err := os.WriteFile(path, data, 0o600); err != nil {
		t.Fatal(err)
	}
	out, exists, err := ReadFile(path, 1024)
	if err != nil || !exists || string(out) != `{"a":1}` {
		t.Fatalf("out=%q exists=%v err=%v", out, exists, err)
	}
}
