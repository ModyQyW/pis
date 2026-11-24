/**
 * PiS's bridge into pi's RPC mode.
 *
 * Loaded with `-e` for every session. It only fills gaps in the RPC protocol:
 * session-tree navigation, plan mode, and optional smart approvals. It never
 * registers a generic tool or command name that can collide with a user
 * extension. All commands are namespaced `pis-*`.
 *
 * Env:
 *   PIS_GUARD      off | smart | ask | allow   (default off)
 *   PIS_WORKSPACE  absolute project directory
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { isAbsolute, relative, resolve } from "node:path";
import { homedir } from "node:os";

const POLICY = (process.env.PIS_GUARD || "off") as "off" | "smart" | "ask" | "allow";
const WORKSPACE = process.env.PIS_WORKSPACE || process.cwd();
const PLAN_STATUS = "pis:plan";
const GUARD_STATUS = "pis:guard";

const READ_ONLY_TOOLS = new Set([
  "read",
  "grep",
  "find",
  "ls",
  "todo",
  "ask_user_question",
  "bash",
  "powershell",
]);

const PLAN_INSTRUCTIONS = `Plan mode is active.

- Do not modify files, run mutating commands, or change repository state.
- Inspect the code with read/grep/find/ls and read-only shell commands.
- Produce a concrete implementation plan: files to change, the approach, risks, and verification steps.
- Stop after presenting the plan. The user will approve it before execution.`;

const DANGEROUS_BASH = [
  { re: /(^|\s)(sudo|doas|su)\b/, label: "privilege escalation" },
  { re: /\brm\s+(-[^\s]*\s+)*-[^\s]*[rf]/, label: "recursive file removal" },
  {
    re: /\bgit\s+(reset\s+--hard|clean\s+-[a-z]*f|checkout\s+--|restore\s+--|push\s+.*(--force|-f))/,
    label: "destructive git command",
  },
  { re: /\b(mkfs|shutdown|reboot|halt|poweroff)\b/, label: "system power or filesystem command" },
  { re: /\bdd\s+if=/, label: "raw disk write" },
  { re: /\bchmod\s+-R|\bchown\s+-R/, label: "recursive permission change" },
  { re: /\b(curl|wget)\b[^|]*\|\s*(sh|bash|zsh)\b/, label: "remote script execution" },
  {
    re: /\b(npm|pnpm|yarn|bun)\s+(publish|install|add|remove)\b/,
    label: "package installation or publish",
  },
  {
    re: /\b(pip|pip3)\s+install|\bbrew\s+install|\bcargo\s+install/,
    label: "package installation",
  },
  { re: /:\s*\(\s*\)\s*\{/, label: "shell fork bomb" },
];

const MUTATING_BASH = [
  ...DANGEROUS_BASH.map((rule) => rule.re),
  /(^|\s)(touch|mkdir|mv|cp|tee|truncate)\b/,
  /\bsed\s+-i\b/,
  /\bgit\s+(commit|merge|rebase|cherry-pick|apply|am|tag|checkout|switch)\b/,
  /(^|[^>])>{1,2}\s*[^&\s|]+/,
];

const SENSITIVE =
  /(^|\/)(\.env(\..*)?|id_rsa|id_ed25519|\.npmrc|\.pypirc|credentials|secrets|auth\.json|\.git\/config)$/i;

export default function (pi: ExtensionAPI) {
  let plan = false;
  let savedTools: string[] | null = null;
  const grants = new Set<string>();

  const grantKey = (toolName: string, input: Record<string, unknown>) => {
    const command = typeof input.command === "string" ? input.command : "";
    const path = typeof input.path === "string" ? input.path : "";
    return `${toolName}\u0000${command || path || JSON.stringify(input)}`;
  };

  const insideWorkspace = (p: string) => {
    const full = resolve(WORKSPACE, p.replace(/^~(?=$|\/)/, homedir()));
    const rel = relative(WORKSPACE, full);
    return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
  };

  const pathRisk = (p: string) => {
    if (!p) return null;
    const full = resolve(WORKSPACE, p.replace(/^~(?=$|\/)/, homedir()));
    if (!insideWorkspace(p)) return "path is outside the workspace";
    if (SENSITIVE.test(full)) return "path looks sensitive (credentials or secrets)";
    return null;
  };

  const bashRisk = (command: string) => {
    if (!command.trim()) return null;
    for (const rule of DANGEROUS_BASH) {
      if (rule.re.test(command)) return `destructive shell command: ${rule.label}`;
    }
    for (const token of command.match(/(?:^|\s)(~?\/[^\s;|&)]+)/g) ?? []) {
      const p = token.trim();
      if (p && !insideWorkspace(p)) return `command reaches outside the workspace: ${p}`;
    }
    return null;
  };

  const isMutatingBash = (command: string) => {
    if (!command.trim()) return false;
    return MUTATING_BASH.some((re) => re.test(command));
  };

  const setPlan = (on: boolean, ctx: any, notify = true) => {
    if (on === plan) {
      ctx.ui.setStatus(PLAN_STATUS, on ? "plan" : undefined);
      return;
    }
    if (on) {
      savedTools = pi.getActiveTools() ?? [];
      const next = savedTools.filter((name) => READ_ONLY_TOOLS.has(name));
      pi.setActiveTools(next);
      plan = true;
      ctx.ui.setStatus(PLAN_STATUS, "plan");
      if (notify) ctx.ui.notify("Plan mode on. Mutating tools are blocked.", "info");
    } else {
      if (savedTools) pi.setActiveTools(savedTools);
      savedTools = null;
      plan = false;
      ctx.ui.setStatus(PLAN_STATUS, undefined);
      if (notify) ctx.ui.notify("Plan mode off.", "info");
    }
    pi.appendEntry("pis-plan", { plan });
  };

  pi.registerCommand("pis-navigate", {
    description: "Internal: move within the session tree (used by PiS)",
    handler: async (args: string, ctx: any) => {
      const [targetId, mode] = args.trim().split(/\s+/);
      if (!targetId) {
        ctx.ui.notify("pis-navigate: missing entry id", "error");
        return;
      }
      await ctx.waitForIdle?.();
      const result = await ctx.navigateTree(targetId, { summarize: mode === "summarize" });
      if (result?.cancelled) ctx.ui.notify("Tree navigation was cancelled", "warning");
    },
  });

  pi.registerCommand("pis-plan", {
    description: "Turn read-only plan mode on or off (used by PiS)",
    handler: async (args: string, ctx: any) => {
      const next = args.trim().toLowerCase();
      await ctx.waitForIdle?.();
      if (next === "on") setPlan(true, ctx);
      else if (next === "off") setPlan(false, ctx);
      else ctx.ui.notify("Usage: /pis-plan on|off", "error");
    },
  });

  pi.on("session_start", (_event: any, ctx: any) => {
    ctx.ui.setStatus(GUARD_STATUS, POLICY === "off" ? undefined : POLICY);
    const entries = ctx.sessionManager?.getBranch?.() ?? [];
    const last = [...entries]
      .reverse()
      .find((entry: any) => entry?.type === "custom" && entry?.customType === "pis-plan");
    if (last?.data?.plan) setPlan(true, ctx, false);
  });

  pi.on("before_agent_start", (event: any) => {
    if (!plan) return;
    const options = event.systemPromptOptions;
    if (options?.sections && typeof options.sections === "object") {
      options.sections = { ...options.sections, "pis-plan": PLAN_INSTRUCTIONS };
      return;
    }
    return {
      systemPrompt: `${event.systemPrompt}\n\n<pis-plan>\n${PLAN_INSTRUCTIONS}\n</pis-plan>`,
    };
  });

  pi.on("tool_call", async (event: any, ctx: any) => {
    const name = String(event.toolName ?? "");
    const input = (event.input ?? {}) as Record<string, unknown>;
    if (name === "bash" || name === "powershell") {
      const command = typeof input.command === "string" ? input.command : "";
      if (plan && isMutatingBash(command)) {
        return {
          block: true,
          reason:
            "Plan mode: mutating shell commands are blocked. Present a plan or turn plan mode off.",
        };
      }
    } else if (plan && (name === "edit" || name === "write" || name === "multi_edit")) {
      return {
        block: true,
        reason: "Plan mode: file edits are blocked. Present a plan or turn plan mode off.",
      };
    }

    if (POLICY === "off" || POLICY === "allow") return;
    const key = grantKey(name, input);
    if (grants.has(key)) return;

    let reason: string | null = null;
    if (POLICY === "ask") {
      reason = "approval policy asks for every tool call";
    } else {
      if (name === "bash" || name === "powershell") {
        reason = bashRisk(typeof input.command === "string" ? input.command : "");
      } else if (name === "edit" || name === "write" || name === "multi_edit") {
        reason = pathRisk(typeof input.path === "string" ? input.path : "");
      } else if (!["read", "grep", "find", "ls", "todo", "ask_user_question"].includes(name)) {
        if (/delete|remove|write|edit|exec|deploy|publish|shell|bash/i.test(name)) {
          reason = "tool may modify the environment";
        }
      }
    }
    if (!reason) return;

    if (!ctx.hasUI) {
      return { block: true, reason: `Approval required (${reason}), but no UI is available.` };
    }
    const command = typeof input.command === "string" ? input.command : "";
    const path = typeof input.path === "string" ? input.path : "";
    const detail = [command && `$ ${command}`, path && `path: ${path}`, `risk: ${reason}`]
      .filter(Boolean)
      .join("\n");
    const title = [`Allow ${name}?`, detail].filter(Boolean).join("\n\n");
    const choice = await ctx.ui.select(title, ["Allow once", "Allow for this session", "Deny"]);
    if (choice === "Allow once") return;
    if (choice === "Allow for this session") {
      grants.add(key);
      return;
    }
    return { block: true, reason: "Denied by the user." };
  });
}
