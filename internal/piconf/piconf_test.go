package piconf

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"pis/internal/settings"
)

func setupAgent(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	t.Setenv("PI_CODING_AGENT_DIR", dir)
	t.Setenv("HOME", t.TempDir())
	return dir
}

func writeFile(t *testing.T, path, text string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(text), 0o644); err != nil {
		t.Fatal(err)
	}
}

func TestInspectReadsDefaultsSkillsAndRedactsKeys(t *testing.T) {
	agent := setupAgent(t)
	writeFile(t, filepath.Join(agent, "settings.json"), `{
  "defaultProvider": "magpie",
  "defaultModel": "group/deepseek-flash",
  "defaultThinkingLevel": "max",
  "skills": ["./extra-skills"],
  "packages": ["npm:pi-web-access", {"source": "npm:pi-lens", "skills": []}]
}`)
	writeFile(t, filepath.Join(agent, "models.json"), `{
  "$schema": "https://pi.dev/schemas/models.schema.json",
  "providers": {
    "magpie": {
      "api": "openai-completions",
      "baseUrl": "http://127.0.0.1:3425/v1",
      "apiKey": "$MAGPIE_KEY",
      "models": [{"id": "group/deepseek-flash", "contextWindow": 1000000}]
    }
  }
}`)
	writeFile(t, filepath.Join(agent, "skills", "review", "SKILL.md"), `---
name: review-code
description: Review changes for bugs.
---

# Review
`)
	writeFile(t, filepath.Join(agent, "extra-skills", "docs", "SKILL.md"), `---
name: docs
description: >
  Write user documentation
  in plain language.
---
`)
	writeFile(t, filepath.Join(agent, "extensions", "local.ts"), "export default function () {}\n")

	snap, err := New(nil).Inspect("")
	if err != nil {
		t.Fatal(err)
	}
	if snap.Defaults.Provider != "magpie" || snap.Defaults.Model != "group/deepseek-flash" {
		t.Fatalf("defaults: %+v", snap.Defaults)
	}
	if len(snap.Providers) != 1 || !snap.Providers[0].APIKeySet || !snap.Providers[0].APIKeyEnv {
		t.Fatalf("provider: %+v", snap.Providers)
	}
	if snap.Providers[0].APIKeySet != true {
		t.Fatal("stored key must be reported by presence only")
	}
	var names []string
	for _, skill := range snap.Skills {
		names = append(names, skill.Name)
		if skill.Name == "docs" && skill.Description != "Write user documentation in plain language." {
			t.Fatalf("folded description: %q", skill.Description)
		}
	}
	if strings.Join(names, ",") != "docs,review-code" {
		t.Fatalf("skills: %v", names)
	}
	if len(snap.Extensions) != 1 || snap.Extensions[0].Name != "local" {
		t.Fatalf("extensions: %+v", snap.Extensions)
	}
	if len(snap.Packages) != 2 || snap.Packages[0].Source != "npm:pi-web-access" {
		t.Fatalf("packages: %+v", snap.Packages)
	}
	if snap.Fingerprint == "" {
		t.Fatal("fingerprint must be set")
	}
	if strings.Contains(snap.Fingerprint, "MAGPIE_KEY") {
		t.Fatal("fingerprint must not contain a key")
	}
}

func TestSaveProviderPreservesUnknownFieldsAndKeys(t *testing.T) {
	agent := setupAgent(t)
	path := filepath.Join(agent, "models.json")
	writeFile(t, path, `{
  "providers": {
    "lab": {
      "api": "openai-completions",
      "baseUrl": "https://lab.example/v1",
      "apiKey": "secret-value",
      "compat": {"supportsStore": false},
      "models": [{
        "id": "fast",
        "name": "Fast",
        "compat": {"supportsReasoningEffort": false},
        "cost": {"input": 1, "output": 2, "cacheRead": 0, "cacheWrite": 0}
      }]
    }
  }
}`)
	svc := New(nil)
	if err := svc.SaveProvider(ProviderInput{
		ID:      "lab",
		Name:    "Lab",
		API:     "openai-completions",
		BaseURL: "https://lab.example/v1",
		Models: []ProviderModel{
			{ID: "fast", Name: "Fast Ed", ContextWindow: 64000},
			{ID: "slow", Name: "Slow"},
		},
	}); err != nil {
		t.Fatal(err)
	}
	root, _, err := readObjectStrict(path)
	if err != nil {
		t.Fatal(err)
	}
	provider := root["providers"].(map[string]any)["lab"].(map[string]any)
	if provider["apiKey"] != "secret-value" {
		t.Fatal("an empty API key must keep the stored key")
	}
	if provider["compat"] == nil {
		t.Fatal("provider compat must be kept")
	}
	models := provider["models"].([]any)
	if len(models) != 2 {
		t.Fatalf("models: %v", models)
	}
	fast := models[0].(map[string]any)
	if fast["name"] != "Fast Ed" || fast["compat"] == nil || fast["cost"] == nil {
		t.Fatalf("existing model fields must be kept: %v", fast)
	}
	slow := models[1].(map[string]any)
	if slow["id"] != "slow" {
		t.Fatalf("new model: %v", slow)
	}

	if err := svc.SaveProvider(ProviderInput{ID: "lab", ClearKey: true}); err != nil {
		t.Fatal(err)
	}
	root, _, _ = readObjectStrict(path)
	provider = root["providers"].(map[string]any)["lab"].(map[string]any)
	if _, ok := provider["apiKey"]; ok {
		t.Fatal("ClearKey must remove the stored key")
	}
}

