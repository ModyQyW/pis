// Package sessions reads pi's session JSONL files for display. It never
// writes them. pi remains authoritative for model context; this package only
// provides a fast first paint and a session index.
package sessions

import (
	"bufio"
	"bytes"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"pi-mygo/internal/jsonx"
)

// maxIndexBytes bounds how much of a large session is scanned for its title.
const maxIndexBytes = 4 << 20

// maxTranscriptBytes bounds a single display read.
const maxTranscriptBytes = 128 << 20

// Summary is one row in the session list.
type Summary struct {
	Path         string    `json:"path"`
	ID           string    `json:"id"`
	Title        string    `json:"title"`
	Cwd          string    `json:"cwd"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
	MessageCount int       `json:"messageCount"`
}

// Entry is one displayable entry on the active branch.
type Entry struct {
	ID               string        `json:"id"`
	ParentID         string        `json:"parentId,omitempty"`
	Type             string        `json:"type"`
	Timestamp        string        `json:"timestamp,omitempty"`
	Role             string        `json:"role,omitempty"`
	Message          jsonx.RawJSON `json:"message,omitempty"`
	CustomType       string        `json:"customType,omitempty"`
	Data             jsonx.RawJSON `json:"data,omitempty"`
	Summary          string        `json:"summary,omitempty"`
	TokensBefore     int           `json:"tokensBefore,omitempty"`
	Usage            jsonx.RawJSON `json:"usage,omitempty"`
	FirstKeptEntryID string        `json:"firstKeptEntryId,omitempty"`
	FromID           string        `json:"fromId,omitempty"`
}

// Transcript is the active branch of a session, oldest first.
type Transcript struct {
	Path      string  `json:"path"`
	ID        string  `json:"id"`
	Cwd       string  `json:"cwd"`
	Name      string  `json:"name"`
	LeafID    string  `json:"leafId"`
	Entries   []Entry `json:"entries"`
	Truncated bool    `json:"truncated"`
}

type rawEntry struct {
	ID        string          `json:"id"`
	ParentID  string          `json:"parentId"`
	Type      string          `json:"type"`
	Timestamp string          `json:"timestamp"`
	Raw       json.RawMessage `json:"-"`
}

type sessionHeader struct {
	Type      string `json:"type"`
	Version   int    `json:"version"`
	ID        string `json:"id"`
	Timestamp string `json:"timestamp"`
	Cwd       string `json:"cwd"`
}

// AgentDir returns pi's agent data directory.
func AgentDir() string {
	if dir := os.Getenv("PI_CODING_AGENT_DIR"); dir != "" {
		return dir
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return ""
	}
	return filepath.Join(home, ".pi", "agent")
}

// SessionDirs returns the directories that can hold this workspace's main
// sessions. Nested subagent runs live below them and are intentionally not
// scanned.
func SessionDirs(cwd string) []string {
	agentDir := AgentDir()
	base := os.Getenv("PI_CODING_AGENT_SESSION_DIR")
	if base == "" {
		base = settingSessionDir(filepath.Join(cwd, ".pi", "settings.json"))
	}
	if base == "" && agentDir != "" {
		base = settingSessionDir(filepath.Join(agentDir, "settings.json"))
	}
	if base == "" {
		if agentDir == "" {
			return nil
		}
		base = filepath.Join(agentDir, "sessions")
	}
	if !filepath.IsAbs(base) {
		base = filepath.Join(cwd, base)
	}
	dirs := []string{filepath.Join(base, EncodeWorkspace(cwd)), base}
	seen := map[string]bool{}
	out := dirs[:0]
	for _, d := range dirs {
		d = filepath.Clean(d)
		if !seen[d] {
			seen[d] = true
			out = append(out, d)
		}
	}
	return out
}

func settingSessionDir(path string) string {
	data, err := os.ReadFile(path)
	if err != nil {
		return ""
	}
	var cfg struct {
		SessionDir string `json:"sessionDir"`
	}
	if json.Unmarshal(data, &cfg) != nil {
		return ""
	}
	return cfg.SessionDir
}

// EncodeWorkspace maps a path to pi's session directory name.
func EncodeWorkspace(cwd string) string {
	trimmed := strings.TrimLeft(cwd, `/\`)
	trimmed = strings.ReplaceAll(trimmed, `\`, "-")
	trimmed = strings.ReplaceAll(trimmed, "/", "-")
	trimmed = strings.ReplaceAll(trimmed, ":", "-")
	return "--" + trimmed + "--"
}

// List returns recent main sessions for cwd, newest first.
func List(cwd string, limit int) ([]Summary, error) {
	abs, err := filepath.Abs(cwd)
	if err != nil {
		return nil, err
	}
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	seen := map[string]bool{}
	var all []Summary
	for _, dir := range SessionDirs(abs) {
		entries, err := os.ReadDir(dir)
		if err != nil {
			continue
		}
		for _, ent := range entries {
			if ent.IsDir() || !strings.HasSuffix(ent.Name(), ".jsonl") {
				continue
			}
			path := filepath.Join(dir, ent.Name())
			if seen[path] {
				continue
			}
			seen[path] = true
			sum, err := scanFile(path, abs, ent)
			if err != nil || sum.ID == "" {
				continue
			}
			all = append(all, sum)
		}
	}
	sort.SliceStable(all, func(i, j int) bool { return all[i].UpdatedAt.After(all[j].UpdatedAt) })
	if len(all) > limit {
		all = all[:limit]
	}
	return all, nil
}

func scanFile(path, cwd string, ent os.DirEntry) (Summary, error) {
	f, err := os.Open(path)
	if err != nil {
		return Summary{}, err
	}
	defer f.Close()
	info, err := ent.Info()
	if err != nil {
		return Summary{}, err
	}
	sum := Summary{Path: path, UpdatedAt: info.ModTime()}
	reader := bufio.NewReaderSize(f, 64*1024)
	var read int64
	var header sessionHeader
	var firstUser string
	var latestName string
	for read < maxIndexBytes {
		line, err := reader.ReadBytes('\n')
		read += int64(len(line))
		if len(line) > 0 {
			trimmed := bytes.TrimSpace(line)
			if len(trimmed) > 0 {
				if header.Type == "" {
					if json.Unmarshal(trimmed, &header) == nil {
						if header.Type != "session" {
							return Summary{}, errors.New("not a session file")
						}
						if !samePath(header.Cwd, cwd) {
							return Summary{}, errors.New("different workspace")
						}
						sum.ID = header.ID
						sum.Cwd = header.Cwd
						if t, err := time.Parse(time.RFC3339, header.Timestamp); err == nil {
							sum.CreatedAt = t
						}
						continue
					}
				}
				if bytes.Contains(trimmed, []byte(`"session_info"`)) {
					var entry struct {
						Type string `json:"type"`
						Name string `json:"name"`
					}
					if json.Unmarshal(trimmed, &entry) == nil && entry.Type == "session_info" {
						latestName = strings.TrimSpace(entry.Name)
					}
				}
				if firstUser == "" && bytes.Contains(trimmed, []byte(`"role":"user"`)) {
					var entry struct {
						Type    string `json:"type"`
						Message struct {
							Role    string          `json:"role"`
							Content json.RawMessage `json:"content"`
						} `json:"message"`
					}
					if json.Unmarshal(trimmed, &entry) == nil && entry.Message.Role == "user" {
						firstUser = textFromContent(entry.Message.Content)
					}
				}
			}
		}
		if err != nil {
			break
		}
	}
	if sum.ID == "" {
		return Summary{}, errors.New("no session header")
	}
	sum.Title = latestName
	if sum.Title == "" {
		sum.Title = firstUser
	}
	if sum.Title == "" {
		sum.Title = "Untitled session"
	}
	sum.Title = oneLine(sum.Title, 90)
	return sum, nil
}

// SearchHit is one session whose active branch contains the query.
type SearchHit struct {
	Summary
	Snippet string `json:"snippet"`
	Role    string `json:"role,omitempty"`
}

// Search scans recent sessions in cwd for a case-insensitive query. It reads
// the active branch, so an abandoned fork does not produce a false hit.
func Search(cwd, query string, limit int) ([]SearchHit, error) {
	q := strings.TrimSpace(query)
	if len([]rune(q)) < 2 {
		return []SearchHit{}, nil
	}
	if limit <= 0 || limit > 50 {
		limit = 12
	}
	summaries, err := List(cwd, 150)
	if err != nil {
		return nil, err
	}
	hits := make([]SearchHit, 0, limit)
	for _, sum := range summaries {
		if snippet, ok := searchText(sum.Title, q); ok {
			hits = append(hits, SearchHit{Summary: sum, Snippet: snippet})
			if len(hits) >= limit {
				break
			}
			continue
		}
		tr, err := Read(sum.Path)
		if err != nil {
			continue
		}
		for _, entry := range tr.Entries {
			if entry.Role != "user" && entry.Role != "assistant" {
				continue
			}
			text := textFromMessage(entry.Message)
			snippet, ok := searchText(text, q)
			if !ok {
				continue
			}
			hits = append(hits, SearchHit{Summary: sum, Snippet: snippet, Role: entry.Role})
			break
		}
		if len(hits) >= limit {
			break
		}
	}
	return hits, nil
}

func searchText(text, query string) (string, bool) {
	if text == "" {
		return "", false
	}
	runes := []rune(text)
	lower := []rune(strings.ToLower(text))
	needle := []rune(strings.ToLower(query))
	start := indexRunes(lower, needle)
	if start < 0 {
		return "", false
	}
	from := start - 60
	if from < 0 {
		from = 0
	}
	to := start + len(needle) + 90
	if to > len(runes) {
		to = len(runes)
	}
	snippet := string(runes[from:to])
	if from > 0 {
		snippet = "…" + snippet
	}
	if to < len(runes) {
		snippet += "…"
	}
	return oneLine(snippet, 200), true
}

func indexRunes(haystack, needle []rune) int {
	if len(needle) == 0 || len(needle) > len(haystack) {
		return -1
	}
	for i := 0; i <= len(haystack)-len(needle); i++ {
		match := true
		for j := range needle {
			if haystack[i+j] != needle[j] {
				match = false
				break
			}
		}
		if match {
			return i
		}
	}
	return -1
}

// Read returns the active branch for display.
func Read(path string) (Transcript, error) {
	return ReadAt(path, "")
}

// ReadAt returns the active branch ending at leafID, or the file's last entry
// when leafID is empty. It is used after tree navigation, which changes the
// leaf without appending an entry.
func ReadAt(path, leafID string) (Transcript, error) {
	abs, err := filepath.Abs(path)
	if err != nil {
		return Transcript{}, err
	}
	f, err := os.Open(abs)
	if err != nil {
		return Transcript{}, err
	}
	defer f.Close()
	out := Transcript{Path: abs, Entries: []Entry{}}
	reader := bufio.NewReaderSize(f, 64*1024)
	var total int64
	byID := map[string]rawEntry{}
	var leaf string
	var name string
	for {
		line, err := reader.ReadBytes('\n')
		total += int64(len(line))
		if total > maxTranscriptBytes {
			out.Truncated = true
			break
		}
		trimmed := bytes.TrimSpace(line)
		if len(trimmed) > 0 {
			if out.ID == "" {
				var header sessionHeader
				if json.Unmarshal(trimmed, &header) == nil && header.Type == "session" {
					out.ID = header.ID
					out.Cwd = header.Cwd
					goto next
				}
			}
			var re rawEntry
			if json.Unmarshal(trimmed, &re) == nil && re.ID != "" {
				re.Raw = append(json.RawMessage(nil), trimmed...)
				byID[re.ID] = re
				leaf = re.ID
				if re.Type == "session_info" {
					var info struct {
						Name string `json:"name"`
					}
					if json.Unmarshal(trimmed, &info) == nil {
						name = info.Name
					}
				}
			}
		}
	next:
		if err != nil {
			break
		}
	}
	out.Name = name
	if leafID != "" {
		leaf = leafID
	}
	out.LeafID = leaf
	if leaf == "" {
		return out, nil
	}
	var chain []rawEntry
	seen := map[string]bool{}
	for id := leaf; id != "" && !seen[id]; {
		re, ok := byID[id]
		if !ok {
			break
		}
		seen[id] = true
		chain = append(chain, re)
		id = re.ParentID
	}
	for i := len(chain) - 1; i >= 0; i-- {
		entry, ok := displayEntry(chain[i])
		if ok {
			out.Entries = append(out.Entries, entry)
		}
	}
	if out.Name == "" {
		for _, entry := range out.Entries {
			if entry.Role == "user" {
				out.Name = oneLine(textFromMessage(entry.Message), 90)
				break
			}
		}
	}
	return out, nil
}

func displayEntry(re rawEntry) (Entry, bool) {
	e := Entry{ID: re.ID, ParentID: re.ParentID, Type: re.Type, Timestamp: re.Timestamp}
	switch re.Type {
	case "message":
		var wrapper struct {
			Message json.RawMessage `json:"message"`
		}
		if json.Unmarshal(re.Raw, &wrapper) != nil {
			return Entry{}, false
		}
		e.Message = jsonx.RawJSON(wrapper.Message)
		var msg struct {
			Role string `json:"role"`
		}
		if json.Unmarshal(wrapper.Message, &msg) == nil {
			e.Role = msg.Role
		}
		if e.Role == "system" {
			return Entry{}, false
		}
		return e, true
	case "custom_message":
		var wrapper struct {
			Message json.RawMessage `json:"message"`
			Content json.RawMessage `json:"content"`
			Display bool            `json:"display"`
		}
		_ = json.Unmarshal(re.Raw, &wrapper)
		if !wrapper.Display {
			return Entry{}, false
		}
		if len(wrapper.Message) > 0 {
			e.Message = jsonx.RawJSON(wrapper.Message)
		} else {
			e.Message = jsonx.RawJSON(wrapper.Content)
		}
		return e, true
	case "compaction":
		var c struct {
			Summary          string          `json:"summary"`
			TokensBefore     int             `json:"tokensBefore"`
			FirstKeptEntryID string          `json:"firstKeptEntryId"`
			Usage            json.RawMessage `json:"usage"`
		}
		_ = json.Unmarshal(re.Raw, &c)
		e.Summary = c.Summary
		e.TokensBefore = c.TokensBefore
		e.FirstKeptEntryID = c.FirstKeptEntryID
		e.Usage = jsonx.RawJSON(c.Usage)
		return e, true
	case "branch_summary":
		var c struct {
			Summary string `json:"summary"`
			FromID  string `json:"fromId"`
		}
		_ = json.Unmarshal(re.Raw, &c)
		e.Summary = c.Summary
		e.FromID = c.FromID
		return e, true
	case "custom":
		var c struct {
			CustomType string          `json:"customType"`
			Data       json.RawMessage `json:"data"`
		}
		_ = json.Unmarshal(re.Raw, &c)
		e.CustomType = c.CustomType
		e.Data = jsonx.RawJSON(c.Data)
		return e, true
	default:
		return Entry{}, false
	}
}

func textFromMessage(raw jsonx.RawJSON) string {
	if len(raw) == 0 {
		return ""
	}
	var msg struct {
		Content json.RawMessage `json:"content"`
	}
	if json.Unmarshal(raw, &msg) != nil {
		return ""
	}
	return textFromContent(msg.Content)
}

func textFromContent(raw json.RawMessage) string {
	if len(raw) == 0 {
		return ""
	}
	var s string
	if json.Unmarshal(raw, &s) == nil {
		return s
	}
	var blocks []struct {
		Type string `json:"type"`
		Text string `json:"text"`
	}
	if json.Unmarshal(raw, &blocks) == nil {
		var parts []string
		for _, b := range blocks {
			if b.Type == "text" && b.Text != "" {
				parts = append(parts, b.Text)
			}
		}
		return strings.Join(parts, "\n")
	}
	return ""
}

func oneLine(s string, max int) string {
	s = strings.Join(strings.Fields(s), " ")
	if s == "" {
		return ""
	}
	runes := []rune(s)
	if len(runes) > max {
		return string(runes[:max-1]) + "…"
	}
	return s
}

func samePath(a, b string) bool {
	if a == "" || b == "" {
		return false
	}
	ca, err1 := filepath.Abs(a)
	cb, err2 := filepath.Abs(b)
	if err1 != nil || err2 != nil {
		return false
	}
	return filepath.Clean(ca) == filepath.Clean(cb)
}

// ReadSummary returns a single file's summary without a workspace filter.
func ReadSummary(path string) (Summary, error) {
	info, err := os.Stat(path)
	if err != nil {
		return Summary{}, err
	}
	ent := fileInfoDirEntry{info}
	return scanFile(path, readCwd(path), ent)
}

type fileInfoDirEntry struct{ os.FileInfo }

func (f fileInfoDirEntry) Type() os.FileMode          { return f.FileInfo.Mode().Type() }
func (f fileInfoDirEntry) Info() (os.FileInfo, error) { return f.FileInfo, nil }

func readCwd(path string) string {
	f, err := os.Open(path)
	if err != nil {
		return ""
	}
	defer f.Close()
	buf := make([]byte, 64*1024)
	n, _ := f.Read(buf)
	var header sessionHeader
	line := bytes.SplitN(buf[:n], []byte("\n"), 2)[0]
	_ = json.Unmarshal(line, &header)
	return header.Cwd
}

// ErrNotFound is returned when a session file cannot be read.
var ErrNotFound = errors.New("session not found")

// AllowedPath reports whether path is a JSONL file under a pi session
// directory. It is a defense-in-depth check for UI requests, not a sandbox.
func AllowedPath(path string) bool {
	if !strings.HasSuffix(strings.ToLower(path), ".jsonl") {
		return false
	}
	abs, err := filepath.Abs(path)
	if err != nil {
		return false
	}
	info, err := os.Stat(abs)
	if err != nil || info.IsDir() {
		return false
	}
	roots := []string{}
	if base := os.Getenv("PI_CODING_AGENT_SESSION_DIR"); base != "" {
		roots = append(roots, base)
	}
	if agent := AgentDir(); agent != "" {
		roots = append(roots, filepath.Join(agent, "sessions"))
	}
	if cwd := readCwd(abs); cwd != "" {
		roots = append(roots, SessionDirs(cwd)...)
	}
	for _, root := range roots {
		rootAbs, err := filepath.Abs(root)
		if err != nil {
			continue
		}
		rel, err := filepath.Rel(rootAbs, abs)
		if err == nil && rel != ".." && !strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
			return true
		}
	}
	return false
}
