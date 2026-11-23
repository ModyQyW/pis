package agent

import (
	"encoding/json"
	"testing"
	"time"
)

func updateEvent(t *testing.T, typ string, index int, delta string) []byte {
	t.Helper()
	raw, err := json.Marshal(map[string]any{
		"type": "message_update",
		"assistantMessageEvent": map[string]any{
			"type":         typ,
			"contentIndex": index,
			"delta":        delta,
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	return raw
}

func collect(t *testing.T, ch <-chan Event, want int, timeout time.Duration) []Event {
	t.Helper()
	var out []Event
	deadline := time.After(timeout)
	for len(out) < want {
		select {
		case ev := <-ch:
			out = append(out, ev)
		case <-deadline:
			t.Fatalf("got %d events, want %d: %+v", len(out), want, out)
		}
	}
	return out
}

func TestCoalescerMergesTextDeltas(t *testing.T) {
	ch := make(chan Event, 16)
	c := newCoalescer(func(ev Event) { ch <- ev })
	defer c.Close()
	c.Push("s1", updateEvent(t, "text_delta", 0, "hel"))
	c.Push("s1", updateEvent(t, "text_delta", 0, "lo"))
	evs := collect(t, ch, 1, 200*time.Millisecond)
	if evs[0].Kind != "text" || evs[0].Delta != "hello" || evs[0].SessionID != "s1" {
		t.Fatalf("unexpected: %+v", evs[0])
	}
}

func TestCoalescerFlushesBeforeMessageEnd(t *testing.T) {
	ch := make(chan Event, 16)
	c := newCoalescer(func(ev Event) { ch <- ev })
	defer c.Close()
	c.Push("s1", updateEvent(t, "text_delta", 0, "a"))
	c.Push("s1", []byte(`{"type":"message_end","message":{"role":"assistant"}}`))
	evs := collect(t, ch, 2, 200*time.Millisecond)
	if evs[0].Kind != "text" || evs[0].Delta != "a" {
		t.Fatalf("delta not first: %+v", evs)
	}
	if evs[1].Kind != "event" || evs[1].Raw == nil {
		t.Fatalf("raw event missing: %+v", evs[1])
	}
}

func TestCoalescerSeparatesThinkingAndIndices(t *testing.T) {
	ch := make(chan Event, 16)
	c := newCoalescer(func(ev Event) { ch <- ev })
	defer c.Close()
	c.Push("s1", updateEvent(t, "thinking_delta", 0, "think"))
	c.Push("s1", updateEvent(t, "text_delta", 1, "answer"))
	evs := collect(t, ch, 2, 200*time.Millisecond)
	seen := map[string]string{}
	for _, ev := range evs {
		seen[ev.Kind] = ev.Delta
	}
	if seen["thinking"] != "think" || seen["text"] != "answer" {
		t.Fatalf("unexpected: %+v", evs)
	}
}
