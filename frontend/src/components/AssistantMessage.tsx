import { Brain } from "lucide-react";
import { lazy, Suspense, useState } from "react";

import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Message, MessageContent, MessageFooter } from "@/components/ui/message";
import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from "@/components/ui/trace";
import type { ChatItem } from "../lib/transcript";
import { t } from "../lib/i18n";
import { ToolCard } from "./ToolCard";

const Markdown = lazy(() => import("./Markdown").then((m) => ({ default: m.Markdown })));

type AssistantItem = Extract<ChatItem, { kind: "assistant" }>;

export function AssistantMessage({ item }: { item: AssistantItem }) {
  return (
    <Message className="py-3">
      <MessageContent className="gap-1">
        {item.blocks.map((block, i) => {
          if (block.kind === "text") {
            return (
              <Suspense
                key={i}
                fallback={
                  <div className="whitespace-pre-wrap text-[13.5px] leading-7 text-fg">
                    {block.text}
                  </div>
                }
              >
                <Markdown text={block.text} streaming={item.live && i === item.blocks.length - 1} />
              </Suspense>
            );
          }
          if (block.kind === "thinking") {
            return <ThinkingBlock key={i} text={block.text} redacted={block.redacted} />;
          }
          if (block.kind === "image") {
            return (
              <img
                key={i}
                src={`data:${block.image.mimeType};base64,${block.image.data}`}
                alt="Assistant image"
                className="my-2 max-h-[360px] rounded-lg border border-border object-contain"
              />
            );
          }
          return <ToolCard key={block.id || i} tool={block} />;
        })}
        {item.error ? (
          <Bubble variant="destructive" className="my-2 max-w-full">
            <BubbleContent>{item.error}</BubbleContent>
          </Bubble>
        ) : null}
        {item.usage ? (
          <MessageFooter className="mt-1 gap-2 text-[9.5px] tabular-nums text-faint opacity-0 transition-opacity group-hover/message:opacity-100">
            {item.model ? <span>{item.model}</span> : null}
            <span>{Math.round((item.usage.totalTokens ?? 0) / 1000)}k tokens</span>
            <span>${(item.usage.cost?.total ?? 0).toFixed(3)}</span>
            {item.durationMs ? <span>{(item.durationMs / 1000).toFixed(1)}s</span> : null}
          </MessageFooter>
        ) : null}
      </MessageContent>
    </Message>
  );
}

function ThinkingBlock({ text, redacted }: { text: string; redacted?: boolean }) {
  const [open, setOpen] = useState(false);
  if (!text) return null;
  return (
    <Trace className="my-1">
      <TraceCollapsible open={open} onOpenChange={setOpen}>
        <TraceCollapsibleTrigger>
          <TraceLine>
            <TraceIcon>
              <Brain />
            </TraceIcon>
            <TraceTitle>{redacted ? t("Redacted thinking") : t("Thinking")}</TraceTitle>
          </TraceLine>
        </TraceCollapsibleTrigger>
        <TraceCollapsibleContent className="whitespace-pre-wrap pt-1 text-[11.5px] leading-5">
          {text}
        </TraceCollapsibleContent>
      </TraceCollapsible>
    </Trace>
  );
}
