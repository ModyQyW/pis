package agent

import (
	"encoding/json"
	"sort"
	"strconv"
	"sync"
	"time"
)

const coalesceInterval = 16 * time.Millisecond

type coalesceInput struct {
	sessionID string
	raw       []byte
}

type pendingDelta struct {
	sessionID string
	kind      string
	index     int
	text      string
	order     uint64
}

// coalescer turns pi's token-level message updates into at most one text and
// one thinking event per 16 ms window. Everything else passes through in
// order, with pending text flushed before a boundary.
type coalescer struct {
	emit func(Event)
	in   chan coalesceInput
	stop chan struct{}
	done chan struct{}
	once sync.Once
}

func newCoalescer(emit func(Event)) *coalescer {
	c := &coalescer{
		emit: emit,
		in:   make(chan coalesceInput, 2048),
		stop: make(chan struct{}),
		done: make(chan struct{}),
	}
	go c.run()
	return c
}

func (c *coalescer) Push(sessionID string, raw []byte) {
	select {
	case c.in <- coalesceInput{sessionID: sessionID, raw: raw}:
	case <-c.stop:
	}
}

func (c *coalescer) Close() {
	c.once.Do(func() {
		close(c.stop)
		<-c.done
	})
}

func (c *coalescer) run() {
	defer close(c.done)
	ticker := time.NewTicker(coalesceInterval)
	defer ticker.Stop()

	pending := map[string]*pendingDelta{}
	var order uint64
	flushAll := func() {
		if len(pending) == 0 {
			return
		}
		items := make([]*pendingDelta, 0, len(pending))
		for _, item := range pending {
			items = append(items, item)
		}
		sort.Slice(items, func(i, j int) bool { return items[i].order < items[j].order })
		for _, item := range items {
			c.emit(Event{
				SessionID: item.sessionID,
				Kind:      item.kind,
				Index:     item.index,
				Delta:     item.text,
			})
		}
		clear(pending)
	}
	rawEvent := func(sessionID string, raw []byte) {
		c.emit(Event{SessionID: sessionID, Kind: "event", Raw: RawJSON(raw)})
	}

	for {
		select {
		case in := <-c.in:
			var env struct {
				Type                  string `json:"type"`
				AssistantMessageEvent struct {
					Type         string `json:"type"`
					ContentIndex int    `json:"contentIndex"`
					Delta        string `json:"delta"`
				} `json:"assistantMessageEvent"`
			}
			if err := json.Unmarshal(in.raw, &env); err != nil {
				rawEvent(in.sessionID, in.raw)
				continue
			}
			if env.Type != "message_update" {
				flushAll()
				rawEvent(in.sessionID, in.raw)
				continue
			}
			ev := env.AssistantMessageEvent
			switch ev.Type {
			case "text_delta", "thinking_delta":
				kind := "text"
				if ev.Type == "thinking_delta" {
					kind = "thinking"
				}
				key := in.sessionID + "\x00" + kind + "\x00" + strconv.Itoa(ev.ContentIndex)
				item, ok := pending[key]
				if !ok {
					order++
					item = &pendingDelta{sessionID: in.sessionID, kind: kind, index: ev.ContentIndex, order: order}
					pending[key] = item
				}
				item.text += ev.Delta
			case "text_end", "thinking_end":
				flushAll()
				rawEvent(in.sessionID, in.raw)
			case "toolcall_start", "toolcall_end":
				flushAll()
				rawEvent(in.sessionID, in.raw)
			default:
				flushAll()
				rawEvent(in.sessionID, in.raw)
			}
		case <-ticker.C:
			flushAll()
		case <-c.stop:
			flushAll()
			return
		}
	}
}
