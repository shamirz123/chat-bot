"use client";

import React, { memo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import BrandMark from "./BrandMark";
import type { ChatMessage, Source } from "../lib/types";

type Kids = { children?: React.ReactNode };

const markdownComponents = {
  p: ({ children }: Kids) => <p className="mb-3 last:mb-0">{children}</p>,
  strong: ({ children }: Kids) => <strong className="font-semibold">{children}</strong>,
  h1: ({ children }: Kids) => (
    <h1 className="mb-2 mt-4 text-lg font-semibold first:mt-0">{children}</h1>
  ),
  h2: ({ children }: Kids) => (
    <h2 className="mb-2 mt-4 text-base font-semibold first:mt-0">{children}</h2>
  ),
  h3: ({ children }: Kids) => (
    <h3 className="mb-1.5 mt-3 text-sm font-semibold first:mt-0">{children}</h3>
  ),
  ul: ({ children }: Kids) => <ul className="mb-3 list-disc space-y-1 pl-5">{children}</ul>,
  ol: ({ children }: Kids) => <ol className="mb-3 list-decimal space-y-1 pl-5">{children}</ol>,
  li: ({ children }: Kids) => <li>{children}</li>,
  a: ({ children, href }: Kids & { href?: string }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-accent underline underline-offset-2 hover:opacity-80"
    >
      {children}
    </a>
  ),
  hr: () => <hr className="my-4 border-line" />,
  code: ({ children, className }: Kids & { className?: string }) =>
    /language-/.test(className || "") ? (
      <code className="my-2 block overflow-x-auto whitespace-pre-wrap rounded-lg bg-panel p-3 font-mono text-[13px]">
        {children}
      </code>
    ) : (
      <code className="rounded bg-panel px-1.5 py-0.5 font-mono text-[13px]">{children}</code>
    ),
  blockquote: ({ children }: Kids) => (
    <blockquote className="my-2 border-l-2 border-line pl-3 text-muted">{children}</blockquote>
  ),
};

/** Citation chips under an answer; clicking one reveals the passage it came from. */
export function SourceList({ sources }: { sources: Source[] }) {
  const [openN, setOpenN] = useState<number | null>(null);
  const open = sources.find((s) => s.n === openN);

  return (
    <div className="mt-3">
      <div className="flex flex-wrap gap-2">
        {sources.map((s) => (
          <button
            key={s.n}
            type="button"
            aria-expanded={openN === s.n}
            onClick={() => setOpenN(openN === s.n ? null : s.n)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${
              openN === s.n
                ? "border-accent bg-accent-soft text-accent"
                : "border-line text-muted hover:border-accent hover:text-accent"
            }`}
          >
            <span className="font-medium">{s.n}</span>
            <span className="max-w-[10rem] truncate">{s.docName}</span>
          </button>
        ))}
      </div>
      {open && (
        <div className="mt-2 rounded-xl bg-panel p-3 text-[13px] leading-relaxed text-muted">
          <p className="whitespace-pre-wrap">{open.excerpt}</p>
          <p className="mt-1.5 text-xs">Match {Math.round(open.score * 100)}%</p>
        </div>
      )}
    </div>
  );
}

interface Props {
  message: ChatMessage;
}

// Memoised: while a reply streams only the last message changes, so earlier
// bubbles skip re-parsing their Markdown on every token.
const MessageBubble = memo(function MessageBubble({ message }: Props) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-accent px-4 py-2.5 text-[15px] leading-relaxed text-accent-ink md:max-w-[75%]">
          {message.content}
        </div>
      </div>
    );
  }

  // Retrieval attaches its top matches to every reply; only show the ones the
  // answer actually cites as [n], so unrelated questions don't get source chips.
  const cited = (message.sources ?? []).filter((s) => message.content.includes(`[${s.n}]`));

  return (
    <div className="flex items-start gap-3">
      <BrandMark size="sm" className="mt-0.5" />
      <div className="min-w-0 flex-1 text-[15px] leading-relaxed">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
          {message.content}
        </ReactMarkdown>
        {cited.length > 0 && <SourceList sources={cited} />}
      </div>
    </div>
  );
});

export default MessageBubble;
