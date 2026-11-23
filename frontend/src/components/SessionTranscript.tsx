import { ArrowDown, Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";

import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import { Marker, MarkerContent } from "@/components/ui/marker";
import { Message, MessageContent, MessageFooter } from "@/components/ui/message";
import type { ChatSession } from "../store/chat";
import type { ChatItem } from "../lib/transcript";
import { AssistantMessage } from "./AssistantMessage";
import { StandaloneTool } from "./ToolCard";

export function SessionTranscript({
  session,
  items,
  onFork,
}: {
  session: ChatSession;
  items: ChatItem[];
  onFork?: (entryId: string) => void;
}) {
  const ref = useRef<VirtuosoHandle>(null);
  const [atBottom, setAtBottom] = useState(true);

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
      <Virtuoso
        key={session.key}
        ref={ref}
        data={items}
        followOutput={(bottom) => (bottom ? "smooth" : false)}
        atBottomStateChange={setAtBottom}
        atBottomThreshold={100}
        increaseViewportBy={600}
        className="scroll-thin h-full"
        components={{
          Header: () => <div className="h-6" />,
          Footer: () => <div className="h-10" />,
        }}
        itemContent={(_index, item) => (
          <div className="mx-auto w-full max-w-[860px] px-7">
            <TranscriptRow item={item} onFork={onFork} />
          </div>
        )}
      />
      {!atBottom ? (
        <button
          type="button"
          onClick={() => ref.current?.scrollToIndex({ index: items.length - 1, behavior: "smooth" })}
          className="absolute bottom-3 left-1/2 flex size-7 -translate-x-1/2 items-center justify-center rounded-full border border-border bg-surface text-subtle shadow-sm hover:text-fg"
          aria-label="Scroll to latest"
        >
          <ArrowDown size={13} />
        </button>
      ) : null}
    </div>
  );
}

function TranscriptRow({
  item,
  onFork,
}: {
  item: ChatItem;
  onFork?: (entryId: string) => void;
}) {
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
