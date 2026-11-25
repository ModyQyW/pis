// Package jsonx holds JSON helpers shared by the app's packages.
package jsonx

import "encoding/json"

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
