"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { FiX, FiUser, FiLogOut, FiMenu } from "react-icons/fi";
import { BsSendFill, BsStopCircle } from "react-icons/bs";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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


const Orb = ({ active, size = 56 }: { active: boolean; size?: number }) => (
  <div
    className="relative shrink-0"
    style={{ width: size, height: size }}
    aria-hidden
  >
    <motion.div
      className="absolute inset-0"
      style={{ background: "linear-gradient(135deg, #A78BFA 0%, #FF8A65 100%)" }}
      animate={{
        borderRadius: active
          ? [
              "42% 58% 63% 37% / 41% 44% 56% 59%",
              "58% 42% 39% 61% / 55% 61% 39% 45%",
              "42% 58% 63% 37% / 41% 44% 56% 59%",
            ]
          : [
              "48% 52% 55% 45% / 48% 48% 52% 52%",
              "52% 48% 45% 55% / 52% 52% 48% 48%",
              "48% 52% 55% 45% / 48% 48% 52% 52%",
            ],
        scale: active ? [1, 1.08, 1] : [1, 1.02, 1],
      }}
      transition={{
        repeat: Infinity,
        duration: active ? 2.2 : 5,
        ease: "easeInOut",
      }}
    />
    <motion.div
      className="absolute inset-0 -z-10 rounded-full"
      style={{ background: "#A78BFA" }}
      animate={{
        opacity: active ? [0.35, 0.6, 0.35] : [0.15, 0.25, 0.15],
        scale: active ? [1.3, 1.6, 1.3] : [1.2, 1.35, 1.2],
      }}
      transition={{ repeat: Infinity, duration: active ? 1.6 : 4, ease: "easeInOut" }}
    />
    <div
      className="absolute inset-0 rounded-full blur-xl -z-20"
      style={{ background: "#A78BFA55" }}
    />
  </div>
);

