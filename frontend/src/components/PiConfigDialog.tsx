import * as Dialog from "@/components/ui/dialog-compat";
import { Button } from "@/components/ui/button";
import { CheckboxField } from "@/components/ui/checkbox";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { DialogHeader, DialogOverlay, DialogSurface } from "@/components/ui/dialog-shell";
import { FormSection } from "@/components/ui/form-section";
import { SectionLabel } from "@/components/ui/section-label";
import { Select } from "@/components/ui/select";
import { Boxes, Check, FolderOpen, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { api } from "../lib/api";
import { cn } from "../lib/cn";
import { t } from "../lib/i18n";
import { toast } from "../lib/toast";
import type {
  AvailableModel,
  Provider,
  ProviderInput,
  ProviderModel,
  Resource,
  Snapshot as PiConfigSnapshot,
} from "../mygo";
import { ConfirmDialog } from "./ConfirmDialog";

const THINKING_LEVELS = ["", "off", "minimal", "low", "medium", "high", "xhigh", "max"];

export type PiConfigSection = "defaults" | "models" | "skills" | "extensions" | "mcp";
let modelsCache: { at: number; models: AvailableModel[] } | null = null;
const MODELS_TTL = 60_000;

const API_OPTIONS = [
  "openai-completions",
  "openai-responses",
  "anthropic-messages",
  "google-generative-ai",
  "mistral-conversations",
  "bedrock-converse-stream",
  "azure-openai-responses",
  "openai-codex-responses",
  "google-vertex",
];

function emptyProvider(): ProviderInput {
  return {
    id: "",
    create: true,
    name: "",
    api: "openai-completions",
    baseUrl: "",
    apiKey: "",
    clearKey: false,
    models: [],
  };
}

function editProvider(provider: Provider): ProviderInput {
  return {
    id: provider.id,
    create: false,
    name: provider.name ?? "",
    api: provider.api ?? "",
    baseUrl: provider.baseUrl ?? "",
    apiKey: "",
    clearKey: false,
    models: provider.models.map((model) => ({ ...model })),
  };
}

export function PiConfigPanel({
  workspace,
  confirmedHash,
  onConfirmed,
  onOpenMCP,
  embedded = false,
  onClose,
  section,
}: {
  workspace?: string;
  confirmedHash: string;
  onConfirmed: (hash: string) => void;
  onOpenMCP?: () => void;
  embedded?: boolean;
  onClose?: () => void;
  section?: PiConfigSection;
}) {
  const [snapshot, setSnapshot] = useState<PiConfigSnapshot | null>(null);
  const [models, setModels] = useState<AvailableModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");
  const [modelProvider, setModelProvider] = useState("");
  const [thinking, setThinking] = useState("");
  const [editing, setEditing] = useState<ProviderInput | null>(null);
  const [editingMeta, setEditingMeta] = useState({ baseUrl: "", keySet: false });
  const [newProvider, setNewProvider] = useState(false);
  const [removingProvider, setRemovingProvider] = useState<string | null>(null);
  const [removingPackage, setRemovingPackage] = useState<string | null>(null);
  const [removingPath, setRemovingPath] = useState<{
    kind: "skills" | "extensions";
    path: string;
    label: string;
  } | null>(null);
  const [skillPath, setSkillPath] = useState("");
  const [extensionPath, setExtensionPath] = useState("");
  const [packageSource, setPackageSource] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await api.piConfigInspect(workspace ?? "");
      setSnapshot(next);
      setProvider(next.defaults.provider ?? "");
      setModel(next.defaults.model ?? "");
      setThinking(next.defaults.thinking ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [workspace]);

  const loadModels = useCallback(async (force = false) => {
    if (!force && modelsCache && Date.now() - modelsCache.at < MODELS_TTL) {
      setModels(modelsCache.models);
      return;
    }
    setModelsLoading(true);
    try {
      const list = await api.piConfigModels();
      modelsCache = { at: Date.now(), models: list };
      setModels(list);
    } catch {
      setModels([]);
    } finally {
      setModelsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    void loadModels();
  }, [load, loadModels]);

  // A save records the new fingerprint, so editing does not prompt again.
  const reloadAndConfirm = useCallback(async () => {
    const next = await api.piConfigInspect(workspace ?? "");
    setSnapshot(next);
    modelsCache = null;
    void loadModels(true);
    await api.setPreferences({ piConfigHash: next.fingerprint });
    onConfirmed(next.fingerprint);
    return next;
  }, [workspace, onConfirmed]);

  const confirm = async () => {
    if (!snapshot) return;
    setBusy(true);
    try {
      await api.setPreferences({ piConfigHash: snapshot.fingerprint });
      onConfirmed(snapshot.fingerprint);
      toast.success(t("Pi configuration confirmed"));
      onClose?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const saveDefaults = async () => {
    setBusy(true);
    try {
      await api.piConfigSetDefaults(provider, model, thinking);
      await reloadAndConfirm();
      toast.success(t("Default model saved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const saveProvider = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      await api.piConfigSaveProvider(editing);
      setEditing(null);
      setNewProvider(false);
      await reloadAndConfirm();
      toast.success(t("Provider saved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const removeProvider = async () => {
    if (!removingProvider) return;
    setBusy(true);
    try {
      await api.piConfigRemoveProvider(removingProvider);
      setRemovingProvider(null);
      await reloadAndConfirm();
      toast.success(t("Provider removed"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const addPath = async (kind: "skills" | "extensions", path: string) => {
    if (!path.trim()) return;
    setBusy(true);
    try {
      await api.piConfigAddPath(kind, path.trim());
      if (kind === "skills") setSkillPath("");
      else setExtensionPath("");
      await reloadAndConfirm();
      toast.success(t("Path added"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const removePath = async (kind: "skills" | "extensions", path: string) => {
    setBusy(true);
    try {
      await api.piConfigRemovePath(kind, path);
      setRemovingPath(null);
      await reloadAndConfirm();
      toast.success(t("Path removed"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const addPackage = async () => {
    const source = packageSource.trim();
    if (!source) return;
    setBusy(true);
    try {
      await api.piConfigAddPackage(source);
      setPackageSource("");
      await reloadAndConfirm();
      toast.success(t("Package added"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const removePackage = async () => {
    if (!removingPackage) return;
    setBusy(true);
    try {
      await api.piConfigRemovePackage(removingPackage);
      setRemovingPackage(null);
      await reloadAndConfirm();
      toast.success(t("Package removed"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const needsConfirm = Boolean(snapshot && snapshot.fingerprint !== confirmedHash);
  const providerIDs = useMemo(() => {
    const ids = new Set<string>();
    for (const p of snapshot?.providers ?? []) ids.add(p.id);
    for (const m of models) ids.add(m.provider);
    if (provider) ids.add(provider);
    return [...ids].sort();
  }, [snapshot?.providers, models, provider]);
  const providerOptions = useMemo<ComboboxOption[]>(
    () => [
      { value: "", label: t("Automatic") },
      ...providerIDs.map((id) => ({ value: id, label: id })),
    ],
    [providerIDs],
  );
  const modelProviders = useMemo(
    () => [...new Set(models.map((m) => m.provider))].sort(),
    [models],
  );
  const scopedProvider =
    provider ||
    (modelProviders.includes(modelProvider) ? modelProvider : "") ||
    models.find((m) => m.id === model)?.provider ||
    modelProviders[0] ||
    "";
  const modelOptions = useMemo<ComboboxOption[]>(() => {
    const list = scopedProvider ? models.filter((m) => m.provider === scopedProvider) : [];
    const seen = new Set<string>();
    const options: ComboboxOption[] = [{ value: "", label: t("Automatic") }];
    for (const m of list) {
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      options.push({
        value: m.id,
        label: m.id,
        detail: [m.context].filter(Boolean).join(" · "),
      });
    }
    return options;
  }, [models, scopedProvider]);
  const selectedModel = useMemo(
    () =>
      modelOptions.find((option) => option.value === model) ??
      (model ? { value: model, label: model } : null),
    [modelOptions, model],
  );
  const show = (id: PiConfigSection) => !section || section === id;

  return (
    <>
      <fieldset
        disabled={busy}
        className={
          embedded
            ? "m-0 min-w-0 border-0 p-0"
            : "m-0 min-h-0 min-w-0 flex-1 overflow-y-auto scroll-thin border-0 px-5 py-4"
        }
      >
        {needsConfirm && snapshot ? (
          <div className="mb-5 rounded-lg border border-brand/30 bg-brand-soft/40 px-3 py-2.5">
            <p className="text-label leading-5 text-fg">
              {t("PiS loaded these resources from pi. Confirm the list, or change it below.")}
            </p>
            <p className="mt-0.5 text-micro text-subtle">
              {t("Skills")} {snapshot.skills.filter((s) => s.active).length} · {t("Extensions")}{" "}
              {snapshot.extensions.filter((s) => s.active).length} · {t("Providers")}{" "}
              {snapshot.providers.length} · {t("Packages")}{" "}
              {snapshot.packages.filter((p) => p.active).length}
              {snapshot.mcp.length
                ? ` · ${t("MCP servers")} ${
                    snapshot.mcp.filter(
                      (s) => s.enabled && (s.source !== "project" || snapshot.trusted),
                    ).length
                  }`
                : ""}
            </p>
            <p className="mt-0.5 text-micro leading-4 text-subtle">
              {snapshot.defaults.provider || snapshot.defaults.model
                ? t("Default model: {model}", {
                    model: [snapshot.defaults.provider, snapshot.defaults.model]
                      .filter(Boolean)
                      .join("/"),
                  })
                : t("pi chooses the startup model automatically.")}
            </p>
            <Button
              size="sm"
              variant="brand"
              className="mt-2"
              disabled={busy}
              onClick={() => void confirm()}
            >
              <Check size={12} />
              {t("Use this configuration")}
            </Button>
          </div>
        ) : null}

        {error ? (
          <p className="py-6 text-label leading-5 text-danger">{error}</p>
        ) : !snapshot ? (
          <div className="flex items-center gap-2 py-10 text-label text-faint">
            <Loader2 size={13} className="animate-spin" />
            {t("Reading pi configuration…")}
          </div>
        ) : (
          <>
            {show("defaults") ? (
              <>
                <div className="mb-5 rounded-lg border border-border bg-canvas px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="min-w-0 flex-1 truncate font-mono text-micro text-subtle"
                      title={snapshot.agentDir}
                    >
                      {snapshot.agentDir}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        modelsCache = null;
                        void load();
                        void loadModels(true);
                      }}
                      disabled={loading || modelsLoading}
                      aria-label={t("Refresh pi configuration")}
                      title={t("Refresh pi configuration")}
                      className="flex shrink-0 items-center gap-1 text-micro text-subtle hover:text-fg disabled:opacity-40"
                    >
                      <RefreshCw
                        size={11}
                        className={loading || modelsLoading ? "animate-spin" : ""}
                      />
                      {t("Refresh")}
                    </button>
                    <button
                      type="button"
                      onClick={() => void api.reveal(snapshot.agentDir).catch(() => {})}
                      aria-label={t("Reveal pi config folder")}
                      title={t("Reveal pi config folder")}
                      className="flex size-6 shrink-0 items-center justify-center rounded-md text-faint hover:bg-surface-2 hover:text-fg"
                    >
                      <FolderOpen size={11} />
                    </button>
                  </div>
                  <p className="mt-1 text-micro leading-4 text-faint">
                    {t("PiS writes these files directly and does not copy them.")}
                  </p>
                  <div className="mt-1 space-y-0.5 font-mono text-micro text-faint">
                    <div className="truncate">{snapshot.agentDir}/settings.json</div>
                    <div className="truncate">{snapshot.agentDir}/models.json</div>
                    <div className="truncate">{snapshot.agentDir}/mcp.json</div>
                    {workspace ? (
                      <div className="truncate">{workspace}/.pi/settings.json</div>
                    ) : null}
                    {workspace ? <div className="truncate">{workspace}/.pi/mcp.json</div> : null}
                  </div>
                </div>

                {snapshot.warnings?.length ? (
                  <ul className="mb-5 space-y-1 rounded-lg border border-warning/25 bg-warning/5 px-3 py-2 text-micro leading-4 text-warning">
                    {snapshot.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                ) : null}
              </>
            ) : null}

            {show("defaults") ? (
              <FormSection
                divided
                title={t("Defaults")}
                description={t(
                  "The model pi and new sessions start with. Built-in models come from pi; custom models come from models.json.",
                )}
              >
                <div className="grid gap-2 sm:grid-cols-3">
                  <label className="flex flex-col gap-1 text-micro text-subtle">
                    {t("Default provider")}
                    <Combobox
                      value={providerOptions.find((option) => option.value === provider) ?? null}
                      options={providerOptions}
                      onValueChange={(option) => {
                        const next = option.value;
                        setProvider(next);
                        if (!next) {
                          setModel("");
                          setModelProvider("");
                        }
                        const candidates = models.filter((m) => m.provider === next);
                        const first = candidates[0];
                        if (!candidates.some((m) => m.id === model)) setModel(first?.id ?? "");
                      }}
                      ariaLabel={t("Default provider")}
                      placeholder={t("Automatic")}
                      emptyLabel={t("Nothing found.")}
                      disabled={busy}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-micro text-subtle">
                    {t("Default model")}
                    {modelOptions.length > 1 ? (
                      <Combobox
                        value={selectedModel}
                        options={modelOptions}
                        onValueChange={(option) => {
                          const id = option.value;
                          setModel(id);
                          if (!id) {
                            setProvider("");
                            return;
                          }
                          if (!provider) {
                            setProvider(scopedProvider);
                            setModelProvider(scopedProvider);
                          }
                        }}
                        onOpenChange={(open) => {
                          if (open && !provider) {
                            setModelProvider(
                              models.find((m) => m.id === model)?.provider ??
                                modelProviders[0] ??
                                "",
                            );
                          }
                        }}
                        ariaLabel={t("Default model")}
                        placeholder={t("Automatic")}
                        emptyLabel={t("Nothing found.")}
                        disabled={busy}
                        popupClassName={
                          !provider && modelProviders.length > 1
                            ? "w-[min(480px,var(--available-width))]"
                            : undefined
                        }
                        popupStart={
                          !provider && modelProviders.length > 1 ? (
                            <div
                              role="group"
                              aria-label={t("Providers")}
                              className="max-h-[min(22rem,var(--available-height))] w-36 shrink-0 overflow-y-auto scroll-thin border-r border-border py-1 pr-1"
                            >
                              <div className="px-2 pb-1 pt-1 text-micro font-medium uppercase tracking-label text-faint">
                                {t("Providers")}
                              </div>
                              {modelProviders.map((id) => (
                                <button
                                  key={id}
                                  type="button"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => setModelProvider(id)}
                                  aria-pressed={scopedProvider === id}
                                  className={cn(
                                    "flex w-full items-center rounded-md px-2 py-1.5 text-left text-micro transition-colors",
                                    scopedProvider === id
                                      ? "bg-surface-2 font-medium text-fg"
                                      : "text-subtle hover:bg-surface-2 hover:text-fg",
                                  )}
                                >
                                  <span className="truncate">{id}</span>
                                </button>
                              ))}
                            </div>
                          ) : null
                        }
                      />
                    ) : (
                      <input
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                        placeholder={t("Model id")}
                        className="h-8 rounded-md border border-control bg-canvas px-2 font-mono text-label outline-none placeholder:text-faint focus:border-brand"
                        spellCheck={false}
                      />
                    )}
                  </label>
                  <label className="flex flex-col gap-1 text-micro text-subtle">
                    {t("Thinking level")}
                    <Select
                      value={thinking}
                      options={THINKING_LEVELS.map((level) => ({
                        value: level,
                        label: level ? t(level) : t("Automatic"),
                      }))}
                      onValueChange={setThinking}
                      ariaLabel={t("Thinking level")}
                      disabled={busy}
                    />
                  </label>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <Button size="sm" disabled={busy} onClick={() => void saveDefaults()}>
                    {t("Save defaults")}
                  </Button>
                  {modelsLoading ? (
                    <span className="flex items-center gap-1 text-micro text-faint">
                      <Loader2 size={11} className="animate-spin" />
                      {t("Loading models…")}
                    </span>
                  ) : null}
                </div>
                {snapshot.projectDefaults ? (
                  <p className="mt-2 rounded-md border border-warning/25 bg-warning/5 px-2 py-1.5 text-micro leading-4 text-warning">
                    {t(
                      "This project sets its own startup default ({model}). It overrides the user default for new sessions in this project.",
                      {
                        model:
                          [snapshot.projectDefaults.provider, snapshot.projectDefaults.model]
                            .filter(Boolean)
                            .join("/") || t("Automatic"),
                      },
                    )}
                  </p>
                ) : null}
              </FormSection>
            ) : null}

            {show("models") ? (
              <FormSection
                divided={!section}
                title={t("Models and providers")}
                description={t(
                  "Providers configured in models.json. Built-in providers use pi sign-in.",
                )}
                actions={
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => {
                      setEditing(emptyProvider());
                      setEditingMeta({ baseUrl: "", keySet: false });
                      setNewProvider(true);
                    }}
                  >
                    <Plus size={11} />
                    {t("Add provider")}
                  </Button>
                }
              >
                {editing ? (
                  <ProviderForm
                    input={editing}
                    isNew={newProvider}
                    storedKey={editingMeta.keySet}
                    originalBaseUrl={editingMeta.baseUrl}
                    busy={busy}
                    onChange={setEditing}
                    onCancel={() => {
                      setEditing(null);
                      setNewProvider(false);
                    }}
                    onSave={() => void saveProvider()}
                  />
                ) : snapshot.providers.length === 0 ? (
                  <p className="text-label text-faint">{t("No custom providers configured.")}</p>
                ) : (
                  <ul className="space-y-1.5">
                    {snapshot.providers.map((p) => (
                      <li
                        key={p.id}
                        className="flex items-start gap-2 rounded-lg border border-border bg-surface-2/40 px-3 py-2"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-label font-medium">{p.name || p.id}</span>
                            <span className="rounded bg-surface-3 px-1 py-0.5 font-mono text-micro text-subtle">
                              {p.id}
                            </span>
                            {p.apiKeySet ? (
                              <span className="rounded bg-success/10 px-1 py-0.5 text-micro text-success">
                                {p.apiKeyEnv ? t("Environment key") : t("API key is stored")}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-0.5 truncate font-mono text-micro text-faint">
                            {[p.api, p.baseUrl].filter(Boolean).join(" · ") || "—"}
                          </p>
                          <p className="mt-0.5 text-micro text-faint">
                            {p.models.length} {p.models.length === 1 ? t("model") : t("models")}
                            {p.models.length
                              ? `: ${p.models
                                  .slice(0, 4)
                                  .map((m) => m.id)
                                  .join(", ")}${p.models.length > 4 ? "…" : ""}`
                              : ""}
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <Button
                            size="xs"
                            variant="ghost"
                            onClick={() => {
                              setEditing(editProvider(p));
                              setEditingMeta({ baseUrl: p.baseUrl ?? "", keySet: p.apiKeySet });
                              setNewProvider(false);
                            }}
                          >
                            {t("Edit")}
                          </Button>
                          <button
                            type="button"
                            onClick={() => setRemovingProvider(p.id)}
                            className="flex size-6 items-center justify-center rounded-md text-faint hover:bg-danger/10 hover:text-danger"
                            aria-label={t("Remove {name}", { name: p.id })}
                            title={t("Remove provider")}
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </FormSection>
            ) : null}

            {show("skills") ? (
              <FormSection
                divided={!section}
                title={t("Skills")}
                description={t(
                  "Skills pi discovers in its folders and the paths configured in settings.json.",
                )}
              >
                <ResourceList
                  items={snapshot.skills}
                  busy={busy}
                  onRemove={(path) => void removePath("skills", path)}
                  empty={t("No skills found.")}
                />
                <PathForm
                  value={skillPath}
                  onChange={setSkillPath}
                  placeholder={t("Path to a skill file or folder")}
                  button={t("Add skill path")}
                  busy={busy}
                  onAdd={() => void addPath("skills", skillPath)}
                />
              </FormSection>
            ) : null}

            {show("extensions") ? (
              <FormSection
                divided={!section}
                title={t("Extensions")}
                description={t(
                  "Extension files and folders. Packages are installed by pi at session start.",
                )}
              >
                <ResourceList
                  items={snapshot.extensions}
                  busy={busy}
                  onRemove={(path) => void removePath("extensions", path)}
                  empty={t("No extensions found.")}
                />
                <PathForm
                  value={extensionPath}
                  onChange={setExtensionPath}
                  placeholder={t("Path to an extension file or folder")}
                  button={t("Add extension path")}
                  busy={busy}
                  onAdd={() => void addPath("extensions", extensionPath)}
                />
                <div className="mt-3 border-t border-border pt-2.5">
                  <SectionLabel>{t("Pi packages")}</SectionLabel>
                  {snapshot.packages.length ? (
                    <ul className="mt-1.5 space-y-1">
                      {snapshot.packages.map((pkg) => (
                        <li
                          key={`${pkg.project}:${pkg.source}`}
                          className="flex items-center gap-2 rounded-md bg-surface-2/40 px-2.5 py-1.5"
                        >
                          <span className="min-w-0 flex-1 truncate font-mono text-micro text-subtle">
                            {pkg.source}
                          </span>
                          <SourceBadge source={pkg.project ? "project" : "user"} />
                          {!pkg.active ? <InactiveBadge /> : null}
                          {!pkg.project ? (
                            <button
                              type="button"
                              onClick={() => setRemovingPackage(pkg.source)}
                              className="flex size-6 shrink-0 items-center justify-center rounded-md text-faint hover:bg-danger/10 hover:text-danger"
                              aria-label={t("Remove {name}", { name: pkg.source })}
                              title={t("Remove package")}
                            >
                              <Trash2 size={11} />
                            </button>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1.5 text-label text-faint">{t("No packages configured.")}</p>
                  )}
                  <PathForm
                    value={packageSource}
                    onChange={setPackageSource}
                    placeholder={t("Package source")}
                    button={t("Add package")}
                    busy={busy}
                    onAdd={() => void addPackage()}
                  />
                  <p className="mt-1.5 text-micro leading-4 text-faint">
                    {t("Examples: npm:pi-web-access, git:github.com/user/repo, or a local path.")}
                  </p>
                </div>
              </FormSection>
            ) : null}

            {show("mcp") ? (
              <FormSection
                divided={!section}
                title={t("MCP servers")}
                description={t(
                  "Servers from pi's mcp.json. pi connects enabled servers at session start.",
                )}
                actions={
                  onOpenMCP ? (
                    <Button size="xs" variant="outline" onClick={onOpenMCP}>
                      {t("Open MCP servers")}
                    </Button>
                  ) : null
                }
              >
                {snapshot.mcp.length ? (
                  <ul className="space-y-1">
                    {snapshot.mcp.map((server) => (
                      <li
                        key={`${server.source}:${server.name}`}
                        className="flex items-center gap-2 rounded-md bg-surface-2/40 px-2.5 py-1.5"
                      >
                        <span className="text-label">{server.name}</span>
                        <SourceBadge source={server.source} />
                        <span className="text-micro uppercase tracking-label text-faint">
                          {server.kind}
                        </span>
                        {!server.enabled ? (
                          <span className="text-micro text-faint">{t("disabled")}</span>
                        ) : null}
                        {server.source === "project" && !snapshot.trusted ? (
                          <InactiveBadge />
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-label text-faint">{t("No MCP servers configured.")}</p>
                )}
              </FormSection>
            ) : null}

            <p className="mt-1 text-micro leading-4 text-faint">
              {t("Settings are written to pi's own files. PiS does not copy or cache them.")}
            </p>
          </>
        )}
      </fieldset>

      <ConfirmDialog
        open={removingProvider !== null}
        onOpenChange={(next) => !next && setRemovingProvider(null)}
        title={t("Remove provider")}
        message={t(
          "Remove {id} from models.json? Models that use it stop working until you add it back.",
          { id: removingProvider ?? "" },
        )}
        confirmLabel={t("Remove")}
        danger
        onConfirm={() => void removeProvider()}
      />
      <ConfirmDialog
        open={removingPath !== null}
        onOpenChange={(next) => !next && setRemovingPath(null)}
        title={t("Remove configured path?")}
        message={t(
          "This removes {path} from pi's settings. Skills or extensions inside it stop loading.",
          { path: removingPath?.label ?? "" },
        )}
        confirmLabel={t("Remove")}
        danger
        busy={busy}
        onConfirm={() =>
          removingPath ? void removePath(removingPath.kind, removingPath.path) : undefined
        }
      />
      <ConfirmDialog
        open={removingPackage !== null}
        onOpenChange={(next) => !next && setRemovingPackage(null)}
        title={t("Remove package")}
        message={t("Remove {source} from pi's package list? Installed files stay on disk.", {
          source: removingPackage ?? "",
        })}
        confirmLabel={t("Remove")}
        danger
        onConfirm={() => void removePackage()}
      />
    </>
  );
}

export function PiConfigDialog({
  open,
  onOpenChange,
  workspace,
  confirmedHash,
  onConfirmed,
  onOpenMCP,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspace?: string;
  confirmedHash: string;
  onConfirmed: (hash: string) => void;
  onOpenMCP?: () => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <DialogOverlay />
        <DialogSurface width="xl">
          <DialogHeader
            icon={<Boxes size={15} />}
            title={t("Pi configuration")}
            description={t(
              "PiS reads this from pi's own files. Changes are written only when you save.",
            )}
            closeLabel={t("Close pi configuration")}
          />
          <PiConfigPanel
            workspace={workspace}
            confirmedHash={confirmedHash}
            onConfirmed={onConfirmed}
            onOpenMCP={onOpenMCP}
            onClose={() => onOpenChange(false)}
          />
        </DialogSurface>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ProviderForm({
  input,
  isNew,
  storedKey,
  originalBaseUrl,
  busy,
  onChange,
  onCancel,
  onSave,
}: {
  input: ProviderInput;
  isNew: boolean;
  storedKey: boolean;
  originalBaseUrl: string;
  busy: boolean;
  onChange: (next: ProviderInput) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const patch = (next: Partial<ProviderInput>) => onChange({ ...input, ...next });
  const patchModel = (index: number, next: Partial<ProviderModel>) => {
    const models = input.models.map((m, i) => (i === index ? { ...m, ...next } : m));
    patch({ models });
  };
  return (
    <div className="rounded-lg border border-border bg-canvas/60 p-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-micro text-subtle">
          {t("Provider id")}
          <input
            value={input.id}
            readOnly={!isNew}
            onChange={(e) => patch({ id: e.target.value })}
            placeholder="my-provider"
            className="h-8 rounded-md border border-control bg-canvas px-2 font-mono text-label outline-none placeholder:text-faint focus:border-brand read-only:opacity-70"
            spellCheck={false}
          />
        </label>
        <label className="flex flex-col gap-1 text-micro text-subtle">
          {t("Display name")}
          <input
            value={input.name}
            onChange={(e) => patch({ name: e.target.value })}
            placeholder={t("Optional")}
            className="h-8 rounded-md border border-control bg-canvas px-2 text-label outline-none placeholder:text-faint focus:border-brand"
          />
        </label>
        <label className="flex flex-col gap-1 text-micro text-subtle">
          {t("API")}
          <input
            value={input.api}
            onChange={(e) => patch({ api: e.target.value })}
            list="pis-pi-api-options"
            className="h-8 rounded-md border border-control bg-canvas px-2 font-mono text-label outline-none focus:border-brand"
            spellCheck={false}
          />
        </label>
        <label className="flex flex-col gap-1 text-micro text-subtle">
          {t("Base URL")}
          <input
            value={input.baseUrl}
            onChange={(e) => patch({ baseUrl: e.target.value })}
            placeholder="https://api.example.com/v1"
            className="h-8 rounded-md border border-control bg-canvas px-2 font-mono text-label outline-none placeholder:text-faint focus:border-brand"
            spellCheck={false}
          />
        </label>
      </div>
      <datalist id="pis-pi-api-options">
        {API_OPTIONS.map((api) => (
          <option key={api} value={api} />
        ))}
      </datalist>
      <label className="mt-2 flex flex-col gap-1 text-micro text-subtle">
        {t("API key (optional)")}
        <input
          type="password"
          value={input.apiKey}
          onChange={(e) =>
            patch({ apiKey: e.target.value, ...(e.target.value ? { clearKey: false } : {}) })
          }
          placeholder={storedKey ? t("Leave empty to keep the stored key") : t("API key")}
          className="h-8 rounded-md border border-control bg-canvas px-2 font-mono text-label outline-none placeholder:text-faint focus:border-brand"
          spellCheck={false}
        />
      </label>
      <div className="mt-1.5 flex flex-wrap items-center gap-3">
        {storedKey ? (
          <CheckboxField
            checked={input.clearKey}
            onCheckedChange={(checked) =>
              patch({ clearKey: checked, ...(checked ? { apiKey: "" } : {}) })
            }
            disabled={busy}
            className="flex items-center gap-1.5 text-micro text-subtle"
            ariaLabel={t("Remove stored key")}
          >
            {t("Remove stored key")}
          </CheckboxField>
        ) : null}
        <span className="text-micro text-faint">
          {t("Use $NAME for an environment variable. The key is written to pi's models.json.")}
        </span>
      </div>
      {storedKey && !input.apiKey && input.baseUrl.trim() !== originalBaseUrl.trim() ? (
        <p className="mt-1.5 rounded-md border border-warning/25 bg-warning/5 px-2 py-1.5 text-micro leading-4 text-warning">
          {t(
            "The stored API key will be sent to the new base URL. Re-enter the key if the host changed.",
          )}
        </p>
      ) : null}

      <div className="mt-3 border-t border-border pt-2.5">
        <SectionLabel>{t("Models")}</SectionLabel>
        <div className="mt-1.5 space-y-1.5">
          {input.models.map((model, index) => (
            <div
              key={index}
              className="space-y-1.5 rounded-md border border-border bg-surface px-2 py-1.5"
            >
              <div className="flex gap-1.5">
                <input
                  value={model.id}
                  onChange={(e) => patchModel(index, { id: e.target.value })}
                  placeholder={t("Model id")}
                  className="h-7 min-w-0 flex-1 rounded-md border border-control bg-canvas px-2 font-mono text-micro outline-none placeholder:text-faint focus:border-brand"
                  spellCheck={false}
                />
                <input
                  value={model.name ?? ""}
                  onChange={(e) => patchModel(index, { name: e.target.value })}
                  placeholder={t("Model name")}
                  className="h-7 min-w-0 flex-1 rounded-md border border-control bg-canvas px-2 text-micro outline-none placeholder:text-faint focus:border-brand"
                />
                <button
                  type="button"
                  onClick={() => patch({ models: input.models.filter((_, i) => i !== index) })}
                  className="flex size-7 shrink-0 items-center justify-center rounded-md text-faint hover:bg-danger/10 hover:text-danger"
                  aria-label={t("Remove model")}
                  title={t("Remove model")}
                >
                  <Trash2 size={11} />
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-micro text-subtle">
                <label className="flex items-center gap-1">
                  {t("Context")}
                  <input
                    type="number"
                    min={0}
                    value={model.contextWindow ?? ""}
                    onChange={(e) =>
                      patchModel(index, {
                        contextWindow: e.target.value ? Number(e.target.value) : 0,
                      })
                    }
                    placeholder="128000"
                    className="h-7 w-24 rounded-md border border-control bg-canvas px-1.5 text-micro outline-none focus:border-brand"
                  />
                </label>
                <label className="flex items-center gap-1">
                  {t("Max output")}
                  <input
                    type="number"
                    min={0}
                    value={model.maxTokens ?? ""}
                    onChange={(e) =>
                      patchModel(index, {
                        maxTokens: e.target.value ? Number(e.target.value) : 0,
                      })
                    }
                    placeholder="16384"
                    className="h-7 w-24 rounded-md border border-control bg-canvas px-1.5 text-micro outline-none focus:border-brand"
                  />
                </label>
                <CheckboxField
                  checked={model.reasoning}
                  onCheckedChange={(checked) => patchModel(index, { reasoning: checked })}
                  disabled={busy}
                  className="flex items-center gap-1"
                  ariaLabel={t("Reasoning")}
                >
                  {t("Reasoning")}
                </CheckboxField>
              </div>
            </div>
          ))}
        </div>
        <Button
          size="xs"
          variant="ghost"
          className="mt-1.5"
          onClick={() =>
            patch({ models: [...input.models, { id: "", name: "", reasoning: false }] })
          }
        >
          <Plus size={11} />
          {t("Add model")}
        </Button>
      </div>

      <div className="mt-3 flex justify-end gap-2">
        <Button size="sm" variant="outline" disabled={busy} onClick={onCancel}>
          {t("Cancel")}
        </Button>
        <Button size="sm" variant="primary" disabled={busy || !input.id.trim()} onClick={onSave}>
          {t("Save provider")}
        </Button>
      </div>
    </div>
  );
}

function ResourceList({
  items,
  busy,
  onRemove,
  empty,
}: {
  items: Resource[];
  busy: boolean;
  onRemove: (path: string, label: string) => void;
  empty: string;
}) {
  if (items.length === 0) {
    return <p className="text-label text-faint">{empty}</p>;
  }
  return (
    <ul className="space-y-1">
      {items.map((item) => (
        <li
          key={`${item.source}:${item.path}`}
          className="flex items-start gap-2 rounded-md bg-surface-2/40 px-2.5 py-1.5"
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-label font-medium">{item.name}</span>
              <SourceBadge source={item.source} />
              {item.project && item.source !== "project" ? <SourceBadge source="project" /> : null}
              {!item.active ? <InactiveBadge /> : null}
            </div>
            {item.description ? (
              <p className="mt-0.5 line-clamp-2 text-micro leading-4 text-subtle">
                {item.description}
              </p>
            ) : null}
            <p className="mt-0.5 truncate font-mono text-micro text-faint" title={item.path}>
              {item.path}
            </p>
          </div>
          <div className="flex shrink-0 gap-0.5">
            <button
              type="button"
              onClick={() => void api.reveal(item.path).catch(() => {})}
              className="flex size-6 items-center justify-center rounded-md text-faint hover:bg-surface-2 hover:text-fg"
              aria-label={t("Reveal {path}", { path: item.path })}
              title={t("Reveal")}
            >
              <FolderOpen size={11} />
            </button>
            {item.source === "configured" && !item.project ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => onRemove(item.ref ?? item.path, item.ref ?? item.path)}
                className="flex size-6 items-center justify-center rounded-md text-faint hover:bg-danger/10 hover:text-danger disabled:opacity-40"
                aria-label={t("Remove path")}
                title={t("Remove path")}
              >
                <Trash2 size={11} />
              </button>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

function SourceBadge({ source }: { source: string }) {
  return (
    <span className="rounded bg-surface-3 px-1 py-0.5 text-micro text-subtle">
      {t(source === "agents" ? "agents" : source)}
    </span>
  );
}

function InactiveBadge() {
  return (
    <span
      className="rounded bg-warning/10 px-1 py-0.5 text-micro text-warning"
      title={t("This resource does not load. Check its path, or trust the project.")}
    >
      {t("not loaded")}
    </span>
  );
}

function PathForm({
  value,
  onChange,
  placeholder,
  button,
  busy,
  onAdd,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  button: string;
  busy: boolean;
  onAdd: () => void;
}) {
  return (
    <div className="mt-1.5 flex gap-1.5">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onAdd();
        }}
        placeholder={placeholder}
        className="h-8 min-w-0 flex-1 rounded-md border border-control bg-canvas px-2.5 font-mono text-label outline-none placeholder:text-faint focus:border-brand"
        spellCheck={false}
      />
      <Button size="sm" disabled={busy || !value.trim()} onClick={onAdd}>
        <Plus size={11} />
        {button}
      </Button>
    </div>
  );
}
