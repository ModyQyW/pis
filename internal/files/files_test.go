package files

import "testing"

func TestRankPrefersBasenamePrefix(t *testing.T) {
	base := "src/cache/watch.ts"
	other := "docs/rewatch-guide.md"
	if rank(base, "watch") <= rank(other, "watch") {
		t.Fatalf("expected basename watch match to rank higher: %d vs %d", rank(base, "watch"), rank(other, "watch"))
	}
	if rank("src/cache/watcher.ts", "watch") <= 0 {
		t.Fatal("want a match")
	}
	if rank("src/cache/watch.ts", "zzz") != 0 {
		t.Fatal("unexpected match")
	}
}
