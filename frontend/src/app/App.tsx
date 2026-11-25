import {
  AlertCircle,
  Copy,
  FolderOpen,
  FolderGit2,
  GitBranch,
  HelpCircle,
  LogIn,
  Minimize2,
  PanelLeft,
  PanelRight,
  Pencil,
  Plus,
  RefreshCw,
  Server,
  Settings2,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Toaster, toast } from "../lib/toast";

import { BrandMark } from "../components/BrandMark";
import { CommandPalette, type PaletteAction } from "../components/CommandPalette";
import { Composer } from "../components/Composer";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { DialogDock } from "../components/DialogDock";
import { EmptyState } from "../components/EmptyState";
import { ExtensionStatusRail } from "../components/ExtensionStatusRail";
import { MCPDialog } from "../components/MCPDialog";
import { ModelPickerDialog } from "../components/ModelPickerDialog";
import { RenameDialog } from "../components/RenameDialog";
import { RightPanel } from "../components/RightPanel";
import { SessionActions } from "../components/SessionActions";
import { SessionTranscript } from "../components/SessionTranscript";
import { SessionTreeDialog } from "../components/SessionTreeDialog";
import { SettingsDialog } from "../components/SettingsDialog";
import { TrustDialog } from "../components/TrustDialog";
import { WorktreeDialog } from "../components/WorktreeDialog";
import { Sidebar } from "../components/Sidebar";
import { TopBar } from "../components/TopBar";
import { api, insideShell } from "../lib/api";
import { setLocale, t } from "../lib/i18n";
import { buildTranscript } from "../lib/transcript";
import type { Info as TrustInfo, Summary } from "../mygo";
import { useChat } from "../store/chat";
import type { Bootstrap, MenuCommand, Theme, Workspace } from "../lib/types";

const LoginDialog = lazy(() =>
  import("../components/LoginDialog").then((m) => ({ default: m.LoginDialog })),
);

