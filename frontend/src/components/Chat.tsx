"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { FiArrowUp, FiLogOut, FiMenu, FiSquare, FiX } from "react-icons/fi";
import BrandMark from "./BrandMark";
import MessageBubble from "./MessageBubble";
import DocumentsPanel from "./DocumentsPanel";
import { UnauthorizedError, fetchHistory, openChatStream } from "../lib/api";
import { clearToken } from "../lib/auth";
import { readSSE } from "../lib/sse";
import type { ChatMessage } from "../lib/types";

export type { ChatMessage, ChatRole } from "../lib/types";

const GENERIC_ERROR = "Something went wrong there. Try again?";
const PORTFOLIO_URL = "https://shahmeer-zubair-portfolio.vercel.app/";

const PRESETS = [
  "Who is Shahmir?",
  "Which projects has Shahmir built?",
  "How does AI work?",
  "Write a poem",
];

/** Reads the { error } message our API returns on failed requests. */
async function responseError(response: Response): Promise<string> {
  try {
    const body = await response.json();
    if (typeof body?.error === "string") return body.error;
  } catch {
    /* non-JSON body */
  }
  return GENERIC_ERROR;
}

const Chat = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Nothing but a blank page is shown until the server has accepted our token,
  // so signed-out users never see the chat UI flash before the login redirect.
  const [authed, setAuthed] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadHistory = useCallback(async () => {
    try {
      const historyData = await fetchHistory();
      setHistory(historyData);
      setMessages(historyData);
      setAuthed(true);
    } catch (err) {
      if (err instanceof UnauthorizedError) clearToken();
      else console.error(err);
      router.replace("/login");
    }
  }, [router]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Grow the textarea with its content (up to a cap), shrink back when cleared.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [input]);

  const send = async () => {
    const userText = input.trim();
    if (!userText || loading) return;

    setLoading(true);
    setIsTyping(true);
    const userMessage: ChatMessage = {
      role: "user",
      content: userText,
      id: Date.now().toString(),
    };
    const assistantMessageId = (Date.now() + 1).toString();
    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    const controller = new AbortController();
    abortRef.current = controller;

    const updateAssistant = (update: (msg: ChatMessage) => ChatMessage) =>
      setMessages((prev) =>
        prev.map((msg) => (msg.id === assistantMessageId ? update(msg) : msg))
      );

    try {
      const response = await openChatStream(userText, controller.signal);
      if (response.status === 401) throw new UnauthorizedError();
      if (!response.ok) throw new Error(await responseError(response));

      setMessages((prev) => [
        ...prev,
        { role: "shamirbot", content: "", id: assistantMessageId },
      ]);

      await readSSE(response, (event) => {
        if (event.error) throw new Error(event.error);
        if (event.sources) {
          const sources = event.sources;
          updateAssistant((msg) => ({ ...msg, sources }));
        }
        if (typeof event.delta === "string") {
          const delta = event.delta;
          updateAssistant((msg) => ({ ...msg, content: msg.content + delta }));
        }
      });
      await loadHistory(); // swap optimistic ids for the persisted messages
    } catch (e) {
      if (controller.signal.aborted) return; // user pressed Stop
      console.error(e);
      const text = e instanceof UnauthorizedError ? null : e instanceof Error ? e.message : GENERIC_ERROR;
      if (text === null) {
        clearToken();
        router.replace("/login");
        return;
      }
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== assistantMessageId || m.content),
        { role: "shamirbot", content: text, id: Date.now().toString() },
      ]);
    } finally {
      setLoading(false);
      setIsTyping(false);
      abortRef.current = null;
    }
  };

  const stop = () => {
    abortRef.current?.abort();
    setLoading(false);
    setIsTyping(false);
  };

  const handleLogout = () => {
    clearToken();
    setMessages([]);
    router.replace("/login");
  };

  const handleHistoryClick = (message: ChatMessage) => {
    const index = history.findIndex((m) => m.id === message.id);
    if (index !== -1) {
      setMessages(history.slice(0, index + 1));
      setSidebarOpen(false);
    }
  };

  if (!authed) return <div className="fixed inset-0 bg-page" />;

  const userHistory = history.filter((msg) => msg.role === "user");

  const sidebar = (
    <>
      <div className="flex items-center gap-2.5 px-4 py-4">
        <BrandMark size="sm" />
        <span className="font-semibold">AskShamir</span>
      </div>

      <div className="flex-1 overflow-y-auto px-2">
        <h3 className="px-2 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted">
          History
        </h3>
        {userHistory.map((msg) => (
          <button
            key={msg.id}
            onClick={() => handleHistoryClick(msg)}
            className="block w-full truncate rounded-lg px-2 py-2 text-left text-sm text-ink hover:bg-page"
            title={msg.content}
          >
            {msg.content}
          </button>
        ))}
        {userHistory.length === 0 && (
          <p className="px-2 py-2 text-sm text-muted">No messages yet.</p>
        )}
      </div>

      <DocumentsPanel />
    </>
  );

  return (
    <div className="fixed inset-0 flex bg-page text-ink">
      {/* Sidebar (desktop) */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-line bg-panel md:flex">
        {sidebar}
      </aside>

      {/* Sidebar (mobile drawer) */}
      <div
        className={`fixed inset-0 z-30 md:hidden ${sidebarOpen ? "" : "pointer-events-none"}`}
        aria-hidden={!sidebarOpen}
      >
        <div
          onClick={() => setSidebarOpen(false)}
          className={`absolute inset-0 bg-black/40 transition-opacity ${
            sidebarOpen ? "opacity-100" : "opacity-0"
          }`}
        />
        <aside
          className={`absolute left-0 top-0 flex h-full w-72 flex-col bg-panel shadow-xl transition-transform ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <button
            onClick={() => setSidebarOpen(false)}
            className="absolute right-3 top-3 rounded-md p-1.5 text-muted hover:bg-page"
            aria-label="Close menu"
          >
            <FiX />
          </button>
          {sidebar}
        </aside>
      </div>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarOpen(true)}
              className="-ml-1 rounded-md p-2 text-muted hover:bg-panel md:hidden"
              aria-label="Open menu"
            >
              <FiMenu className="text-lg" />
            </button>
            <span className="text-sm font-medium">
              {isTyping ? "Thinking…" : "AskShamir"}
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-muted hover:bg-panel hover:text-ink"
          >
            <FiLogOut />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-3xl px-4 py-6">
            {messages.length === 0 ? (
              <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
                <BrandMark size="lg" />
                <h1 className="mt-4 text-2xl font-semibold">How can I help you?</h1>
                <p className="mt-1 text-sm text-muted">
                  Ask about Shahmir, or anything else.{" "}
                  <a
                    href={PORTFOLIO_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent hover:underline"
                  >
                    View portfolio
                  </a>
                </p>
                <div className="mt-8 grid w-full max-w-xl grid-cols-1 gap-2 sm:grid-cols-2">
                  {PRESETS.map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => {
                        setInput(suggestion);
                        textareaRef.current?.focus();
                      }}
                      className="rounded-xl border border-line px-4 py-3 text-left text-sm hover:border-accent hover:bg-accent-soft"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {messages.map((message) => (
                  <MessageBubble key={message.id} message={message} />
                ))}
                {isTyping && (
                  <div className="flex items-center gap-3" aria-label="AskShamir is typing">
                    <BrandMark size="sm" />
                    <div className="flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <span
                          key={i}
                          className="h-1.5 w-1.5 rounded-full bg-muted"
                          style={{ animation: `blink 1.2s ${i * 0.2}s infinite` }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="px-4 pb-4 pt-2">
          <div className="mx-auto w-full max-w-3xl">
            <div className="flex items-end gap-2 rounded-2xl border border-line bg-page p-2 shadow-sm focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="Message AskShamir…"
                aria-label="Message"
                rows={1}
                className="max-h-[180px] flex-1 resize-none bg-transparent px-2 py-2 text-[15px] text-ink placeholder:text-muted focus:outline-none"
              />
              {loading ? (
                <button
                  onClick={stop}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-page hover:opacity-80"
                  aria-label="Stop generating"
                >
                  <FiSquare className="text-sm" />
                </button>
              ) : (
                <button
                  onClick={send}
                  disabled={!input.trim()}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-ink transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
                  aria-label="Send message"
                >
                  <FiArrowUp className="text-lg" />
                </button>
              )}
            </div>
            <p className="mt-2 text-center text-xs text-muted">
              AskShamir can make mistakes. Check important details.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chat;