func TestDefaultsAndResourcesRoundTrip(t *testing.T) {
	agent := setupAgent(t)
	svc := New(nil)
	if err := svc.SetDefaults("lab", "fast", "high"); err != nil {
		t.Fatal(err)
	}
	if err := svc.AddPath("skills", "./team-skills"); err != nil {
		t.Fatal(err)
	}
	if err := svc.AddPath("skills", "./team-skills"); err != nil {
		t.Fatal(err)
	}
	if err := svc.AddPath("extensions", "/tmp/tools.ts"); err != nil {
		t.Fatal(err)
	}
	if err := svc.AddPackage("npm:pi-lens"); err != nil {
		t.Fatal(err)
	}
	root, _, _ := readObjectStrict(filepath.Join(agent, "settings.json"))
	if root["defaultProvider"] != "lab" || root["defaultModel"] != "fast" || root["defaultThinkingLevel"] != "high" {
		t.Fatalf("defaults: %v", root)
	}
	if got := stringList(root["skills"]); len(got) != 1 || got[0] != "./team-skills" {
		t.Fatalf("skills: %v", got)
	}
	if got := stringList(root["packages"]); len(got) != 1 || got[0] != "npm:pi-lens" {
		t.Fatalf("packages: %v", got)
	}
	if err := svc.RemovePath("skills", "./team-skills"); err != nil {
		t.Fatal(err)
	}
	if err := svc.RemovePackage("npm:pi-lens"); err != nil {
		t.Fatal(err)
	}
	root, _, _ = readObjectStrict(filepath.Join(agent, "settings.json"))
	if _, ok := root["skills"]; ok {
		t.Fatalf("empty list must be removed: %v", root)
	}
	if _, ok := root["packages"]; ok {
		t.Fatalf("empty list must be removed: %v", root)
	}
}

func TestWriteRefusesCorruptSettings(t *testing.T) {
	agent := setupAgent(t)
	path := filepath.Join(agent, "settings.json")
	writeFile(t, path, `{"defaultProvider": `)
	if err := New(nil).SetDefaults("lab", "fast", ""); err == nil {
		t.Fatal("a corrupt file must stop the write")
	}
	data, _ := os.ReadFile(path)
	if !strings.Contains(string(data), `{"defaultProvider":`) {
		t.Fatalf("file changed: %s", data)
	}
}

func TestParseModels(t *testing.T) {
	output := `provider               model                                     context  max-out  thinking  images
magpie                 group/deepseek-flash                      1.0M     393.2K   yes       yes
deepseek               deepseek-flash                            1M       384K     yes       yes
`
	models := parseModels(output)
	if len(models) != 2 {
		t.Fatalf("models: %v", models)
	}
	if models[0].Provider != "magpie" || models[0].ID != "group/deepseek-flash" || models[0].Context != "1.0M" {
		t.Fatalf("first: %+v", models[0])
	}
}

