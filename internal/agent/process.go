package agent

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os/exec"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

const (
	commandTimeout = 15 * time.Second
	closeGrace     = 3 * time.Second
	stderrLines    = 200
)

type processOptions struct {
	executable string
	cwd        string
	args       []string
	env        []string
	onRecord   func(raw []byte)
	onUI       func(raw []byte)
	onExit     func(error, string)
}

type process struct {
	cmd     *exec.Cmd
	stdin   io.WriteCloser
	writeMu sync.Mutex

	pendingMu sync.Mutex
	pending   map[string]chan Response
	nextID    atomic.Uint64

	done    chan struct{}
	waitErr error
	once    sync.Once

	stderrMu   sync.Mutex
	stderrTail []string

	opts processOptions
}

func startProcess(opts processOptions) (*process, error) {
	if opts.executable == "" {
		return nil, errors.New("empty pi executable")
	}
	cmd := exec.Command(opts.executable, opts.args...)
	cmd.Dir = opts.cwd
	cmd.Env = append([]string{}, opts.env...)
	stdin, err := cmd.StdinPipe()
	if err != nil {
		return nil, err
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, err
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		return nil, err
	}
	p := &process{
		cmd:     cmd,
		stdin:   stdin,
		pending: map[string]chan Response{},
		done:    make(chan struct{}),
		opts:    opts,
	}
	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("start pi: %w", err)
	}
	go p.readStdout(stdout)
	go p.readStderr(stderr)
	go p.wait()
	return p, nil
}

func (p *process) readStdout(r io.Reader) {
	readRecords(r, maxRecordBytes, func(line []byte) {
		p.dispatch(line)
	}, func() {
		if p.opts.onRecord != nil {
			p.opts.onRecord([]byte(`{"type":"error","error":"pi record exceeded limit"}`))
		}
	})
}

// readRecords emits newline-terminated lines up to max payload bytes. A line
// over the limit is skipped without being buffered in full, so a huge record
// cannot grow memory before it is rejected. A final line without a newline is
// emitted at EOF.
func readRecords(r io.Reader, max int, emit func([]byte), tooLong func()) {
	reader := bufio.NewReaderSize(r, 64*1024)
	var line []byte
	skip := false
	flush := func() {
		if skip {
			if tooLong != nil {
				tooLong()
			}
		} else if trimmed := trimLine(line); len(trimmed) > 0 && emit != nil {
			emit(trimmed)
		}
		line = nil
		skip = false
	}
	for {
		chunk, err := reader.ReadSlice('\n')
		if len(chunk) > 0 {
			ends := chunk[len(chunk)-1] == '\n'
			payload := len(chunk)
			if ends {
				payload--
			}
			if !skip {
				if len(line)+payload > max {
					skip = true
					line = nil
				} else {
					line = append(line, chunk...)
				}
			}
			if ends {
				flush()
			}
		}
		if err == bufio.ErrBufferFull {
			continue
		}
		if err != nil {
			if len(line) > 0 || skip {
				flush()
			}
			return
		}
	}
}

func trimLine(b []byte) []byte {
	for len(b) > 0 && (b[len(b)-1] == '\n' || b[len(b)-1] == '\r') {
		b = b[:len(b)-1]
	}
	return b
}

func (p *process) dispatch(raw []byte) {
	var head struct {
		Type string `json:"type"`
		ID   string `json:"id"`
	}
	if err := json.Unmarshal(raw, &head); err != nil {
		p.opts.onRecord([]byte(`{"type":"error","error":"malformed pi record"}`))
		return
	}
	switch head.Type {
	case "response":
		var resp Response
		if err := json.Unmarshal(raw, &resp); err != nil {
			p.opts.onRecord([]byte(`{"type":"error","error":"malformed pi response"}`))
			return
		}
		p.pendingMu.Lock()
		ch := p.pending[resp.ID]
		if ch != nil {
			delete(p.pending, resp.ID)
		}
		p.pendingMu.Unlock()
		if ch != nil {
			ch <- resp
		}
		return
	case "extension_ui_request":
		if p.opts.onUI != nil {
			p.opts.onUI(raw)
			return
		}
	}
	if p.opts.onRecord != nil {
		p.opts.onRecord(raw)
	}
}

