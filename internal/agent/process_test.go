package agent

import (
	"strings"
	"testing"
)

func TestReadRecordsSkipsOversizedLine(t *testing.T) {
	var lines []string
	var long int
	readRecords(strings.NewReader("ok\n123456789\nafter\n"), 8,
		func(line []byte) { lines = append(lines, string(line)) },
		func() { long++ },
	)
	if strings.Join(lines, "|") != "ok|after" {
		t.Fatalf("lines = %v", lines)
	}
	if long != 1 {
		t.Fatalf("tooLong = %d, want 1", long)
	}
}

func TestReadRecordsKeepsFinalLineWithoutNewline(t *testing.T) {
	var lines []string
	readRecords(strings.NewReader("one\ntail"), 16,
		func(line []byte) { lines = append(lines, string(line)) },
		nil,
	)
	if strings.Join(lines, "|") != "one|tail" {
		t.Fatalf("lines = %v", lines)
	}
}