func TestInspectKeepsMissingConfiguredPaths(t *testing.T) {
	agent := setupAgent(t)
	writeFile(t, filepath.Join(agent, "settings.json"), `{"skills":["./missing-skill"],"extensions":["./missing.ts"]}`)
	svc := New(nil)
	snap, err := svc.Inspect("")
	if err != nil {
		t.Fatal(err)
	}
	var skill, extension *Resource
	for i := range snap.Skills {
		if snap.Skills[i].Ref != "" {
			skill = &snap.Skills[i]
		}
	}
	for i := range snap.Extensions {
		if snap.Extensions[i].Ref != "" {
			extension = &snap.Extensions[i]
		}
	}
	if skill == nil || skill.Ref != "./missing-skill" || skill.Active {
		t.Fatalf("missing skill: %+v", skill)
	}
	if extension == nil || extension.Ref != "./missing.ts" || extension.Active {
		t.Fatalf("missing extension: %+v / all %+v", extension, snap.Extensions)
	}
	if err := svc.RemovePath("skills", skill.Ref); err != nil {
		t.Fatal(err)
	}
	root, _, _ := readObjectStrict(filepath.Join(agent, "settings.json"))
	if _, ok := root["skills"]; ok {
		t.Fatalf("skills key must be removed: %v", root)
	}
}

func TestSaveProviderRequiresModelForNewProvider(t *testing.T) {
	setupAgent(t)
	err := New(nil).SaveProvider(ProviderInput{ID: "lab", BaseURL: "https://lab.example/v1"})
	if err == nil {
		t.Fatal("a new provider without models must be rejected")
	}
}

func TestSaveProviderPreservesSymlink(t *testing.T) {
	agent := setupAgent(t)
	target := filepath.Join(t.TempDir(), "models.json")
	writeFile(t, target, `{"providers":{}}`)
	link := filepath.Join(agent, "models.json")
	if err := os.Symlink(target, link); err != nil {
		t.Skipf("symlink not available: %v", err)
	}
	err := New(nil).SaveProvider(ProviderInput{
		ID: "lab", BaseURL: "https://lab.example/v1",
		Models: []ProviderModel{{ID: "fast"}},
	})
	if err != nil {
		t.Fatal(err)
	}
	info, err := os.Lstat(link)
	if err != nil || info.Mode()&os.ModeSymlink == 0 {
		t.Fatalf("the settings link must stay a symlink: %v %v", info, err)
	}
	data, err := os.ReadFile(target)
	if err != nil || !strings.Contains(string(data), `"lab"`) {
		t.Fatalf("the link target must hold the provider: %s %v", data, err)
	}
}

func TestInspectIgnoresNonExtensionFiles(t *testing.T) {
	agent := setupAgent(t)
	writeFile(t, filepath.Join(agent, "extensions", "README.md"), "docs")
	writeFile(t, filepath.Join(agent, "extensions", "tool.ts"), "export default () => {}\n")
	snap, err := New(nil).Inspect("")
	if err != nil {
		t.Fatal(err)
	}
	if len(snap.Extensions) != 1 || snap.Extensions[0].Name != "tool" {
		t.Fatalf("extensions: %+v", snap.Extensions)
	}
}

func TestWriteRefusesOversizedConfig(t *testing.T) {
	agent := setupAgent(t)
	path := filepath.Join(agent, "settings.json")
	writeFile(t, path, "{}")
	if err := os.Truncate(path, 4<<20+1); err != nil {
		t.Fatal(err)
	}
	if err := New(nil).SetDefaults("lab", "fast", ""); err == nil {
		t.Fatal("an oversized config must not be rewritten")
	}
}

func TestInspectDoesNotWalkUntrustedProjectPaths(t *testing.T) {
	setupAgent(t)
	ws := t.TempDir()
	writeFile(t, filepath.Join(ws, ".pi", "settings.json"), `{"skills":["skills/private"]}`)
	writeFile(t, filepath.Join(ws, ".pi", "skills", "private", "SKILL.md"), "---\nname: private\ndescription: secret description\n---\n")
	snap, err := New(nil).Inspect(ws)
	if err != nil {
		t.Fatal(err)
	}
	var found *Resource
	for i := range snap.Skills {
		if snap.Skills[i].Project {
			found = &snap.Skills[i]
		}
	}
	if found == nil || !found.Project || found.Active || found.Description != "" || found.Ref != "skills/private" {
		t.Fatalf("untrusted project entry must not be read: %+v", found)
	}
	if filepath.IsAbs(found.Path) == false {
		t.Fatalf("the display path must be resolved: %q", found.Path)
	}
}