const Pulse = () => (
  <div className="flex items-center gap-1.5">
    {[0, 1, 2].map((i) => (
      <motion.span
        key={i}
        className="w-2 h-2 rounded-full"
        style={{ background: "#A78BFA" }}
        animate={{ opacity: [0.3, 1, 0.3], scale: [0.85, 1.1, 0.85] }}
        transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.18, ease: "easeInOut" }}
      />
    ))}
  </div>
);

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
    "How does AI work?",
    "Write a poem",
    "Explain quantum computing",
  ];

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#14101B] text-[#F3EFFA] font-[var(--font-body)]">
      {/* Aurora backdrop — isolated on its own layer, clipped by the parent above */}
      <div className="absolute inset-0 -z-10 overflow-hidden" aria-hidden>
        <motion.div
          className="absolute w-[60vw] h-[60vw] rounded-full blur-[140px]"
          style={{ background: "#A78BFA22", top: "-15%", left: "-10%" }}
          animate={{ opacity: [0.5, 0.8, 0.5] }}
          transition={{ repeat: Infinity, duration: 9, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute w-[50vw] h-[50vw] rounded-full blur-[140px]"
          style={{ background: "#FF8A6522", bottom: "-15%", right: "-10%" }}
          animate={{ opacity: [0.4, 0.7, 0.4] }}
          transition={{ repeat: Infinity, duration: 11, ease: "easeInOut", delay: 1.5 }}
        />
      </div>

      <div className="relative z-10 flex h-full">
        {/* Sidebar (desktop) */}
        <div className="hidden md:flex w-72 border-r border-[#2E2740] bg-[#1D1826]/60 backdrop-blur-xl flex-col">
          <div className="p-5 border-b border-[#2E2740]">
            <p className="font-[var(--font-mono)] text-[10px] tracking-[0.2em] text-[#948FA3] mb-1">
              CONVERSATIONS
            </p>
            <h2 className="font-[var(--font-display)] text-lg italic">With shamirbot</h2>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5">
            {history
              .filter((msg) => msg.role === "user")
              .map((msg, i) => (
                <motion.button
                  key={msg.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => handleHistoryClick(msg)}
                  className="w-full text-left px-3.5 py-3 rounded-2xl text-sm bg-transparent hover:bg-[#2E2740]/60 border border-transparent hover:border-[#3A3350] transition-colors truncate text-[#D6D0E3]"
                >
                  {msg.content.length > 36
                    ? msg.content.slice(0, 36) + "…"
                    : msg.content}
                </motion.button>
              ))}
            {history.filter((m) => m.role === "user").length === 0 && (
              <p className="px-3.5 py-4 text-sm text-[#665F78]">
                Nothing here yet — say hello.
              </p>
            )}
          </div>
        </div>

        {/* Mobile sidebar overlay */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="md:hidden fixed inset-0 z-30 bg-[#0B0810]/70 backdrop-blur-sm"
              onClick={() => setSidebarOpen(false)}
            >
              <motion.div
                initial={{ x: -280 }}
                animate={{ x: 0 }}
                exit={{ x: -280 }}
                transition={{ type: "spring", damping: 26, stiffness: 240 }}
                onClick={(e) => e.stopPropagation()}
                className="w-72 h-full bg-[#1D1826] border-r border-[#2E2740] p-5 overflow-y-auto"
              >
                <h2 className="font-[var(--font-display)] text-lg italic mb-4">With shamirbot</h2>
                {history
                  .filter((msg) => msg.role === "user")
                  .map((msg) => (
                    <button
                      key={msg.id}
                      onClick={() => handleHistoryClick(msg)}
                      className="w-full text-left px-3.5 py-3 mb-1.5 rounded-2xl text-sm hover:bg-[#2E2740]/60 truncate text-[#D6D0E3]"
                    >
                      {msg.content.length > 36 ? msg.content.slice(0, 36) + "…" : msg.content}
                    </button>
                  ))}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main column */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between px-5 md:px-8 py-4 border-b border-[#2E2740]">
            <div className="flex items-center gap-3.5">
              <button
                onClick={() => setSidebarOpen(true)}
                className="md:hidden p-2 -ml-2 text-[#D6D0E3]"
              >
                <FiMenu className="text-xl" />
              </button>
              <Orb active={busy} size={40} />
              <div>
                <h1 className="font-[var(--font-display)] text-lg italic leading-tight">shamirbot</h1>
                <p className="text-xs text-[#948FA3]">
                  {busy ? "thinking…" : "here whenever you are"}
                </p>
              </div>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleLogout}
              className="p-2.5 rounded-full border border-[#2E2740] hover:border-[#FF8A65] hover:text-[#FF8A65] transition-colors"
            >
              <FiLogOut className="text-lg" />
            </motion.button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-5 md:px-8 py-6 space-y-4">
            <AnimatePresence>
              {messages.length === 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center h-full text-center"
                >
                  <Orb active={false} size={72} />
                  <h2 className="font-[var(--font-display)] italic text-3xl mt-7 mb-2">
                    Hello. I&apos;m shamirbot.
                  </h2>
                  <p className="max-w-sm text-[#948FA3]">
                    Ask me something, or start from one of these.
                  </p>
                  <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-md">
                    {presets.map((suggestion, i) => (
                      <motion.button
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.06 }}
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setInput(suggestion)}
                        className="p-3.5 rounded-2xl text-sm text-left bg-[#1D1826]/70 border border-[#2E2740] hover:border-[#A78BFA]/50 backdrop-blur-sm transition-colors text-[#D6D0E3]"
                      >
                        {suggestion}
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
                exit={{ opacity: 0 }}
                className="flex items-center gap-3 px-4 py-3.5 rounded-3xl rounded-bl-md bg-[#1D1826]/70 border border-[#2E2740] backdrop-blur-sm max-w-[140px]"
              >
                <Pulse />
              </motion.div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="px-5 md:px-8 py-4 border-t border-[#2E2740]">
            <div className="flex items-end gap-3">
              <button className="hidden sm:flex shrink-0 p-3 rounded-full border border-[#2E2740] hover:border-[#A78BFA]/60 hover:text-[#A78BFA] transition-colors">
                <FiUser className="text-lg" />
              </button>

              <div className="flex-1 relative">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
                  placeholder="Say something…"
                  className="w-full p-4 pr-11 bg-[#1D1826]/70 border border-[#2E2740] rounded-3xl focus:outline-none focus:border-[#A78BFA] resize-none placeholder:text-[#665F78] backdrop-blur-sm transition-colors"
                  disabled={loading}
                  rows={1}
                />
                {input && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    whileHover={{ scale: 1.1 }}
                    onClick={() => setInput("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#665F78] hover:text-[#F3EFFA]"
                  >
                    <FiX />
                  </motion.button>
                )}
              </div>

              {loading ? (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={stop}
                  className="shrink-0 p-4 rounded-full bg-[#FF8A65] text-[#14101B] hover:brightness-95 transition-all"
                >
                  <BsStopCircle className="text-xl" />
                </motion.button>
              ) : (
                <motion.button
                  whileHover={{ scale: input.trim() ? 1.05 : 1 }}
                  whileTap={{ scale: input.trim() ? 0.95 : 1 }}
                  onClick={send}
                  disabled={!input.trim()}
                  className={`shrink-0 p-4 rounded-full transition-all ${
                    input.trim()
                      ? "bg-gradient-to-br from-[#A78BFA] to-[#FF8A65] text-[#14101B] hover:brightness-105"
                      : "bg-[#1D1826] border border-[#2E2740] text-[#665F78] cursor-not-allowed"
                  }`}
                >
                  <BsSendFill className="text-xl" />
                </motion.button>
              )}
            </div>
            <div className="mt-2.5 text-center text-[11px] text-[#665F78]">
              shamirbot can make mistakes. Check important details.
            </div>
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
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.4), duration: 0.3 }}
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[78%] px-4 py-3 rounded-3xl backdrop-blur-sm ${
          isUser
            ? "bg-gradient-to-br from-[#A78BFA]/25 to-[#FF8A65]/15 border border-[#A78BFA]/30 rounded-br-md"
            : "bg-[#1D1826]/70 border border-[#2E2740] rounded-bl-md"
        }`}
      >
        <div className="text-[15px] leading-relaxed">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              p: ({ children }) => <p className="mb-2.5 last:mb-0">{children}</p>,
              strong: ({ children }) => (
                <strong className="font-semibold text-[#FFCDB8]">{children}</strong>
              ),
              em: ({ children }) => <em className="text-[#D6D0E3]">{children}</em>,
              h1: ({ children }) => (
                <h1 className="font-[var(--font-display)] italic text-lg mt-3 mb-2 first:mt-0">
                  {children}
                </h1>
              ),
              h2: ({ children }) => (
                <h2 className="font-[var(--font-display)] italic text-base mt-3 mb-1.5 first:mt-0">
                  {children}
                </h2>
              ),
              h3: ({ children }) => (
                <h3 className="text-sm font-semibold tracking-wide mt-3 mb-1.5 first:mt-0 text-[#A78BFA]">
                  {children}
                </h3>
              ),
              ul: ({ children }) => (
                <ul className="list-disc pl-5 mb-2.5 space-y-1 marker:text-[#A78BFA]">
                  {children}
                </ul>
              ),
              ol: ({ children }) => (
                <ol className="list-decimal pl-5 mb-2.5 space-y-1 marker:text-[#A78BFA]">
                  {children}
                </ol>
              ),
              li: ({ children }) => <li>{children}</li>,
              a: ({ children, href }) => (
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#A78BFA] underline underline-offset-2 hover:text-[#C4B5FD]"
                >
                  {children}
                </a>
              ),
              hr: () => <hr className="my-3 border-[#2E2740]" />,
              code: ({ children, className }) => {
                const isBlock = /language-/.test(className || "");
                return isBlock ? (
                  <code className="block whitespace-pre-wrap font-[var(--font-mono)] text-[13px] bg-[#14101B] border border-[#2E2740] rounded-xl p-3 my-2 overflow-x-auto">
                    {children}
                  </code>
                ) : (
                  <code className="font-[var(--font-mono)] text-[13px] bg-[#14101B] border border-[#2E2740] rounded px-1.5 py-0.5">
                    {children}
                  </code>
                );
              },
              blockquote: ({ children }) => (
                <blockquote className="border-l-2 border-[#A78BFA]/50 pl-3 my-2 text-[#948FA3]">
                  {children}
                </blockquote>
              ),
            }}
          >
            {message.content}
          </ReactMarkdown>
        </div>
      </div>
    </motion.div>
  );
};

export default Chat;