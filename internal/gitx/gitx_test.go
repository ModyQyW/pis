package gitx

import "testing"

func TestParseStatus(t *testing.T) {
	out := "M  src/a.ts\x00" +
		" M src/b.ts\x00" +
		"?? src/new.ts\x00" +
		"R  src/new-name.ts\x00src/old-name.ts\x00"
	files := parseStatus(out)
	if len(files) != 4 {
		t.Fatalf("got %d files: %+v", len(files), files)
	}
	if files[0].Path != "src/a.ts" || !files[0].Staged || files[0].Status != "M" {
		t.Fatalf("bad first: %+v", files[0])
	}
	if files[1].Staged || files[1].Status != "M" {
		t.Fatalf("bad second: %+v", files[1])
	}
	if files[2].Status != "??" {
		t.Fatalf("bad untracked: %+v", files[2])
	}
	if files[3].Status != "R" || files[3].OldPath != "src/old-name.ts" {
		t.Fatalf("bad rename: %+v", files[3])
	}
}