func TestFingerprintIgnoresProjectConfiguration(t *testing.T) {
	agent := setupAgent(t)
	writeFile(t, filepath.Join(agent, "settings.json"), `{"defaultProvider":"lab"}`)
	ws1 := t.TempDir()
	ws2 := t.TempDir()
	writeFile(t, filepath.Join(ws1, ".pi", "settings.json"), `{"skills":["a"]}`)
	writeFile(t, filepath.Join(ws2, ".pi", "settings.json"), `{"skills":["b"]}`)
	svc := New(nil)
	one, err := svc.Inspect(ws1)
	if err != nil {
		t.Fatal(err)
	}
	two, err := svc.Inspect(ws2)
	if err != nil {
		t.Fatal(err)
	}
	if one.Fingerprint != two.Fingerprint {
		t.Fatalf("project config must not change the user fingerprint: %s != %s", one.Fingerprint, two.Fingerprint)
	}
}

func TestModelsFileStaysPrivate(t *testing.T) {
	agent := setupAgent(t)
	path := filepath.Join(agent, "models.json")
	writeFile(t, path, `{"providers":{}}`)
	if err := os.Chmod(path, 0o644); err != nil {
		t.Fatal(err)
	}
	err := New(nil).SaveProvider(ProviderInput{
		ID: "lab", BaseURL: "https://lab.example/v1",
		Models: []ProviderModel{{ID: "fast"}},
	})
	if err != nil {
		t.Fatal(err)
	}
	info, err := os.Stat(path)
	if err != nil || info.Mode().Perm() != 0o600 {
		t.Fatalf("models.json must be private: %v %v", info, err)
	}
}

func TestSaveProviderRefusesUnexpectedModelsShape(t *testing.T) {
	agent := setupAgent(t)
	path := filepath.Join(agent, "models.json")
	original := `{"providers":{"lab":{"baseUrl":"https://lab.example/v1","models":{"fast":{"id":"fast"}}}}}`
	writeFile(t, path, original)
	err := New(nil).SaveProvider(ProviderInput{
		ID: "lab", BaseURL: "https://lab.example/v1",
		Models: []ProviderModel{{ID: "fast"}},
	})
	if err == nil {
		t.Fatal("an unexpected models shape must stop the write")
	}
	data, _ := os.ReadFile(path)
	if string(data) != original {
		t.Fatalf("file changed: %s", data)
	}
}

func TestSaveProviderCreateRejectsExisting(t *testing.T) {
	agent := setupAgent(t)
	writeFile(t, filepath.Join(agent, "models.json"), `{"providers":{"lab":{"baseUrl":"https://a","models":[{"id":"fast"}]}}}`)
	err := New(nil).SaveProvider(ProviderInput{
		ID: "lab", Create: true, BaseURL: "https://b",
		Models: []ProviderModel{{ID: "other"}},
	})
	if err == nil {
		t.Fatal("create must reject an existing provider")
	}
}

func TestReadModelsAcceptsJSONCAndWarns(t *testing.T) {
	agent := setupAgent(t)
	writeFile(t, filepath.Join(agent, "models.json"), `{
  "providers": {
    "lab": {
      "baseUrl": "https://lab.example/v1", // endpoint
      "models": [{"id": "fast"},],
    },
  },
}`)
	snap, err := New(nil).Inspect("")
	if err != nil {
		t.Fatal(err)
	}
	if len(snap.Providers) != 1 || len(snap.Providers[0].Models) != 1 {
		t.Fatalf("providers: %+v", snap.Providers)
	}
	if !strings.Contains(strings.Join(snap.Warnings, "\n"), "plain JSON") {
		t.Fatalf("JSONC warning missing: %v", snap.Warnings)
	}
	if err := New(nil).SaveProvider(ProviderInput{ID: "lab", BaseURL: "https://lab.example/v1"}); err != nil {
		t.Fatal(err)
	}
	root, _, err := readObjectStrict(filepath.Join(agent, "models.json"))
	if err != nil || root["providers"] == nil {
		t.Fatalf("saved file must be plain JSON: %v %v", root, err)
	}
}

func TestLegacySkillsObjectSurvivesPathEdits(t *testing.T) {
	agent := setupAgent(t)
	path := filepath.Join(agent, "settings.json")
	writeFile(t, path, `{"skills":{"enableSkillCommands":false,"customDirectories":["./a"]}}`)
	svc := New(nil)
	if err := svc.AddPath("skills", "./b"); err != nil {
		t.Fatal(err)
	}
	root, _, _ := readObjectStrict(path)
	object, ok := root["skills"].(map[string]any)
	if !ok || object["enableSkillCommands"] != false || len(stringList(object["customDirectories"])) != 2 {
		t.Fatalf("legacy object must be preserved: %v", root)
	}
	if err := svc.RemovePath("skills", "./a"); err != nil {
		t.Fatal(err)
	}
	root, _, _ = readObjectStrict(path)
	object, _ = root["skills"].(map[string]any)
	if object == nil || object["enableSkillCommands"] != false || len(stringList(object["customDirectories"])) != 1 {
		t.Fatalf("legacy object after remove: %v", root)
	}
}

