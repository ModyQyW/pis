import { cn } from "../lib/cn";

type Line = { kind: "add" | "del" | "ctx" | "hunk" | "meta"; text: string };

function parse(diff: string): Line[] {
  return diff.split("\n").map((text) => {
    if (text.startsWith("@@")) return { kind: "hunk", text };
    if (text.startsWith("+++") || text.startsWith("---") || text.startsWith("diff "))
      return { kind: "meta", text };
    if (text.startsWith("+")) return { kind: "add", text: text.slice(1) };
    if (text.startsWith("-")) return { kind: "del", text: text.slice(1) };
    return { kind: "ctx", text: text.startsWith(" ") ? text.slice(1) : text };
  });
}

export function DiffView({ diff, className }: { diff: string; className?: string }) {
  const lines = parse(diff);
  return (
    <div
      className={cn(
        "overflow-x-auto rounded-md border border-border bg-canvas font-mono code-text-dense leading-[1.55]",
        className,
      )}
    >
      <div className="min-w-max py-1">
        {lines.map((line, i) => (
          <div
            key={i}
            className={cn(
              "flex min-h-[17px] whitespace-pre px-2",
              line.kind === "add" && "bg-success/10 text-success",
              line.kind === "del" && "bg-danger/10 text-danger",
              line.kind === "hunk" && "mt-1 text-brand-ink",
              line.kind === "meta" && "text-faint",
            )}
          >
            <span className="w-4 shrink-0 select-none text-faint">
              {line.kind === "add" ? "+" : line.kind === "del" ? "−" : ""}
            </span>
            <span>{line.text || " "}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