func (p *process) readStderr(r io.Reader) {
	scanner := bufio.NewScanner(r)
	scanner.Buffer(make([]byte, 0, 64*1024), 1<<20)
	for scanner.Scan() {
		line := scanner.Text()
		p.stderrMu.Lock()
		if len(p.stderrTail) == stderrLines {
			p.stderrTail = p.stderrTail[1:]
		}
		p.stderrTail = append(p.stderrTail, line)
		p.stderrMu.Unlock()
	}
}

func (p *process) wait() {
	err := p.cmd.Wait()
	p.once.Do(func() {
		p.waitErr = err
		close(p.done)
		p.pendingMu.Lock()
		for id, ch := range p.pending {
			ch <- Response{Type: "response", ID: id, Command: "", Success: false, Error: "pi exited"}
			delete(p.pending, id)
		}
		p.pendingMu.Unlock()
		if p.opts.onExit != nil {
			p.opts.onExit(err, p.StderrTail())
		}
	})
}

// call sends one command and waits for its matching response.
func (p *process) call(ctx context.Context, command map[string]any) (Response, error) {
	if _, ok := command["type"]; !ok {
		return Response{}, errors.New("command has no type")
	}
	timeout := commandTimeout
	if v, ok := command["_timeout"].(time.Duration); ok {
		timeout = v
	}
	delete(command, "_timeout")
	id := fmt.Sprintf("pis-%d", p.nextID.Add(1))
	command["id"] = id
	ch := make(chan Response, 1)
	p.pendingMu.Lock()
	p.pending[id] = ch
	p.pendingMu.Unlock()
	cleanup := func() {
		p.pendingMu.Lock()
		delete(p.pending, id)
		p.pendingMu.Unlock()
	}
	if err := p.write(command); err != nil {
		cleanup()
		return Response{}, err
	}
	timer := time.NewTimer(timeout)
	defer timer.Stop()
	select {
	case resp := <-ch:
		if !resp.Success {
			return resp, &ErrCommand{Command: resp.Command, Message: resp.Error}
		}
		return resp, nil
	case <-ctx.Done():
		cleanup()
		return Response{}, ctx.Err()
	case <-timer.C:
		cleanup()
		return Response{}, fmt.Errorf("pi %v timed out after %s", command["type"], timeout)
	case <-p.done:
		cleanup()
		return Response{}, p.exitError()
	}
}

func (p *process) write(command map[string]any) error {
	data, err := json.Marshal(command)
	if err != nil {
		return err
	}
	data = append(data, '\n')
	p.writeMu.Lock()
	defer p.writeMu.Unlock()
	if _, err := p.stdin.Write(data); err != nil {
		return fmt.Errorf("write pi command: %w", err)
	}
	return nil
}

func (p *process) exitError() error {
	if p.waitErr == nil {
		if tail := p.StderrTail(); tail != "" {
			return fmt.Errorf("pi exited: %s", tail)
		}
		return errors.New("pi exited")
	}
	msg := fmt.Sprintf("pi exited: %v", p.waitErr)
	if tail := p.StderrTail(); tail != "" {
		msg += "\n" + tail
	}
	return errors.New(msg)
}

// StderrTail returns the last diagnostics, for crash reports. It is not a log.
func (p *process) StderrTail() string {
	p.stderrMu.Lock()
	defer p.stderrMu.Unlock()
	return strings.Join(p.stderrTail, "\n")
}

// close asks pi to shut down through stdin EOF, then kills it after a grace
// period. Closing stdin is pi's orderly shutdown signal.
func (p *process) close() {
	_ = p.stdin.Close()
	select {
	case <-p.done:
		return
	case <-time.After(closeGrace):
	}
	if p.cmd.Process != nil {
		_ = p.cmd.Process.Kill()
	}
	select {
	case <-p.done:
	case <-time.After(2 * time.Second):
	}
}