func TestExtensionDiscoveryMirrorsPi(t *testing.T) {
	agent := setupAgent(t)
	ext := filepath.Join(agent, "extensions")
	writeFile(t, filepath.Join(ext, "tool.ts"), "export default () => {}\n")
	writeFile(t, filepath.Join(ext, "ignored.mjs"), "export default () => {}\n")
	writeFile(t, filepath.Join(ext, "README.md"), "docs")
	writeFile(t, filepath.Join(ext, "lib", "helper.ts"), "export const x = 1;\n")
	writeFile(t, filepath.Join(ext, "pkg", "package.json"), `{"pi":{"extensions":["./src/index.ts"]}}`)
	writeFile(t, filepath.Join(ext, "pkg", "src", "index.ts"), "export default () => {}\n")
	snap, err := New(nil).Inspect("")
	if err != nil {
		t.Fatal(err)
	}
	var names []string
	for _, item := range snap.Extensions {
		names = append(names, item.Name)
	}
	if strings.Join(names, ",") != "pkg,tool" {
		t.Fatalf("extensions: %v", names)
	}
}

func TestConfiguredMarkdownSkillAndBuiltinExtension(t *testing.T) {
	agent := setupAgent(t)
	writeFile(t, filepath.Join(agent, "settings.json"), `{"skills":["./notes.md"],"extensions":["builtin:mcp","./tools.mjs"]}`)
	writeFile(t, filepath.Join(agent, "notes.md"), "---\nname: notes\ndescription: >-\n  A standalone\n  skill.\n---\n")
	writeFile(t, filepath.Join(agent, "tools.mjs"), "export default () => {}\n")
	snap, err := New(nil).Inspect("")
	if err != nil {
		t.Fatal(err)
	}
	if len(snap.Skills) != 1 || snap.Skills[0].Name != "notes" || snap.Skills[0].Description != "A standalone skill." || !snap.Skills[0].Active {
		t.Fatalf("markdown skill: %+v", snap.Skills)
	}
	if len(snap.Extensions) != 1 || snap.Extensions[0].Name != "tools" || snap.Extensions[0].Active {
		t.Fatalf("configured extension: %+v", snap.Extensions)
	}
}

func TestStaleSettingsLockIsReplaced(t *testing.T) {
	agent := setupAgent(t)
	writeFile(t, filepath.Join(agent, "settings.json"), "{}")
	lock := filepath.Join(agent, "settings.json.lock")
	if err := os.Mkdir(lock, 0o700); err != nil {
		t.Fatal(err)
	}
	old := time.Now().Add(-time.Minute)
	if err := os.Chtimes(lock, old, old); err != nil {
		t.Fatal(err)
	}
	if err := New(nil).AddPath("skills", "./x"); err != nil {
		t.Fatalf("a stale lock must be replaced: %v", err)
	}
	if _, err := os.Stat(lock); !os.IsNotExist(err) {
		t.Fatalf("the lock must be released: %v", err)
	}
}

func TestFingerprintTracksUserMCP(t *testing.T) {
	agent := setupAgent(t)
	path := filepath.Join(agent, "mcp.json")
	writeFile(t, path, `{"mcpServers":{"docs":{"url":"https://a.example/mcp"}}}`)
	svc := New(nil)
	one, err := svc.Inspect("")
	if err != nil {
		t.Fatal(err)
	}
	writeFile(t, path, `{"mcpServers":{"docs":{"url":"https://b.example/mcp"}}}`)
	two, err := svc.Inspect("")
	if err != nil {
		t.Fatal(err)
	}
	if one.Fingerprint == two.Fingerprint {
		t.Fatal("a user MCP change must change the fingerprint")
	}
}

func TestAddPathCreatesMissingAgentDir(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "new-agent")
	t.Setenv("PI_CODING_AGENT_DIR", dir)
	t.Setenv("HOME", t.TempDir())
	if err := New(nil).AddPath("skills", "./x"); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(dir, "settings.json")); err != nil {
		t.Fatal(err)
	}
}

func TestParseModelsRequiresHeader(t *testing.T) {
	if models := parseModels("No models available. Use /login to add a provider.\n"); len(models) != 0 {
		t.Fatalf("models: %+v", models)
	}
}

