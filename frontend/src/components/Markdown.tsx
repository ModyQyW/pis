import { cjk } from "@streamdown/cjk";
import { code } from "@streamdown/code";
import { createMathPlugin } from "@streamdown/math";
import { mermaid } from "@streamdown/mermaid";
import { memo, useDeferredValue } from "react";
import { Streamdown } from "streamdown";

const math = createMathPlugin({
  singleDollarTextMath: true,
  errorColor: "var(--danger)",
});

const plugins = { code, math, cjk, mermaid };

function MarkdownText({ text, streaming }: { text: string; streaming?: boolean }) {
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
