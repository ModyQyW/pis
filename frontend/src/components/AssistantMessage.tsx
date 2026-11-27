import { Brain, CircleDollarSign, CircleSlash, Cpu, Hash, Timer } from "lucide-react";
import { lazy, Suspense, useState } from "react";

import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Message, MessageContent, MessageFooter } from "@/components/ui/message";
import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceDescription,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from "@/components/ui/trace";
import { messageTime } from "../lib/format";
import type { ChatItem } from "../lib/transcript";
import { t } from "../lib/i18n";
import { ToolCard } from "./ToolCard";

const Markdown = lazy(() => import("./Markdown").then((m) => ({ default: m.Markdown })));

type AssistantItem = Extract<ChatItem, { kind: "assistant" }>;

export function AssistantMessage({ item }: { item: AssistantItem }) {
  // Text in a message that also calls tools is a preamble, not the answer.
  // Fold it into that segment's thinking row so the final output stands alone.
  const foldsSteps =
    item.blocks.some((block) => block.kind === "tool") &&
    item.blocks.some((block) => block.kind === "thinking" && block.text);
  const stepText = foldsSteps
    ? item.blocks
        .filter((block) => block.kind === "text")
        .map((block) => block.text)
        .join("\n\n")
    : "";
  const thinkingIndex = item.blocks.findIndex((block) => block.kind === "thinking" && block.text);
  const time = messageTime(item.timestamp);
  const stopLabel =
    item.stopReason === "aborted"
      ? t("Stopped by you")
      : item.stopReason === "length"
        ? t("Stopped at the token limit")
        : "";
  return (
    <Message className="py-3">
      <MessageContent className="gap-1">
        {item.blocks.map((block, i) => {
          if (block.kind === "text") {
            if (foldsSteps) return null;
            return (
              <Suspense
                key={i}
                fallback={
                  <div className="whitespace-pre-wrap text-body leading-7 text-fg">
                    {block.text}
                  </div>
                }
              >
                <Markdown text={block.text} streaming={item.live && i === item.blocks.length - 1} />
              </Suspense>
            );
          }
          if (block.kind === "thinking") {
            return (
              <ThinkingBlock
                key={i}
                text={block.text}
                detail={i === thinkingIndex ? stepText : undefined}
                redacted={block.redacted}
                durationMs={item.durationMs}
              />
            );
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
        {stopLabel ? (
          <div className="flex items-center gap-1.5 text-micro text-faint">
            <CircleSlash size={11} />
            <span>{stopLabel}</span>
          </div>
        ) : null}
        {time || item.usage ? (
          <MessageFooter className="mt-1 gap-2 text-micro tabular-nums text-faint">
            {time ? <time dateTime={item.timestamp}>{time}</time> : null}
            {item.usage ? (
              <span className="flex items-center gap-2 opacity-0 transition-opacity group-hover/message:opacity-100">
                {item.model ? (
                  <span className="flex items-center gap-1">
                    <Cpu size={10} />
                    {item.model}
                  </span>
                ) : null}
                <span className="flex items-center gap-1">
                  <Hash size={10} />
                  {Math.round((item.usage.totalTokens ?? 0) / 1000)}k tokens
                </span>
                <span className="flex items-center gap-1">
                  <CircleDollarSign size={10} />${(item.usage.cost?.total ?? 0).toFixed(3)}
                </span>
                {item.durationMs ? (
                  <span className="flex items-center gap-1">
                    <Timer size={10} />
                    {(item.durationMs / 1000).toFixed(1)}s
                  </span>
                ) : null}
              </span>
            ) : null}
          </MessageFooter>
        ) : null}
      </MessageContent>
    </Message>
  );
}

function ThinkingBlock({
  text,
  detail,
  redacted,
  durationMs,
}: {
  text: string;
  detail?: string;
  redacted?: boolean;
  durationMs?: number;
}) {
  const [open, setOpen] = useState(false);
  if (!text && !detail) return null;
  return (
    <Trace className="my-0.5">
      <TraceCollapsible open={open} onOpenChange={setOpen}>
        <TraceCollapsibleTrigger className="text-faint hover:text-subtle [&_svg]:size-3">
          <TraceLine className="gap-1.5 text-micro text-faint">
            <TraceIcon>
              <Brain className="size-3" />
            </TraceIcon>
            <TraceTitle>{redacted ? t("Redacted thinking") : t("Thinking")}</TraceTitle>
            {durationMs ? (
              <TraceDescription className="text-micro text-faint">
                ~{formatDuration(durationMs)}
              </TraceDescription>
            ) : null}
          </TraceLine>
        </TraceCollapsibleTrigger>
        <TraceCollapsibleContent className="whitespace-pre-wrap pt-1 text-label leading-5">
          {text}
          {detail ? (
            <div className="mt-2 border-t border-border/60 pt-2 text-subtle">{detail}</div>
          ) : null}
        </TraceCollapsibleContent>
      </TraceCollapsible>
    </Trace>
  );
}

function formatDuration(ms: number): string {
  // pi stores one duration per assistant message, not per thinking block.
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)}s`;
}
