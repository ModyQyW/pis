package app

import (
	"testing"

	"pi-mygo/internal/settings"
)

func TestEffectiveGuardPolicy(t *testing.T) {
	base := settings.Defaults()
	if got := EffectiveGuardPolicy(base, nil); got != "smart" {
		t.Fatalf("smart default: %q", got)
	}
	disabled := base
	disabled.Permissions.Disabled = true
	if got := EffectiveGuardPolicy(disabled, nil); got != "off" {
		t.Fatalf("disabled: %q", got)
	}
	allow := base
	allow.Permissions.Policy = settings.PolicyAllow
	if got := EffectiveGuardPolicy(allow, nil); got != "off" {
		t.Fatalf("allow: %q", got)
	}
	if got := EffectiveGuardPolicy(base, []string{"npm:cc-safety-net"}); got != "off" {
		t.Fatalf("detected guard should disable ours: %q", got)
	}
	forced := base
	forced.Permissions.Force = true
	if got := EffectiveGuardPolicy(forced, []string{"npm:cc-safety-net"}); got != "smart" {
		t.Fatalf("forced: %q", got)
	}
}
