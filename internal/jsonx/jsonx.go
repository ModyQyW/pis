// Package jsonx holds JSON helpers shared by the app's packages.
package jsonx

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
)

// RawJSON is a JSON value passed through without decoding. It marshals as the
// original bytes and is exposed to TypeScript as `unknown`.
type RawJSON json.RawMessage

// MarshalJSON implements json.Marshaler.
func (r RawJSON) MarshalJSON() ([]byte, error) {
	if len(r) == 0 {
		return []byte("null"), nil
	}
	return r, nil
}

// UnmarshalJSON implements json.Unmarshaler.
func (r *RawJSON) UnmarshalJSON(b []byte) error {
	*r = append((*r)[:0], b...)
	return nil
}

// ReadFile reads a file with a size limit. A missing file reports exists as
// false and no error. The limit bounds project-controlled files before JSON
// decoding, so a symlink to a huge file cannot exhaust memory.
func ReadFile(path string, limit int64) (data []byte, exists bool, err error) {
	file, err := os.Open(path)
	if errors.Is(err, os.ErrNotExist) {
		return nil, false, nil
	}
	if err != nil {
		return nil, true, err
	}
	defer file.Close()
	data, err = io.ReadAll(io.LimitReader(file, limit+1))
	if err != nil {
		return nil, true, err
	}
	if int64(len(data)) > limit {
		return nil, true, fmt.Errorf("%s is larger than %d bytes", path, limit)
	}
	data = bytes.TrimPrefix(data, []byte{0xef, 0xbb, 0xbf})
	return data, true, nil
}

// StripJSONC removes // line comments and trailing commas outside strings,
// matching the model configuration reader in pi. It reports whether the input
// changed. Block comments are not stripped; pi does not accept them either.
func StripJSONC(data []byte) ([]byte, bool) {
	out := make([]byte, 0, len(data))
	inString := false
	escaped := false
	for i := 0; i < len(data); i++ {
		c := data[i]
		if inString {
			out = append(out, c)
			if escaped {
				escaped = false
			} else if c == '\\' {
				escaped = true
			} else if c == '"' {
				inString = false
			}
			continue
		}
		if c == '"' {
			inString = true
			out = append(out, c)
			continue
		}
		if c == '/' && i+1 < len(data) && data[i+1] == '/' {
			for i < len(data) && data[i] != '\n' {
				i++
			}
			if i < len(data) {
				out = append(out, '\n')
			}
			continue
		}
		out = append(out, c)
	}
	// Remove a comma that is followed only by whitespace before } or ].
	clean := make([]byte, 0, len(out))
	inString = false
	escaped = false
	for i := 0; i < len(out); i++ {
		c := out[i]
		if inString {
			clean = append(clean, c)
			if escaped {
				escaped = false
			} else if c == '\\' {
				escaped = true
			} else if c == '"' {
				inString = false
			}
			continue
		}
		if c == '"' {
			inString = true
			clean = append(clean, c)
			continue
		}
		if c == ',' {
			j := i + 1
			for j < len(out) && (out[j] == ' ' || out[j] == '\t' || out[j] == '\n' || out[j] == '\r') {
				j++
			}
			if j < len(out) && (out[j] == '}' || out[j] == ']') {
				continue
			}
		}
		clean = append(clean, c)
	}
	return clean, string(clean) != string(data)
}
