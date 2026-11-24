import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown, Loader2 } from "lucide-react";
import { useCallback, useLayoutEffect, useRef, useState } from "react";

import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import { Marker, MarkerContent } from "@/components/ui/marker";
import { Message, MessageContent, MessageFooter } from "@/components/ui/message";
import type { ChatSession } from "../store/chat";
import type { ChatItem } from "../lib/transcript";
import { AssistantMessage } from "./AssistantMessage";
import { StandaloneTool } from "./ToolCard";

const BOTTOM_THRESHOLD = 100;

export function SessionTranscript({
  session,
  items,
  onFork,
}: {
  session: ChatSession;
  items: ChatItem[];
  onFork?: (entryId: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const previousCount = useRef(items.length);
  const [atBottom, setAtBottom] = useState(true);
  const virtualizer = useVirtualizer<HTMLDivElement, HTMLDivElement>({
    count: items.length,
    enabled: items.length > 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 120,
    getItemKey: (index) => items[index]?.id ?? index,
    overscan: 8,
    paddingStart: 24,
    paddingEnd: 40,
    followOnAppend: "smooth",
  });

  const updateStick = useCallback((next: boolean) => {
    stickToBottom.current = next;
    setAtBottom(next);
  }, []);

  const handleScroll = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;
    const distance = element.scrollHeight - element.scrollTop - element.clientHeight;
    updateStick(distance <= BOTTOM_THRESHOLD);
  }, [updateStick]);

  useLayoutEffect(() => {
    updateStick(true);
    previousCount.current = items.length;
    const frame = requestAnimationFrame(() => {
      const element = scrollRef.current;
      if (element) element.scrollTop = element.scrollHeight;
    });
    return () => cancelAnimationFrame(frame);
  }, [session.key, updateStick]);

  useLayoutEffect(() => {
    const appended = items.length > previousCount.current;
    previousCount.current = items.length;
    if (!stickToBottom.current || appended) return;
    const element = scrollRef.current;
    if (!element) return;
    const frame = requestAnimationFrame(() => {
      if (!stickToBottom.current) return;
      element.scrollTop = element.scrollHeight;
    });
    return () => cancelAnimationFrame(frame);
  }, [items]);

  // Markdown, code highlighting, and images can grow rows after layout. Keep
  // the viewport pinned while the reader has not scrolled away from the end.
  useLayoutEffect(() => {
    const content = contentRef.current;
    const element = scrollRef.current;
    if (!content || !element || !atBottom) return;
    const observer = new ResizeObserver(() => {
      if (stickToBottom.current) element.scrollTop = element.scrollHeight;
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, [atBottom, session.key]);

  if (items.length === 0) {
    return (
      <div className="flex min-h-full items-center justify-center px-8">
        <div className="flex flex-col items-center gap-2 text-[12px] text-faint">
          {session.status === "loading" ? (
            <>
              <Loader2 size={16} className="animate-spin text-subtle" />
              Starting pi…
            </>
          ) : session.status === "error" ? (
            <span className="max-w-[420px] text-center text-danger">{session.error}</span>
          ) : (
            <>
              <span className="text-[13px] text-subtle">New chat</span>
              <span>Ask pi to inspect, change, or explain this project.</span>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full">
      <div ref={scrollRef} onScroll={handleScroll} className="scroll-thin h-full overflow-y-auto">
        <div
          ref={contentRef}
          className="relative w-full"
          style={{ height: virtualizer.getTotalSize() }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const item = items[virtualRow.index];
            if (!item) return null;
            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                className="absolute left-0 top-0 w-full"
                style={{ transform: `translateY(${virtualRow.start}px)` }}
              >
                <div className="mx-auto w-full max-w-[860px] px-7">
                  <TranscriptRow item={item} onFork={onFork} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {!atBottom ? (
        <button
          type="button"
          onClick={() => {
            updateStick(true);
            virtualizer.scrollToEnd({ behavior: "smooth" });
          }}
          className="absolute bottom-3 left-1/2 flex size-7 -translate-x-1/2 items-center justify-center rounded-full border border-border bg-surface text-subtle shadow-sm hover:text-fg"
          aria-label="Scroll to latest"
        >
          <ArrowDown size={13} />
        </button>
      ) : null}
    </div>
  );
}

function TranscriptRow({ item, onFork }: { item: ChatItem; onFork?: (entryId: string) => void }) {
  switch (item.kind) {
    case "user":
      return <UserMessage item={item} onFork={onFork} />;
    case "assistant":
      return (
        <div className="pb-1 pt-4">
          <AssistantMessage item={item} />
        </div>
      );
    case "tool":
      return (
        <div className="pb-1">
          <StandaloneTool tool={item.tool} />
        </div>
      );
    case "compaction":
      return (
        <Marker variant="separator" className="my-5">
          <MarkerContent className="flex flex-col items-center gap-0.5">
            <span className="text-[10px] font-medium uppercase tracking-[0.08em]">
              Context compacted
            </span>
            {item.tokensBefore ? (
              <span className="text-[10px]">
                {Math.round(item.tokensBefore / 1000)}k tokens summarized
              </span>
            ) : null}
          </MarkerContent>
        </Marker>
      );
    case "branch":
      return (
        <Marker variant="border" className="my-4">
          <MarkerContent>
            <span className="mr-2 text-[10px] font-medium uppercase tracking-[0.08em] text-faint">
              Branch summary
            </span>
            <span className="text-[11.5px] leading-5">{item.summary || "Earlier branch"}</span>
          </MarkerContent>
        </Marker>
      );
    case "note":
      return (
        <Marker className="my-3">
          <MarkerContent className="text-[11.5px] leading-5">{item.text}</MarkerContent>
        </Marker>
      );
  }
}

function UserMessage({
  item,
  onFork,
}: {
  item: Extract<ChatItem, { kind: "user" }>;
  onFork?: (entryId: string) => void;
}) {
  return (
    <Message align="end" className="pb-2 pt-5">
      <MessageContent className="items-end gap-1">
        <Bubble variant="muted" align="end" className="max-w-[88%]">
          <BubbleContent className="whitespace-pre-wrap text-[13px] leading-6">
            {item.text}
            {item.images.length ? (
              <span className="mt-2 grid grid-cols-2 gap-2">
                {item.images.map((img, i) => (
                  <img
                    key={i}
                    src={`data:${img.mimeType};base64,${img.data}`}
                    alt="Attached"
                    className="max-h-[280px] rounded-md border border-border object-contain"
                  />
                ))}
              </span>
            ) : null}
          </BubbleContent>
        </Bubble>
        <MessageFooter className="gap-0.5 opacity-0 transition-opacity group-hover/message:opacity-100">
          <Button
            variant="ghost"
            size="xs"
            onClick={() => void navigator.clipboard.writeText(item.text)}
          >
            Copy
          </Button>
          {onFork ? (
            <Button variant="ghost" size="xs" onClick={() => onFork(item.id)}>
              Fork from here
            </Button>
          ) : null}
        </MessageFooter>
      </MessageContent>
    </Message>
  );
}