export function App() {
  const [boot, setBoot] = useState<Bootstrap | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [selected, setSelected] = useState<Workspace | null>(null);
  const [recentSessions, setRecentSessions] = useState<Summary[]>([]);
  const [draft, setDraft] = useState("");
  const [theme, setTheme] = useState<Theme>("system");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mcpOpen, setMCPOpen] = useState(false);
  const [worktreeOpen, setWorktreeOpen] = useState(false);
  const [treeOpen, setTreeOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [trustOpen, setTrustOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [trustInfo, setTrustInfo] = useState<TrustInfo | null>(null);
  const trustResolver = useRef<((choice: { decided: boolean; trusted: boolean }) => void) | null>(
    null,
  );

  const sessions = useChat((s) => s.sessions);
  const activeKey = useChat((s) => s.activeKey);
  const active = activeKey ? (sessions[activeKey] ?? null) : null;
  const displayWorkspace = useMemo(() => {
    if (!active?.cwd) return selected;
    return (
      boot?.recents.find((r) => r.path === active.cwd) ??
      (selected?.path === active.cwd
        ? selected
        : {
            path: active.cwd,
            name: active.cwd.split("/").pop() ?? active.cwd,
            lastOpened: new Date().toISOString(),
          })
    );
  }, [active?.cwd, boot?.recents, selected]);
  const openSessions = useMemo(() => Object.values(sessions), [sessions]);
  const items = useMemo(
    () => (active ? buildTranscript(active.entries, active.live, active.runs) : []),
    [active],
  );

  const load = useCallback(async () => {
    try {
      const next = await api.bootstrap();
      setBoot(next);
      setTheme(next.settings.theme);
      setSelected((current) => {
        if (current) {
          return next.recents.find((r) => r.path === current.path) ?? current;
        }
        return (
          next.recents.find((r) => r.path === next.settings.lastWorkspace) ??
          next.recents[0] ??
          null
        );
      });
      setFatal(null);
    } catch (err) {
      setFatal(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (boot) setLocale(boot.settings.language);
  }, [boot?.settings.language, boot]);

  useLayoutEffect(() => {
    if (!boot) return;
    const root = document.documentElement;
    root.style.setProperty("--code-font-size", `${boot.settings.codeFontSize}px`);
    root.style.setProperty("--ui-scale", String(boot.settings.uiFontSize / 14));
  }, [boot]);

  // Development-only deep link: `mygo dev` can open a real session for QA.
  useEffect(() => {
    if (!boot || !insideShell) return;
    const params = new URLSearchParams(window.location.search);
    const path = params.get("session");
    const prompt = params.get("prompt");
    if (!path && !prompt) return;
    history.replaceState(null, "", window.location.pathname);
    if (!path) return;
    void (async () => {
      const summary = await api.summarySession(path);
      if (!summary.path) return;
      setSelected(
        boot.recents.find((r) => r.path === summary.cwd) ?? {
          path: summary.cwd,
          name: summary.cwd.split("/").pop() ?? summary.cwd,
          lastOpened: new Date().toISOString(),
        },
      );
      await useChat.getState().openSummary({
        path: summary.path,
        title: summary.title,
        cwd: summary.cwd,
        trusted: false,
      });
      if (prompt) {
        const key = useChat.getState().activeKey;
        if (key) await useChat.getState().send(key, prompt);
      }
    })().catch((err) => toast.error(err instanceof Error ? err.message : String(err)));
  }, [boot]);

  useEffect(() => {
    return api.onAgentEvent((ev) => useChat.getState().applyEvent(ev));
  }, []);

  const busySessions = useRef<Record<string, boolean>>({});
  useEffect(() => {
    const enabled = Boolean(boot?.settings.notifications);
    const next: Record<string, boolean> = {};
    for (const session of Object.values(sessions)) {
      const busy = session.streaming || session.status === "loading";
      next[session.key] = busy;
      const wasBusy = busySessions.current[session.key];
      if (enabled && wasBusy && !busy && session.status === "ready" && !document.hasFocus()) {
        void api
          .notify(
            session.key,
            session.name || "PiS",
            session.error ? t("Run failed") : t("Run finished"),
          )
          .catch(() => {});
      }
    }
    busySessions.current = next;
  }, [sessions, boot?.settings.notifications]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href) return;
      if (/^(https?:|mailto:)/i.test(href)) {
        event.preventDefault();
        void api.openExternal(href);
      } else if (!anchor.hasAttribute("download") && !href.startsWith("#")) {
        // Relative, data:, javascript: and other scheme links must not replace
        // the app page. Downloads and in-page fragments are allowed.
        event.preventDefault();
      }
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  useEffect(() => {
    if (!boot) return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && media.matches);
      document.documentElement.classList.toggle("dark", dark);
      document.documentElement.style.colorScheme =
        theme === "light" ? "light" : theme === "dark" ? "dark" : "light dark";
    };
    apply();
    if (theme !== "system") return;
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme, boot]);

  const refreshSessions = useCallback(async () => {
    if (!selected) {
      setRecentSessions([]);
      return;
    }
    try {
      const list = await api.listSessions(selected.path, 80);
      setRecentSessions(list);
    } catch {
      setRecentSessions([]);
    }
  }, [selected]);

  useEffect(() => {
    void refreshSessions();
  }, [refreshSessions]);

  const ensureTrust = useCallback(async (ws: Workspace | null) => {
    if (!ws) return { decided: true, trusted: false };
    try {
      const info = await api.workspaceTrust(ws.path);
      if (!info.requiresTrust) return { decided: true, trusted: true };
      if (info.decision === "trusted") return { decided: true, trusted: true };
      if (info.decision === "untrusted") return { decided: true, trusted: false };
      return await new Promise<{ decided: boolean; trusted: boolean }>((resolve) => {
        trustResolver.current = resolve;
        setTrustInfo(info);
        setTrustOpen(true);
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
      return { decided: false, trusted: false };
    }
  }, []);

  const restoredLast = useRef(false);
  useEffect(() => {
    if (!boot || !insideShell || restoredLast.current) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("session")) return;
    restoredLast.current = true;
    let last = "";
    try {
      last = localStorage.getItem("pis:last-session") ?? "";
    } catch {
      return;
    }
    if (!last) return;
    void (async () => {
      try {
        const summary = await api.summarySession(last);
        if (!summary.path) return;
        const ws: Workspace = boot.recents.find((r) => r.path === summary.cwd) ?? {
          path: summary.cwd,
          name: summary.cwd.split("/").pop() ?? summary.cwd,
          lastOpened: new Date().toISOString(),
        };
        setSelected(ws);
        const choice = await ensureTrust(ws);
        if (!choice.decided) return;
        await useChat.getState().openSummary({
          path: summary.path,
          title: summary.title,
          cwd: summary.cwd,
          trusted: choice.trusted,
        });
        void refreshSessions();
      } catch {
        try {
          localStorage.removeItem("pis:last-session");
        } catch {
          // ignore
        }
      }
    })();
  }, [boot, ensureTrust, refreshSessions]);

  const settleTrust = useCallback((choice: { decided: boolean; trusted: boolean }) => {
    const resolve = trustResolver.current;
    trustResolver.current = null;
    setTrustOpen(false);
    setTrustInfo(null);
    resolve?.(choice);
  }, []);

  const chooseTrust = useCallback(
    async (trustedChoice: boolean) => {
      const info = trustInfo;
      if (info) {
        try {
          await api.setTrust(info.path, trustedChoice ? "trusted" : "untrusted");
          toast.success(
            trustedChoice ? t("Project trusted for new sessions") : t("Project set to untrusted"),
          );
        } catch (err) {
          toast.error(err instanceof Error ? err.message : String(err));
        }
      }
      settleTrust({ decided: true, trusted: trustedChoice });
    },
    [settleTrust, trustInfo],
  );

  const handleNewChat = useCallback(async () => {
    if (!boot?.pi.compatible) {
      toast.error(t("pi is not ready"), {
        description: boot?.pi.error ?? t("Open Settings to locate a supported pi."),
      });
      return;
    }
    if (!selected) {
      await handleOpenProject();
      return;
    }
    const choice = await ensureTrust(selected);
    if (!choice.decided) return;
    setDraft("");
    await useChat.getState().startNew({ cwd: selected.path, trusted: choice.trusted });
    void refreshSessions();
  }, [boot, selected, ensureTrust, refreshSessions]);

  const handleOpenProject = useCallback(async () => {
    try {
      const ws = await api.chooseProject();
      if (!ws) return;
      toast.success(t("Opened {name}", { name: ws.name }));
      await load();
      setSelected(ws);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }, [load]);

  const handleOpenPath = useCallback(
    async (path: string) => {
      try {
        const ws = await api.openProject(path);
        toast.success(t("Opened {name}", { name: ws.name }));
        await load();
        setSelected(ws);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : String(err));
      }
    },
    [load],
  );

  const handleOpenSummary = useCallback(
    async (summary: Summary) => {
      if (!selected) return;
      const choice = await ensureTrust(selected);
      if (!choice.decided) return;
      await useChat.getState().openSummary({
        path: summary.path,
        title: summary.title,
        cwd: selected.path,
        trusted: choice.trusted,
      });
      void refreshSessions();
    },
    [selected, ensureTrust, refreshSessions],
  );

  const submit = useCallback(async () => {
    const text = active ? active.draft : draft;
    if (!text.trim() && !active?.attachments.length) return;
    if (!boot?.pi.compatible) {
      toast.error(t("pi is not ready"), {
        description: boot?.pi.error ?? t("Open Settings to locate a supported pi."),
      });
      return;
    }
    if (!selected) {
      toast.error(t("Open a project first"));
      return;
    }
    let key = useChat.getState().activeKey;
    if (!key) {
      const choice = await ensureTrust(selected);
      if (!choice.decided) return;
      await useChat.getState().startNew({ cwd: selected.path, trusted: choice.trusted });
      key = useChat.getState().activeKey;
    }
    if (!key) return;
    setDraft("");
    await useChat.getState().send(key, text);
    void refreshSessions();
  }, [active, boot, draft, selected, ensureTrust, refreshSessions]);

  const stop = useCallback(() => {
    const key = useChat.getState().activeKey;
    if (key) void useChat.getState().stop(key);
  }, []);

  const handleCompact = useCallback(async () => {
    const id = useChat.getState().activeSession()?.appId;
    if (!id) {
      toast(t("No live session to compact"));
      return;
    }
    try {
      await api.compactSession(id);
      toast.success(t("Context compacted"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("Compaction failed"));
    }
  }, []);

  const handleClone = useCallback(async () => {
    const key = useChat.getState().activeKey;
    if (!key) return;
    try {
      await useChat.getState().clone(key);
      toast.success(t("Branch cloned"));
      void refreshSessions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }, [refreshSessions]);

  const handleNavigate = useCallback(async (entryId: string, summarize: boolean) => {
    const key = useChat.getState().activeKey;
    if (!key) return;
    try {
      await useChat.getState().navigateTree(key, entryId, summarize);
      toast.success(t("Moved to that point in the session"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
      throw err;
    }
  }, []);

  const handleFork = useCallback(
    async (entryId: string) => {
      const key = useChat.getState().activeKey;
      if (!key) return;
      try {
        await useChat.getState().fork(key, entryId);
        toast.success(t("Forked into a new session"));
        void refreshSessions();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : String(err));
      }
    },
    [refreshSessions],
  );

  const handleRename = useCallback(
    async (name: string) => {
      const key = useChat.getState().activeKey;
      if (!key) return;
      try {
        await useChat.getState().rename(key, name);
        toast.success(t("Session renamed"));
        void refreshSessions();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : String(err));
      }
    },
    [refreshSessions],
  );

  const handleExport = useCallback(async () => {
    const s = useChat.getState().activeSession();
    if (!s?.path) {
      toast(t("Open a session before exporting"));
      return;
    }
    try {
      const path = await api.exportSession(s.path);
      toast.success(t("Session exported"), { description: path });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const handleReveal = useCallback(async () => {
    const s = useChat.getState().activeSession();
    if (!s?.path) return;
    try {
      await api.revealSession(s.path);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const runMenu = useCallback(
    (command: MenuCommand["command"]) => {
      switch (command) {
        case "newChat":
          void handleNewChat();
          break;
        case "openProject":
          void handleOpenProject();
          break;
        case "settings":
          setSettingsOpen(true);
          break;
        case "commandPalette":
          setPaletteOpen(true);
          break;
        case "toggleSidebar":
          setSidebarOpen((v) => !v);
          break;
        case "toggleChanges":
          setRightOpen((v) => !v);
          break;
        case "stop":
          stop();
          break;
        case "closeSession":
          if (activeKey) void useChat.getState().close(activeKey);
          break;
        case "compact":
          void handleCompact();
          break;
        case "sessionTree":
          setTreeOpen(true);
          break;
        case "renameSession":
          setRenameOpen(true);
          break;
        case "exportHtml":
          void handleExport();
          break;
        case "revealSession":
          void handleReveal();
          break;
        case "modelPicker":
          setModelPickerOpen(true);
          break;
        default:
          toast(t("Unhandled menu command: {command}", { command }));
      }
    },
    [activeKey, handleCompact, handleExport, handleNewChat, handleOpenProject, handleReveal, stop],
  );

  useEffect(() => {
    const offMenu = api.onMenuCommand((p) => runMenu(p.command));
    const offPi = api.onPiStatus((pi) => setBoot((b) => (b ? { ...b, pi } : b)));
    return () => {
      offMenu();
      offPi();
    };
  }, [runMenu]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (e.defaultPrevented) return;
        if (
          document.querySelector(
            '[data-slot="dialog-popup"], [role="dialog"][aria-modal="true"], [role="menu"]',
          )
        )
          return;
        const session = useChat.getState().activeSession();
        if (!session?.dialogs.length && session?.streaming) {
          e.preventDefault();
          stop();
        }
        return;
      }
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      if (key === "k") {
        e.preventDefault();
        setPaletteOpen(true);
      } else if (key === "b") {
        e.preventDefault();
        setSidebarOpen((v) => !v);
      } else if (key === "g" && e.shiftKey) {
        e.preventDefault();
        setRightOpen((v) => !v);
      } else if (key === "t" && e.shiftKey) {
        e.preventDefault();
        setTreeOpen(true);
      } else if (key === "c" && e.shiftKey) {
        e.preventDefault();
        void handleCompact();
      } else if (key === "m" && e.shiftKey) {
        e.preventDefault();
        setModelPickerOpen(true);
      } else if (e.key === ",") {
        e.preventDefault();
        setSettingsOpen(true);
      } else if (key === "n") {
        e.preventDefault();
        void handleNewChat();
      } else if (key === "o") {
        e.preventDefault();
        void handleOpenProject();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleNewChat, handleOpenProject, handleCompact, stop]);

  const chooseTheme = useCallback(async (next: Theme) => {
    setTheme(next);
    try {
      await api.setTheme(next);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const actions = useMemo<PaletteAction[]>(() => {
    if (!boot) return [];
    return [
      {
        id: "new",
        label: "New chat",
        group: "Session",
        icon: Plus,
        shortcut: "⌘N",
        run: () => void handleNewChat(),
      },
      {
        id: "open",
        label: "Open project…",
        group: "Workspace",
        icon: FolderOpen,
        shortcut: "⌘O",
        run: () => void handleOpenProject(),
      },
      {
        id: "worktrees",
        label: "Manage worktrees…",
        group: "Workspace",
        icon: FolderGit2,
        run: () => setWorktreeOpen(true),
      },
      {
        id: "tree",
        label: "Session tree…",
        group: "Session",
        icon: GitBranch,
        shortcut: "⌘⇧T",
        run: () => setTreeOpen(true),
      },
      {
        id: "clone",
        label: "Clone branch",
        group: "Session",
        icon: Copy,
        run: () => void handleClone(),
      },
      {
        id: "compact",
        label: "Compact context",
        group: "Session",
        icon: Minimize2,
        shortcut: "⌘⇧C",
        run: () => void handleCompact(),
      },
      {
        id: "rename",
        label: "Rename session…",
        group: "Session",
        icon: Pencil,
        run: () => setRenameOpen(true),
      },
      {
        id: "login",
        label: "Connect a provider…",
        group: "Providers",
        icon: LogIn,
        run: () => setLoginOpen(true),
      },
      {
        id: "mcp",
        label: "Manage MCP servers…",
        group: "Providers",
        icon: Server,
        run: () => setMCPOpen(true),
      },
      {
        id: "model",
        label: "Model & thinking…",
        group: "Preferences",
        icon: Sparkles,
        shortcut: "⌘⇧M",
        run: () => setModelPickerOpen(true),
      },
      {
        id: "settings",
        label: "Open settings",
        group: "Preferences",
        icon: Settings2,
        shortcut: "⌘,",
        run: () => setSettingsOpen(true),
      },
      {
        id: "sidebar",
        label: "Toggle sidebar",
        group: "View",
        icon: PanelLeft,
        shortcut: "⌘B",
        run: () => setSidebarOpen((v) => !v),
      },
      {
        id: "changes",
        label: "Toggle changes panel",
        group: "View",
        icon: PanelRight,
        shortcut: "⌘⇧G",
        run: () => setRightOpen((v) => !v),
      },
      {
        id: "pi",
        label: "Check pi installation",
        group: "Help",
        icon: RefreshCw,
        run: async () => {
          const st = await api.checkPi();
          toast(
            st.compatible
              ? t("pi {version} is ready", { version: st.version ?? "" })
              : (st.error ?? t("pi was not found")),
          );
          await load();
        },
      },
      {
        id: "pi-docs",
        label: "Open pi documentation",
        group: "Help",
        icon: HelpCircle,
        run: () => void api.openExternal("https://pi.dev/docs/latest"),
      },
      ...(!insideShell
        ? [
            {
              id: "preview-trust",
              label: "Preview trust dialog",
              group: "Preview",
              icon: Settings2,
              run: () => {
                setTrustInfo({
                  path: "/Users/you/Projects/atlas",
                  requiresTrust: true,
                  resources: [".pi/settings.json", ".pi/extensions/local-tools.ts", ".pi/skills"],
                  decision: "undecided",
                  source: "none",
                  effective: false,
                });
                setTrustOpen(true);
              },
            },
            {
              id: "preview-approval",
              label: "Preview approval dock",
              group: "Preview",
              icon: ShieldAlert,
              run: () => {
                const state = useChat.getState();
                const active = state.activeKey ? state.sessions[state.activeKey] : undefined;
                if (!active?.appId) {
                  toast("Open a chat before previewing an approval.");
                  return;
                }
                void api.previewApproval(active.appId);
              },
            },
          ]
        : []),
    ];
  }, [boot, load, handleClone, handleCompact, handleNewChat, handleOpenProject]);

  if (fatal) {
    return (
      <div className="flex h-full items-center justify-center bg-canvas p-8">
        <div className="w-full max-w-[440px] rounded-xl border border-border bg-surface p-6">
          <BrandMark size={34} />
          <h1 className="mt-4 text-[16px] font-semibold">{t("PiS could not start")}</h1>
          <p className="mt-2 text-[12px] leading-5 text-subtle">{fatal}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-5 h-8 rounded-md border border-border px-3 text-[12px] hover:bg-surface-2"
          >
            {t("Try again")}
          </button>
        </div>
      </div>
    );
  }

  if (!boot) {
    return (
      <div className="flex h-full items-center justify-center bg-canvas">
        <div className="flex items-center gap-3 text-[12px] text-subtle">
          <BrandMark size={30} />
          <span className="pulse-soft">{t("Starting PiS…")}</span>
        </div>
      </div>
    );
  }

  const state = active?.dialogs.length
    ? "needs-input"
    : active?.status === "error" || active?.status === "exited"
      ? "error"
      : active?.streaming
        ? "working"
        : active?.status === "loading"
          ? "working"
          : boot.pi.found && !boot.pi.compatible
            ? "error"
            : "idle";
  const running = Boolean(active?.streaming);
  const composerDraft = active ? active.draft : draft;
  const setComposerDraft = (text: string) => {
    if (activeKey) useChat.getState().setDraft(activeKey, text);
    else setDraft(text);
  };

  return (
    <div className="flex h-full bg-canvas text-fg">
      {sidebarOpen ? (
        <Sidebar
          boot={boot}
          selected={displayWorkspace}
          onSelect={(ws) => {
            setSelected(ws);
            const open = Object.values(useChat.getState().sessions).find((s) => s.cwd === ws.path);
            useChat.getState().setActive(open?.key ?? null);
          }}
          onNewChat={() => void handleNewChat()}
          onOpenProject={() => void handleOpenProject()}
          onSettings={() => setSettingsOpen(true)}
          recentSessions={recentSessions}
          openSessions={openSessions}
          activeKey={activeKey}
          onOpenSummary={(summary) => void handleOpenSummary(summary)}
          onSelectOpen={(key) => {
            const s = useChat.getState().sessions[key];
            if (s) {
              setSelected(
                boot.recents.find((r) => r.path === s.cwd) ?? {
                  path: s.cwd,
                  name: s.cwd.split("/").pop() ?? s.cwd,
                  lastOpened: new Date().toISOString(),
                },
              );
            }
            useChat.getState().setActive(key);
          }}
        />
      ) : null}

      <main className="flex min-w-0 flex-1 flex-col">
        <TopBar
          workspace={displayWorkspace}
          title={active?.name || t("New chat")}
          state={state}
          rightOpen={rightOpen}
          sidebarOpen={sidebarOpen}
          preview={!insideShell}
          sessionActions={
            active ? (
              <SessionActions
                onRename={() => setRenameOpen(true)}
                onClone={() => void handleClone()}
                onTree={() => setTreeOpen(true)}
                onCompact={() => void handleCompact()}
                onExport={() => void handleExport()}
                onReveal={() => void handleReveal()}
                onClose={() => void useChat.getState().close(active.key)}
                onDelete={() => setDeleteOpen(true)}
              />
            ) : undefined
          }
          onPalette={() => setPaletteOpen(true)}
          onToggleRight={() => setRightOpen((v) => !v)}
        />
        <div className="flex min-h-0 flex-1">
          <section className="flex min-w-0 flex-1 flex-col">
            {!boot.pi.checking && !boot.pi.compatible ? (
              <div className="flex items-start gap-2 border-b border-warning/25 bg-warning/5 px-4 py-2.5 text-[11px] leading-5 text-warning">
                <AlertCircle size={13} className="mt-0.5 shrink-0" />
                <span className="min-w-0 flex-1">
                  {boot.pi.found
                    ? boot.pi.error || `pi ${boot.pi.version} is outside the supported range.`
                    : "pi was not found. PiS runs the pi you install; it does not bundle it."}
                </span>
                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  className="shrink-0 rounded border border-warning/30 px-2 py-0.5 text-[10px] hover:bg-warning/10"
                >
                  {t("Locate pi")}
                </button>
                <button
                  type="button"
                  onClick={() => void api.openExternal("https://pi.dev/docs/latest/quickstart")}
                  className="shrink-0 rounded border border-warning/30 px-2 py-0.5 text-[10px] hover:bg-warning/10"
                >
                  {t("Install guide")}
                </button>
              </div>
            ) : null}
            {active?.error ? (
              <div className="flex items-start gap-2 border-b border-danger/20 bg-danger/5 px-4 py-2 text-[11px] leading-4 text-danger">
                <AlertCircle size={13} className="mt-0.5 shrink-0" />
                <span className="min-w-0 flex-1 whitespace-pre-wrap">{active.error}</span>
                <button
                  type="button"
                  onClick={() => useChat.getState().close(active.key)}
                  className="shrink-0 rounded border border-danger/30 px-1.5 py-0.5 text-[10px] hover:bg-danger/10"
                >
                  {t("Close")}
                </button>
              </div>
            ) : null}
            <div className="min-h-0 flex-1 overflow-hidden">
              {active && active.status === "ready" && active.models.length === 0 ? (
                <div className="flex items-center gap-2 border-b border-brand/20 bg-brand-soft/40 px-4 py-2 text-[11px] text-subtle">
                  <span className="min-w-0 flex-1">
                    {t("No models are available. Connect a provider in pi to start.")}
                  </span>
                  <button
                    type="button"
                    onClick={() => setLoginOpen(true)}
                    className="shrink-0 rounded-md border border-brand/30 bg-surface px-2 py-1 text-[10.5px] text-brand hover:bg-surface-2"
                  >
                    {t("Connect")}
                  </button>
                </div>
              ) : null}
              {active &&
              (items.length > 0 ||
                active.streaming ||
                active.status === "loading" ||
                active.error) ? (
                <SessionTranscript
                  session={active}
                  items={items}
                  onFork={(entryId) => void handleFork(entryId)}
                />
              ) : (
                <div className="h-full overflow-y-auto scroll-thin">
                  <EmptyState
                    workspace={selected}
                    onStarter={(prompt) => setComposerDraft(prompt)}
                  />
                </div>
              )}
            </div>
            {active ? (
              <ExtensionStatusRail
                statuses={active.statuses}
                widgets={active.widgets}
                showWidgets={boot.settings.showWidgets}
              />
            ) : null}
            {active && active.dialogs[0] ? (
              <DialogDock
                key={active.dialogs[0].id}
                dialog={active.dialogs[0]}
                pending={active.dialogs.length}
                onRespond={(response) =>
                  void useChat.getState().respondDialog(active.key, active.dialogs[0]!.id, response)
                }
                onTimeout={() =>
                  useChat.getState().dismissDialog(active.key, active.dialogs[0]!.id)
                }
              />
            ) : null}
            <Composer
              draft={composerDraft}
              onDraft={setComposerDraft}
              onSubmit={() => void submit()}
              running={running}
              onStop={stop}
              disabled={!boot.pi.compatible || active?.status === "loading"}
              modelLabel={active?.model?.name ?? t("Choose model")}
              thinking={active?.thinking}
              contextPercent={active?.stats?.contextUsage?.percent ?? null}
              onOpenModelPicker={() => setModelPickerOpen(true)}
              workspace={selected?.path}
              commands={active?.commands}
              attachments={active?.attachments}
              onAddAttachment={(a) => {
                const key = useChat.getState().activeKey;
                if (key) useChat.getState().addAttachment(key, a);
              }}
              onRemoveAttachment={(id) => {
                const key = useChat.getState().activeKey;
                if (key) useChat.getState().removeAttachment(key, id);
              }}
              planMode={active?.statuses["pis:plan"] === "plan"}
              externalPlanCommand={
                active?.commands.find((c) => /^plan(-mode)?$/i.test(c.name))?.name
              }
              sendOnEnter={boot.settings.sendOnEnter}
              onTogglePlan={() => {
                const key = useChat.getState().activeKey;
                if (key)
                  void useChat
                    .getState()
                    .togglePlan(key)
                    .catch((err) => toast.error(err instanceof Error ? err.message : String(err)));
              }}
            />
          </section>
          {rightOpen ? (
            <RightPanel
              workspace={displayWorkspace}
              session={active}
              onClose={() => setRightOpen(false)}
            />
          ) : null}
        </div>
      </main>

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        actions={actions}
        workspace={displayWorkspace?.path}
        onOpenSession={(summary) => void handleOpenSummary(summary)}
      />
      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        boot={boot}
        theme={theme}
        onTheme={(t) => void chooseTheme(t)}
        onReload={() => void load()}
        onMCP={() => {
          setSettingsOpen(false);
          setMCPOpen(true);
        }}
        onLogin={() => {
          setSettingsOpen(false);
          setLoginOpen(true);
        }}
      />
      <MCPDialog open={mcpOpen} onOpenChange={setMCPOpen} workspace={displayWorkspace?.path} />
      <WorktreeDialog
        open={worktreeOpen}
        onOpenChange={setWorktreeOpen}
        workspace={displayWorkspace?.path}
        onOpen={(path) => {
          setWorktreeOpen(false);
          void handleOpenPath(path);
        }}
      />
      <Suspense fallback={null}>
        <LoginDialog
          open={loginOpen}
          onOpenChange={setLoginOpen}
          codeFontSize={boot.settings.codeFontSize}
          onDone={() => {
            void load();
            const key = useChat.getState().activeKey;
            if (key)
              void useChat
                .getState()
                .refreshModels(key)
                .catch(() => {});
          }}
        />
      </Suspense>
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t("Delete this session?")}
        message={
          active?.path
            ? t("The session file moves to the Trash. Your project files are untouched.")
            : t("There is no live session to delete.")
        }
        confirmLabel={t("Move to Trash")}
        danger
        onConfirm={async () => {
          const s = active;
          if (!s?.path) {
            setDeleteOpen(false);
            return;
          }
          try {
            await useChat.getState().close(s.key);
            await api.deleteSession(s.path);
            toast.success(t("Session moved to Trash"));
            setDeleteOpen(false);
            void refreshSessions();
          } catch (err) {
            toast.error(err instanceof Error ? err.message : String(err));
          }
        }}
      />
      <SessionTreeDialog
        open={treeOpen}
        onOpenChange={setTreeOpen}
        sessionId={active?.appId}
        onNavigate={handleNavigate}
        onClone={handleClone}
      />
      <TrustDialog
        info={trustInfo}
        open={trustOpen}
        onOpenChange={(open) => {
          if (!open) settleTrust({ decided: false, trusted: false });
        }}
        onChoose={(trusted) => void chooseTrust(trusted)}
      />
      <ModelPickerDialog
        open={modelPickerOpen}
        onOpenChange={setModelPickerOpen}
        session={active}
        onChooseModel={async (model) => {
          const key = useChat.getState().activeKey;
          if (key) await useChat.getState().chooseModel(key, model);
        }}
        onChooseThinking={async (level) => {
          const key = useChat.getState().activeKey;
          if (key) await useChat.getState().chooseThinking(key, level);
        }}
        onToggleAutoCompaction={async (enabled) => {
          const key = useChat.getState().activeKey;
          if (key) await useChat.getState().setAutoCompaction(key, enabled);
        }}
        onRefresh={async () => {
          const key = useChat.getState().activeKey;
          if (key) await useChat.getState().refreshModels(key);
        }}
      />
      <RenameDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        initial={active?.name ?? ""}
        onSave={handleRename}
      />
      <Toaster />
    </div>
  );
}
