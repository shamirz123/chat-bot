"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiSend, FiX, FiUser, FiLoader, FiCpu } from "react-icons/fi";
import { BsRobot, BsSendFill, BsStopCircle } from "react-icons/bs";

const Chat = () => {
  const [messages, setMessages] = useState<
    { role: string; content: string; id: string }[]
  >([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000";

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const send = async () => {
    const userText = input.trim();
    if (!userText || loading) return;

    setLoading(true);
    setIsTyping(true);
    const userMessage = {
      role: "user",
      content: userText,
      id: Date.now().toString(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch(`${API_BASE_URL}/api/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage],
        }),
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
          const json = JSON.parse(text);
          if (json.text) {
            setMessages((prev) => [
              ...prev,
              {
                role: "Shaz",
                content: json.text,
                id: (Date.now() + 1).toString(),
              },
            ]);
            return;
          }
        } catch {}
        throw new Error(`Expected SSE, got: ${ctype}`);
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantMessageId = (Date.now() + 1).toString();

      setMessages((prev) => [
        ...prev,
        { role: "Shaz", content: "", id: assistantMessageId },
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

          let json: any;
          try {
            json = JSON.parse(payload);
          } catch {
            continue;
          }

          if (json.error) throw new Error(json.error);
          if (json.delta) {
            setMessages((prev) => {
              return prev.map((msg) => {
                if (msg.id === assistantMessageId) {
                  return {
                    ...msg,
                    content: msg.content + String(json.delta),
                  };
                }
                return msg;
              });
            });
          }
        }
      }
    } catch (e) {
      console.error(e);
      setMessages((prev) => [
        ...prev,
        {
          role: "Shaz",
          content: "Sorry, something went wrong. Please try again.",
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

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-900/80 backdrop-blur-sm">
        <div className="flex items-center space-x-3">
          <motion.div
            initial={{ scale: 0.8, rotate: -30 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full"
          >
            <BsRobot className="text-2xl" />
          </motion.div>
          <div>
            <h1 className="text-xl font-bold">ShahmirBot</h1>
            <p className="text-sm text-gray-400">
              {isTyping ? "Typing..." : "Ask me anything"}
            </p>
          </div>
        </div>
        <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="px-3 py-1 text-sm bg-gray-800 rounded-full"
        >
          Online
        </motion.div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
        <AnimatePresence>
          {messages.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center h-full text-center text-gray-400"
            >
              <motion.div
                animate={{
                  y: [0, -10, 0],
                }}
                transition={{
                  repeat: Infinity,
                  duration: 3,
                  ease: "easeInOut",
                }}
                className="mb-6 p-5 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full"
              >
                <BsRobot className="text-4xl" />
              </motion.div>
              <h2 className="text-2xl font-bold text-white mb-2">
                Hello! I'm your AI Shaz
              </h2>
              <p className="max-w-md">
                Ask me anything and I'll do my best to help you with your
                questions.
              </p>
              <div className="mt-6 grid grid-cols-2 gap-3 w-full max-w-md">
                {[
                  "Who is Shahmir?",
                  "How does AI work?",
                  "Write a poem",
                  "Explain quantum computing",
                ].map((suggestion, i) => (
                  <motion.button
                    key={i}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setInput(suggestion)}
                    className="p-3 bg-gray-800 rounded-lg text-sm text-left hover:bg-gray-700 transition-colors"
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
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center space-x-2 p-4 bg-gray-800 rounded-2xl rounded-tl-sm max-w-md"
          >
            <div className="p-2 bg-blue-600 rounded-full">
              <FiUser className="text-lg" />
            </div>
            <div className="flex space-x-1.5">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.5, 1, 0.5],
                  }}
                  transition={{
                    repeat: Infinity,
                    duration: 1.5,
                    delay: i * 0.2,
                  }}
                  className="w-2 h-2 bg-gray-400 rounded-full"
                />
              ))}
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-gray-700 bg-gray-900/50 backdrop-blur-sm">
        <motion.div className="flex items-center space-x-3" layout>
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex-shrink-0"
          >
            <button className="p-3 bg-gray-800 rounded-full hover:bg-gray-700 transition-colors">
              <FiUser className="text-xl" />
            </button>
          </motion.div>

          <div className="flex-1 relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
              placeholder="Type your message here..."
              className="w-full p-4 pr-12 bg-gray-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              disabled={loading}
              rows={1}
            />
            {input && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setInput("")}
                className="absolute right-16 top-1/2 transform -translate-y-1/2 p-1 text-gray-400 hover:text-white"
              >
                <FiX />
              </motion.button>
            )}
          </div>

          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex-shrink-0"
          >
            {loading ? (
              <button
                onClick={stop}
                className="p-4 bg-red-600 rounded-full hover:bg-red-700 transition-colors"
              >
                <BsStopCircle className="text-xl" />
              </button>
            ) : (
              <button
                onClick={send}
                disabled={!input.trim()}
                className={`p-4 rounded-full transition-colors ${
                  input.trim()
                    ? "bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                    : "bg-gray-700 cursor-not-allowed"
                }`}
              >
                <BsSendFill className="text-xl" />
              </button>
            )}
          </motion.div>
        </motion.div>

        <div className="mt-3 text-xs text-gray-500 text-center">
          Gemini AI can make mistakes. Consider checking important information.
        </div>
      </div>
    </div>
  );
};

const MessageBubble = ({ message, index }: { message: any; index: number }) => {
  const isUser = message.role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`flex items-start space-x-3 max-w-[80%] ${
          isUser ? "flex-row-reverse space-x-reverse" : ""
        }`}
      >
        <div
          className={`flex-shrink-0 p-2 rounded-full ${
            isUser ? "bg-blue-600" : "bg-purple-600"
          }`}
        >
          {isUser ? (
            <FiUser className="text-lg" />
          ) : (
            <FiUser className="text-lg" />
          )}
        </div>

        <motion.div
          whileHover={{ scale: 1.01 }}
          className={`p-4 rounded-3xl ${
            isUser ? "bg-blue-600 rounded-br-md" : "bg-gray-800 rounded-bl-md"
          }`}
        >
          <div className="whitespace-pre-wrap">{message.content}</div>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default Chat;
