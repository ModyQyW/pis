import { cjk } from "@streamdown/cjk";
import { code } from "@streamdown/code";
import { createMathPlugin } from "@streamdown/math";
import { mount, type Mounted } from "pele";
import { memo, useDeferredValue, useEffect, useRef } from "react";
import { Streamdown, type CustomRendererProps } from "streamdown";

const math = createMathPlugin({
  singleDollarTextMath: true,
  errorColor: "var(--danger)",
});

const plugins = {
  code,
  math,
  cjk,
  renderers: [
    {
      language: ["mermaid", "mmd"],
      component: PeleDiagram,
    },
  ],
};

function PeleDiagram({ code: source, isIncomplete }: CustomRendererProps) {
  const ref = useRef<HTMLDivElement>(null);
  const mounted = useRef<Mounted | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (isIncomplete || !source.trim()) {
      mounted.current?.destroy();
      mounted.current = null;
      el.replaceChildren();
      return;
    }
    try {
      mounted.current = mount(el, source);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      el.replaceChildren();
      const fallback = document.createElement("pre");
      fallback.className = "pele-error";
      fallback.textContent = `Could not render this Mermaid diagram: ${message}`;
      el.append(fallback);
    }
    return () => {
      mounted.current?.destroy();
      mounted.current = null;
    };
  }, [source, isIncomplete]);

  if (isIncomplete) {
    return (
      <div className="my-2 rounded-lg border border-border bg-surface-2 px-3 py-2 text-[11px] text-faint">
        Rendering Mermaid diagram…
      </div>
    );
  }

  return <div ref={ref} className="pele-diagram my-2" data-pele-diagram="" />;
}

function MarkdownText({
  text,
  streaming,
}: {
  text: string;
  streaming?: boolean;
}) {
  const value = useDeferredValue(text);
  return (
    <Streamdown
      mode={streaming ? "streaming" : "static"}
      isAnimating={streaming}
      className="streamdown-scope"
      plugins={plugins}
      shikiTheme={["github-light", "github-dark"]}
      codeBlockMaxHeight={420}
      parseIncompleteMarkdown
    >
      {value}
    </Streamdown>
  );
}

export const Markdown = memo(MarkdownText);