func TestSettingsWithBOM(t *testing.T) {
	agent := setupAgent(t)
	writeFile(t, filepath.Join(agent, "settings.json"), "\ufeff"+`{"defaultProvider":"lab","defaultModel":"fast"}`)
	snap, err := New(nil).Inspect("")
	if err != nil {
		t.Fatal(err)
	}
	if snap.Defaults.Provider != "lab" || snap.Defaults.Model != "fast" {
		t.Fatalf("defaults: %+v", snap.Defaults)
	}
}

func TestSetDefaultsRejectsHalfState(t *testing.T) {
	setupAgent(t)
	if err := New(nil).SetDefaults("lab", "", ""); err == nil {
		t.Fatal("a provider without a model must be rejected")
	}
	if err := New(nil).SetDefaults("", "fast", ""); err == nil {
		t.Fatal("a model without a provider must be rejected")
	}
}

func TestSaveProviderRejectsClearAndNewKey(t *testing.T) {
	setupAgent(t)
	err := New(nil).SaveProvider(ProviderInput{
		ID: "lab", BaseURL: "https://lab.example/v1", ClearKey: true, APIKey: "new",
		Models: []ProviderModel{{ID: "fast"}},
	})
	if err == nil {
		t.Fatal("clear and a new key must conflict")
	}
}

func TestProjectDefaultsAreReportedSeparately(t *testing.T) {
	agent := setupAgent(t)
	writeFile(t, filepath.Join(agent, "settings.json"), `{"defaultProvider":"user","defaultModel":"user-model"}`)
	ws := t.TempDir()
	writeFile(t, filepath.Join(ws, ".pi", "settings.json"), `{"defaultProvider":"project","defaultModel":"project-model"}`)
	store, err := settings.Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if err := store.Update(func(c *settings.Settings) error {
		c.Trust[ws] = settings.TrustTrusted
		return nil
	}); err != nil {
		t.Fatal(err)
	}
	snap, err := New(store).Inspect(ws)
	if err != nil {
		t.Fatal(err)
	}
	if !snap.Trusted || snap.Defaults.Provider != "user" || snap.Defaults.Model != "user-model" {
		t.Fatalf("user defaults: %+v", snap.Defaults)
	}
	if snap.ProjectDefaults == nil || snap.ProjectDefaults.Provider != "project" || snap.ProjectDefaults.Model != "project-model" {
		t.Fatalf("project defaults: %+v", snap.ProjectDefaults)
	}
}

func TestInspectFindsMarkdownAndSymlinkedSkills(t *testing.T) {
	agent := setupAgent(t)
	writeFile(t, filepath.Join(agent, "skills", "notes.md"), "---\nname: notes\ndescription: standalone\n---\n")
	target := t.TempDir()
	writeFile(t, filepath.Join(target, "SKILL.md"), "---\nname: team\ndescription: shared\n---\n")
	if err := os.Symlink(target, filepath.Join(agent, "skills", "team")); err != nil {
		t.Skipf("symlink not available: %v", err)
	}
	snap, err := New(nil).Inspect("")
	if err != nil {
		t.Fatal(err)
	}
	var names []string
	for _, skill := range snap.Skills {
		names = append(names, skill.Name)
	}
	if strings.Join(names, ",") != "notes,team" {
		t.Fatalf("skills: %v", names)
	}
}

func TestSkillsWithoutDescriptionAreNotListed(t *testing.T) {
	agent := setupAgent(t)
	writeFile(t, filepath.Join(agent, "skills", "README.md"), "# Notes\n")
	writeFile(t, filepath.Join(agent, "skills", "good", "SKILL.md"), "---\nname: good\ndescription: Works.\n---\n")
	writeFile(t, filepath.Join(agent, "settings.json"), `{"skills":["./skills/bad"]}`)
	writeFile(t, filepath.Join(agent, "skills", "bad", "SKILL.md"), "---\nname: bad\n---\n")
	snap, err := New(nil).Inspect("")
	if err != nil {
		t.Fatal(err)
	}
	var found []Resource
	for _, skill := range snap.Skills {
		if skill.Ref != "" {
			found = append(found, skill)
		}
	}
	if len(found) != 1 || found[0].Name != "bad" || found[0].Active {
		t.Fatalf("configured invalid skill: %+v", found)
	}
	for _, skill := range snap.Skills {
		if skill.Name == "README" || skill.Name == "bad" && skill.Active {
			t.Fatalf("invalid skill listed: %+v", snap.Skills)
		}
	}
}
