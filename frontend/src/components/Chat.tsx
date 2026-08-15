"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { FiX, FiLogOut, FiMenu, FiArrowUpRight } from "react-icons/fi";
import { BsSendFill, BsStopCircle } from "react-icons/bs";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import BrandMark from "./BrandMark";

export type ChatRole = "user" | "shamirbot" | "system" | "assistant" | string;

export interface ChatMessage {
  role: ChatRole;
  content: string;
  id: string;
}

interface SSEPayload {
  delta?: string;
  error?: string;
  text?: string;
}

const Chat = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000";

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchHistory = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }
      const response = await fetch(`${API_BASE_URL}/api/chat/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to fetch history");
      const historyData: ChatMessage[] = await response.json();
      setHistory(historyData);
      setMessages(historyData);
    } catch (err) {
      console.error(err);
      router.push("/login");
    }
  };

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
    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("No token found");
      const response = await fetch(`${API_BASE_URL}/api/chat/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: userText }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`);
      }

      const ctype = response.headers.get("content-type") || "";
      if (!ctype.includes("text/event-stream")) {
        const text = await response.text();
        try {
          const json = JSON.parse(text) as SSEPayload;
          if (json.text) {
            setMessages((prev) => [
              ...prev,
              {
                role: "shamirbot",
                content: json.text || "",
                id: (Date.now() + 1).toString(),
              },
            ]);
            await fetchHistory();
            return;
          }
        } catch {
          /* ignore JSON parse error */
        }
        throw new Error(`Expected SSE, got: ${ctype}`);
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const assistantMessageId = (Date.now() + 1).toString();

      setMessages((prev) => [
        ...prev,
        { role: "shamirbot", content: "", id: assistantMessageId },
      ]);

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = buffer.indexOf("\n\n")) !== -1) {
          const rawEvent = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 2);

          const dataLines = rawEvent
            .split("\n")
            .filter((l) => l.startsWith("data:"))
            .map((l) => l.replace(/^data:\s?/, ""));

          if (!dataLines.length) continue;

          const payload = dataLines.join("");
          if (payload === "[DONE]") continue;

          let json: SSEPayload;
          try {
            json = JSON.parse(payload) as SSEPayload;
          } catch {
            continue;
          }

          if (json.error) throw new Error(json.error);
          if (typeof json.delta === "string") {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessageId
                  ? { ...msg, content: msg.content + String(json.delta) }
                  : msg
              )
            );
          }
        }
      }
      await fetchHistory();
    } catch (e) {
      console.error(e);
      setMessages((prev) => [
        ...prev,
        {
          role: "shamirbot",
          content: "Something went wrong there. Try again?",
          id: Date.now().toString(),
        },
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
    localStorage.removeItem("token");
    setMessages([]);
    router.push("/login");
  };

  const handleHistoryClick = (message: ChatMessage) => {
    const index = history.findIndex((m) => m.id === message.id);
    if (index !== -1) {
      setMessages(history.slice(0, index + 1));
      setSidebarOpen(false);
    }
  };

  const busy = loading || isTyping;
  const presets = [
    "Who is Shahmir?",
    "Show Shahmir's portfolio",
    "How does AI work?",
    "Write a poem",
  ];
  const userHistory = history.filter((msg) => msg.role === "user");

  return (
    <div className="fixed inset-0 overflow-hidden studio-atmosphere studio-hatch studio-grain text-[var(--studio-ink)] font-[var(--font-body)]">
      <div className="relative z-10 flex h-full">
        {/* Sidebar */}
        <aside className="hidden md:flex w-[17.5rem] border-r border-[var(--studio-line)] bg-[var(--studio-surface)] backdrop-blur-md flex-col">
          <div className="px-6 py-6 border-b border-[var(--studio-line)]">
            <p className="font-[var(--font-mono)] text-[10px] tracking-[0.22em] uppercase text-[var(--studio-muted)] mb-2">
              Conversations
            </p>
            <h2 className="font-[var(--font-display)] text-xl font-bold tracking-tight text-[var(--studio-pine)]">
              shamirbot
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
            {userHistory.map((msg, i) => (
              <motion.button
                key={msg.id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => handleHistoryClick(msg)}
                className="group w-full text-left px-3 py-3 text-sm text-[var(--studio-pine-muted)] hover:text-[var(--studio-pine)] border-l-2 border-transparent hover:border-[var(--studio-vermillion)] transition-colors"
              >
                <span className="line-clamp-2 leading-snug">
                  {msg.content.length > 48
                    ? msg.content.slice(0, 48) + "…"
                    : msg.content}
                </span>
              </motion.button>
            ))}
            {userHistory.length === 0 && (
              <p className="px-3 py-4 text-sm text-[var(--studio-muted)]">
                Nothing logged yet — start a thread.
              </p>
            )}
          </div>
        </aside>

        {/* Mobile sidebar */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="md:hidden fixed inset-0 z-30 bg-black/55 backdrop-blur-sm"
              onClick={() => setSidebarOpen(false)}
            >
              <motion.div
                initial={{ x: -300 }}
                animate={{ x: 0 }}
                exit={{ x: -300 }}
                transition={{ type: "spring", damping: 28, stiffness: 260 }}
                onClick={(e) => e.stopPropagation()}
                className="w-72 h-full bg-[var(--studio-panel)] border-r border-[var(--studio-line)] p-6 overflow-y-auto"
              >
                <p className="font-[var(--font-mono)] text-[10px] tracking-[0.22em] uppercase text-[var(--studio-muted)] mb-2">
                  Conversations
                </p>
                <h2 className="font-[var(--font-display)] text-xl font-bold text-[var(--studio-pine)] mb-5">
                  shamirbot
                </h2>
                {userHistory.map((msg) => (
                  <button
                    key={msg.id}
                    onClick={() => handleHistoryClick(msg)}
                    className="w-full text-left px-2 py-3 mb-1 text-sm text-[var(--studio-pine-muted)] border-l-2 border-transparent hover:border-[var(--studio-vermillion)] hover:text-[var(--studio-pine)]"
                  >
                    {msg.content.length > 42
                      ? msg.content.slice(0, 42) + "…"
                      : msg.content}
                  </button>
                ))}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main */}
        <div className="flex-1 flex flex-col min-w-0">
          <header className="flex items-center justify-between px-5 md:px-10 py-4 border-b border-[var(--studio-line)] bg-[var(--studio-surface)] backdrop-blur-md">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="md:hidden p-2 -ml-2 text-[var(--studio-pine)]"
                aria-label="Open conversations"
              >
                <FiMenu className="text-xl" />
              </button>
              <div>
                <BrandMark size="sm" as="h1" className="leading-none" />
                <div className="mt-1.5 flex items-center gap-2">
                  <span
                    className={`inline-block h-1.5 w-1.5 rounded-full ${
                      busy ? "bg-[var(--studio-vermillion)]" : "bg-[var(--studio-pine)]"
                    }`}
                  />
                  <p className="font-[var(--font-mono)] text-[11px] tracking-wide text-[var(--studio-muted)]">
                    {busy ? "thinking" : "ready"}
                  </p>
                </div>
              </div>
            </div>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleLogout}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm text-[var(--studio-pine)] border border-[var(--studio-line)] hover:border-[var(--studio-vermillion)] hover:text-[var(--studio-vermillion)] transition-colors"
            >
              <FiLogOut className="text-base" />
              <span className="hidden sm:inline">Sign out</span>
            </motion.button>
          </header>

          {busy && (
            <motion.div
              className="h-[2px] origin-left bg-[var(--studio-vermillion)]"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: [0.15, 0.85, 0.35, 1] }}
              transition={{
                repeat: Infinity,
                duration: 2.4,
                ease: "easeInOut",
              }}
            />
          )}

          <div className="flex-1 overflow-y-auto px-5 md:px-10 py-8 space-y-5">
            <AnimatePresence>
              {messages.length === 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col justify-center min-h-[70%] max-w-2xl"
                >
                  <BrandMark size="hero" as="h2" breathe className="block" />
                  <p className="mt-5 max-w-md text-[var(--studio-pine-muted)] text-lg leading-relaxed">
                    Ask anything. Start a thread, or pick a prompt below.
                  </p>
                  <a
                    href="https://shahmeer-zubair-portfolio.vercel.app/"
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex items-center gap-2 font-[var(--font-mono)] text-[11px] tracking-[0.14em] uppercase text-[var(--studio-vermillion)] hover:brightness-110 transition-colors"
                  >
                    Shahmir&apos;s portfolio
                    <FiArrowUpRight className="text-sm" />
                  </a>
                  <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {presets.map((suggestion, i) => (
                      <motion.button
                        key={suggestion}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.12 + i * 0.06 }}
                        whileHover={{ x: 3 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setInput(suggestion)}
                        className="group flex items-start justify-between gap-3 px-4 py-4 text-left text-sm bg-[var(--studio-surface-strong)] border border-[var(--studio-line)] hover:border-[var(--studio-pine-muted)] transition-colors"
                      >
                        <span className="text-[var(--studio-pine)] leading-snug">
                          {suggestion}
                        </span>
                        <FiArrowUpRight className="mt-0.5 shrink-0 text-[var(--studio-vermillion)] opacity-70 group-hover:opacity-100" />
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              )}

              {messages.map((message, index) => (
                <MessageBubble key={message.id} message={message} index={index} />
              ))}
            </AnimatePresence>

            {isTyping && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-[9rem]"
              >
                <p className="font-[var(--font-mono)] text-[11px] tracking-[0.18em] uppercase text-[var(--studio-muted)] mb-2">
                  shamirbot
                </p>
                <div className="h-[2px] w-full overflow-hidden bg-[var(--studio-line)]">
                  <motion.div
                    className="h-full bg-[var(--studio-vermillion)]"
                    animate={{ x: ["-100%", "100%"] }}
                    transition={{
                      repeat: Infinity,
                      duration: 1.1,
                      ease: "easeInOut",
                    }}
                    style={{ width: "40%" }}
                  />
                </div>
              </motion.div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="px-5 md:px-10 py-5 border-t border-[var(--studio-line)] bg-[var(--studio-surface)] backdrop-blur-md">
            <div className="flex items-end gap-3 max-w-4xl">
              <div className="flex-1 relative">
                <label className="font-[var(--font-mono)] text-[10px] tracking-[0.18em] uppercase text-[var(--studio-muted)]">
                  Message
                </label>
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder="Say something…"
                  className="mt-2 w-full bg-transparent border-0 border-b-2 border-[var(--studio-line)] focus:border-[var(--studio-vermillion)] focus:outline-none resize-none placeholder:text-[var(--studio-muted)] py-3 pr-10 text-[var(--studio-ink)] transition-colors"
                  disabled={loading}
                  rows={1}
                />
                {input && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    onClick={() => setInput("")}
                    className="absolute right-0 bottom-3 p-1 text-[var(--studio-muted)] hover:text-[var(--studio-pine)]"
                    aria-label="Clear message"
                  >
                    <FiX />
                  </motion.button>
                )}
              </div>

              {loading ? (
                <motion.button
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={stop}
                  className="shrink-0 mb-1 px-4 py-3 bg-[var(--studio-user)] text-[var(--studio-ink)] border border-[var(--studio-line)] hover:border-[var(--studio-vermillion)] transition-colors"
                  aria-label="Stop generating"
                >
                  <BsStopCircle className="text-xl" />
                </motion.button>
              ) : (
                <motion.button
                  whileHover={{ scale: input.trim() ? 1.04 : 1 }}
                  whileTap={{ scale: input.trim() ? 0.96 : 1 }}
                  onClick={send}
                  disabled={!input.trim()}
                  className={`shrink-0 mb-1 px-4 py-3 transition-colors ${
                    input.trim()
                      ? "bg-[var(--studio-vermillion)] text-white hover:brightness-95"
                      : "bg-[var(--studio-line)] text-[var(--studio-muted)] cursor-not-allowed"
                  }`}
                  aria-label="Send message"
                >
                  <BsSendFill className="text-xl" />
                </motion.button>
              )}
            </div>
            <p className="mt-3 font-[var(--font-mono)] text-[10px] tracking-wide text-[var(--studio-muted)]">
              shamirbot can make mistakes. Check important details. ·{" "}
              <a
                href="https://shahmeer-zubair-portfolio.vercel.app/"
                target="_blank"
                rel="noreferrer"
                className="text-[var(--studio-pine)] hover:text-[var(--studio-vermillion)] underline underline-offset-2 transition-colors"
              >
                Portfolio
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

const MessageBubble = ({
  message,
  index,
}: {
  message: ChatMessage;
  index: number;
}) => {
  const isUser = message.role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.035, 0.35), duration: 0.28 }}
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div className={`max-w-[82%] md:max-w-[70%] ${isUser ? "text-right" : ""}`}>
        <p
          className={`font-[var(--font-mono)] text-[10px] tracking-[0.18em] uppercase mb-2 ${
            isUser ? "text-[var(--studio-vermillion)]" : "text-[var(--studio-muted)]"
          }`}
        >
          {isUser ? "you" : "shamirbot"}
        </p>
        <div
          className={`text-[15px] leading-relaxed text-left ${
            isUser
              ? "px-4 py-3 bg-[var(--studio-user)] text-[var(--studio-ink)] border border-[var(--studio-line)]"
              : "pl-4 border-l-2 border-[var(--studio-vermillion)] text-[var(--studio-ink)]"
          }`}
        >
          {isUser ? (
            <div className="whitespace-pre-wrap">{message.content}</div>
          ) : (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({ children }) => (
                  <p className="mb-2.5 last:mb-0">{children}</p>
                ),
                strong: ({ children }) => (
                  <strong className="font-semibold text-[var(--studio-pine)]">
                    {children}
                  </strong>
                ),
                em: ({ children }) => (
                  <em className="text-[var(--studio-pine-muted)]">{children}</em>
                ),
                h1: ({ children }) => (
                  <h1 className="font-[var(--font-display)] text-lg font-bold mt-3 mb-2 first:mt-0 text-[var(--studio-pine)]">
                    {children}
                  </h1>
                ),
                h2: ({ children }) => (
                  <h2 className="font-[var(--font-display)] text-base font-bold mt-3 mb-1.5 first:mt-0 text-[var(--studio-pine)]">
                    {children}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-sm font-semibold tracking-wide mt-3 mb-1.5 first:mt-0 text-[var(--studio-pine)]">
                    {children}
                  </h3>
                ),
                ul: ({ children }) => (
                  <ul className="list-disc pl-5 mb-2.5 space-y-1 marker:text-[var(--studio-vermillion)]">
                    {children}
                  </ul>
                ),
                ol: ({ children }) => (
                  <ol className="list-decimal pl-5 mb-2.5 space-y-1 marker:text-[var(--studio-vermillion)]">
                    {children}
                  </ol>
                ),
                li: ({ children }) => <li>{children}</li>,
                a: ({ children, href }) => (
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[var(--studio-vermillion)] underline underline-offset-2 hover:brightness-90"
                  >
                    {children}
                  </a>
                ),
                hr: () => <hr className="my-3 border-[var(--studio-line)]" />,
                code: ({ children, className }) => {
                  const isBlock = /language-/.test(className || "");
                  return isBlock ? (
                    <code className="block whitespace-pre-wrap font-[var(--font-mono)] text-[13px] bg-[var(--studio-panel)] border border-[var(--studio-line)] p-3 my-2 overflow-x-auto">
                      {children}
                    </code>
                  ) : (
                    <code className="font-[var(--font-mono)] text-[13px] bg-[var(--studio-panel)] border border-[var(--studio-line)] px-1.5 py-0.5">
                      {children}
                    </code>
                  );
                },
                blockquote: ({ children }) => (
                  <blockquote className="border-l-2 border-[var(--studio-pine)] pl-3 my-2 text-[var(--studio-muted)]">
                    {children}
                  </blockquote>
                ),
              }}
            >
              {message.content}
            </ReactMarkdown>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default Chat;
