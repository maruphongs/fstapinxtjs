"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";

export interface ChatMessage {
  id: string;
  sender: "user" | "bot" | "system";
  text: string;
  timestamp: string;
  type?: "text" | "welcome" | "help" | "products" | "categories" | "stats" | "graphql" | "system";
  suggestions?: string[];
  data?: {
    products?: Array<{
      id: number;
      name: string;
      price: number;
      description: string;
      categories?: string[];
    }>;
    categories?: Array<{
      id: number;
      name: string;
      productCount: number;
    }>;
    productsCount?: number;
    categoriesCount?: number;
    usersCount?: number;
    category?: string;
  };
}

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<
    "connecting" | "connected" | "disconnected" | "error"
  >("disconnected");
  const [unreadCount, setUnreadCount] = useState(0);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Determine WebSocket URL dynamically based on environment
  const getWebSocketUrl = useCallback(() => {
    if (process.env.NEXT_PUBLIC_WS_URL) {
      return process.env.NEXT_PUBLIC_WS_URL;
    }
    if (typeof window !== "undefined") {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const hostname = window.location.hostname || "127.0.0.1";
      return `${protocol}//${hostname}:8000/ws/chat`;
    }
    return "ws://127.0.0.1:8000/ws/chat";
  }, []);

  const connectWebSocket = useCallback(() => {
    if (socketRef.current && (socketRef.current.readyState === WebSocket.OPEN || socketRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    setConnectionStatus("connecting");
    const wsUrl = getWebSocketUrl();

    try {
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        setConnectionStatus("connected");
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === "typing") {
            setIsTyping(Boolean(data.isTyping));
            return;
          }

          const incomingMsg: ChatMessage = {
            id: data.id || `msg-${Date.now()}-${Math.random()}`,
            sender: data.sender || "bot",
            text: data.text || "",
            timestamp: data.timestamp || new Date().toISOString(),
            type: data.type || "text",
            suggestions: data.suggestions || [],
            data: data.data || undefined,
          };

          setMessages((prev) => [...prev, incomingMsg]);

          // Increment unread count if chat window is closed
          setIsOpen((currentOpen) => {
            if (!currentOpen) {
              setUnreadCount((c) => c + 1);
            }
            return currentOpen;
          });
        } catch {
          // Plain text fallback
          const textMsg: ChatMessage = {
            id: `msg-${Date.now()}`,
            sender: "bot",
            text: event.data,
            timestamp: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, textMsg]);
        }
      };

      ws.onerror = () => {
        setConnectionStatus("error");
      };

      ws.onclose = () => {
        setConnectionStatus("disconnected");
        socketRef.current = null;

        // Auto-reconnect after 3 seconds
        if (!reconnectTimeoutRef.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectTimeoutRef.current = null;
            connectWebSocket();
          }, 3000);
        }
      };
    } catch {
      setConnectionStatus("error");
    }
  }, [getWebSocketUrl]);

  // Connect on mount
  useEffect(() => {
    connectWebSocket();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [connectWebSocket]);

  // Scroll to bottom when messages update
  useEffect(() => {
    if (isOpen && !isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isTyping, isOpen, isMinimized]);

  // Focus input when chat opened
  useEffect(() => {
    if (isOpen && !isMinimized) {
      setUnreadCount(0);
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, isMinimized]);

  const handleSendMessage = (textToSend?: string) => {
    const text = (textToSend ?? inputMessage).trim();
    if (!text) return;

    // Check for clear command client-side
    if (text.toLowerCase() === "/clear") {
      setMessages([]);
      setInputMessage("");
      return;
    }

    // Add user message to UI
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: text,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputMessage("");

    // Send to WebSocket
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ text }));
    } else {
      // Offline fallback notification
      const errorMsg: ChatMessage = {
        id: `sys-${Date.now()}`,
        sender: "system",
        text: "⚠️ Disconnected from chat server. Attempting to reconnect...",
        timestamp: new Date().toISOString(),
        type: "system",
      };
      setMessages((prev) => [...prev, errorMsg]);
      connectWebSocket();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTimestamp = (ts: string) => {
    try {
      const d = new Date(ts);
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  // Helper to render markdown-like snippets (bold, inline code, links, line breaks)
  const renderFormattedText = (content: string) => {
    const lines = content.split("\n");

    return lines.map((line, idx) => {
      // Header 3
      if (line.startsWith("### ")) {
        return (
          <h4 key={idx} className="font-semibold text-teal-400 mt-2 mb-1 text-sm">
            {line.replace("### ", "")}
          </h4>
        );
      }

      // Bullet points
      if (line.startsWith("- ")) {
        const bulletContent = line.replace("- ", "");
        return (
          <div key={idx} className="flex items-start gap-1.5 ml-1 my-0.5 text-xs text-neutral-300">
            <span className="text-teal-400 font-bold">•</span>
            <span>{parseInlineFormatting(bulletContent)}</span>
          </div>
        );
      }

      // Code block lines
      if (line.startsWith("```")) {
        return null;
      }

      if (!line.trim()) {
        return <div key={idx} className="h-1.5" />;
      }

      return (
        <p key={idx} className="text-xs leading-relaxed text-neutral-200">
          {parseInlineFormatting(line)}
        </p>
      );
    });
  };

  const parseInlineFormatting = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={i} className="font-semibold text-white">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return (
          <code
            key={i}
            className="rounded bg-neutral-800 border border-neutral-700 px-1 py-0.5 font-mono text-[11px] text-teal-300"
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      return part;
    });
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {/* Chat Window Panel */}
      {isOpen && (
        <div
          id="chatbot-window"
          className={`mb-3 w-[92vw] sm:w-[410px] max-w-md transition-all duration-300 ease-out origin-bottom-right shadow-2xl rounded-2xl border border-teal-500/30 bg-neutral-950/95 backdrop-blur-xl flex flex-col text-neutral-100 ${
            isMinimized ? "h-14 overflow-hidden" : "h-[540px] max-h-[82vh]"
          }`}
          style={{
            boxShadow: "0 10px 30px -10px rgba(0, 150, 136, 0.3), 0 20px 40px -15px rgba(0, 0, 0, 0.9)",
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800 bg-neutral-900/80 rounded-t-2xl">
            <div className="flex items-center gap-3">
              <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-teal-500/20 border border-teal-500/40 text-teal-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                  />
                </svg>
                {/* Status Dot */}
                <span
                  className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-neutral-950 ${
                    connectionStatus === "connected"
                      ? "bg-emerald-500 animate-pulse"
                      : connectionStatus === "connecting"
                      ? "bg-amber-500 animate-ping"
                      : "bg-rose-500"
                  }`}
                  title={`WebSocket: ${connectionStatus}`}
                />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
                  UniWeb Assistant
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-teal-500/20 text-teal-300 font-mono">
                    WS
                  </span>
                </h3>
                <p className="text-[11px] text-neutral-400 flex items-center gap-1">
                  {connectionStatus === "connected" ? (
                    <span className="text-emerald-400">Connected</span>
                  ) : connectionStatus === "connecting" ? (
                    <span className="text-amber-400">Connecting...</span>
                  ) : (
                    <span className="text-rose-400">Disconnected</span>
                  )}
                </p>
              </div>
            </div>

            {/* Header Action Buttons */}
            <div className="flex items-center gap-1">
              {/* Clear messages */}
              <button
                id="chatbot-clear-button"
                onClick={() => setMessages([])}
                title="Clear conversation"
                className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.75}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>

              {/* Minimize/Expand */}
              <button
                id="chatbot-minimize-button"
                onClick={() => setIsMinimized((prev) => !prev)}
                title={isMinimized ? "Expand" : "Minimize"}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition"
              >
                {isMinimized ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                )}
              </button>

              {/* Close */}
              <button
                id="chatbot-close-button"
                onClick={() => setIsOpen(false)}
                title="Close chat"
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Collapsible Content */}
          {!isMinimized && (
            <>
              {/* Disconnection Warning Banner if not connected */}
              {connectionStatus !== "connected" && (
                <div className="flex items-center justify-between px-3 py-1.5 bg-rose-950/70 border-b border-rose-800/40 text-rose-300 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                    <span>WebSocket {connectionStatus}</span>
                  </div>
                  <button
                    onClick={connectWebSocket}
                    className="text-[11px] underline font-medium hover:text-white"
                  >
                    Retry now
                  </button>
                </div>
              )}

              {/* Message List */}
              <div
                id="chatbot-messages-container"
                className="flex-1 overflow-y-auto p-3.5 space-y-3 scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-transparent"
              >
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-center text-neutral-500 py-8 px-4">
                    <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 mb-3">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                        />
                      </svg>
                    </div>
                    <p className="text-xs text-neutral-300 font-medium">Ready to chat over WebSocket</p>
                    <p className="text-[11px] text-neutral-500 mt-1 max-w-[220px]">
                      Ask about products, categories, or try a command below.
                    </p>
                  </div>
                )}

                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
                  >
                    {/* Bubble */}
                    <div
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs shadow-sm ${
                        msg.sender === "user"
                          ? "bg-gradient-to-r from-teal-600 to-teal-500 text-white rounded-br-none"
                          : msg.sender === "system"
                          ? "bg-rose-900/40 border border-rose-700/50 text-rose-200"
                          : "bg-neutral-900 border border-neutral-800 text-neutral-200 rounded-bl-none"
                      }`}
                    >
                      {/* Formatted Text Content */}
                      <div>{renderFormattedText(msg.text)}</div>

                      {/* Structured Product Cards */}
                      {msg.data?.products && msg.data.products.length > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-neutral-800 space-y-1.5">
                          {msg.data.products.slice(0, 4).map((p) => (
                            <div
                              key={p.id}
                              className="p-2 rounded-lg bg-neutral-950/80 border border-neutral-800 hover:border-teal-500/40 transition group"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold text-white truncate text-[11px] group-hover:text-teal-400 transition">
                                  {p.name}
                                </span>
                                <span className="font-mono text-[11px] font-bold text-teal-400">
                                  ${p.price.toFixed(2)}
                                </span>
                              </div>
                              {p.description && (
                                <p className="text-[10px] text-neutral-400 line-clamp-1 mt-0.5">
                                  {p.description}
                                </p>
                              )}
                              {p.categories && p.categories.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                  {p.categories.map((cat, ci) => (
                                    <span
                                      key={ci}
                                      className="text-[9px] px-1.5 py-0.5 rounded bg-teal-950/80 text-teal-300 border border-teal-800/40"
                                    >
                                      {cat}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                          <div className="pt-1 flex justify-end">
                            <Link
                              href="/products"
                              className="text-[10px] text-teal-400 hover:underline flex items-center gap-1 font-medium"
                            >
                              Manage all in Products Page →
                            </Link>
                          </div>
                        </div>
                      )}

                      {/* Structured Categories Chips */}
                      {msg.data?.categories && msg.data.categories.length > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-neutral-800">
                          <div className="flex flex-wrap gap-1.5">
                            {msg.data.categories.map((cat) => (
                              <button
                                key={cat.id}
                                onClick={() => handleSendMessage(`Category ${cat.name}`)}
                                className="flex items-center gap-1 px-2 py-1 rounded-md bg-neutral-800/80 hover:bg-teal-900/60 border border-neutral-700 hover:border-teal-500/50 text-[10px] text-neutral-200 hover:text-teal-300 transition"
                              >
                                <span>{cat.name}</span>
                                <span className="text-[9px] px-1 rounded-full bg-neutral-700 text-neutral-300">
                                  {cat.productCount}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Timestamp */}
                      <div
                        className={`text-[9px] mt-1 flex ${
                          msg.sender === "user"
                            ? "text-teal-100 justify-end"
                            : "text-neutral-500 justify-start"
                        }`}
                      >
                        {formatTimestamp(msg.timestamp)}
                      </div>
                    </div>

                    {/* Suggestion Chips */}
                    {msg.suggestions && msg.suggestions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2 ml-1">
                        {msg.suggestions.map((suggestion, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleSendMessage(suggestion.replace(/^[^a-zA-Z0-9/]+/, ""))}
                            className="px-2.5 py-1 rounded-full bg-neutral-900/90 border border-teal-500/30 hover:border-teal-400 hover:bg-teal-950/50 text-[10px] text-teal-300 transition hover:scale-102 cursor-pointer shadow-sm"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {/* Typing indicator */}
                {isTyping && (
                  <div className="flex items-center gap-1.5 bg-neutral-900 border border-neutral-800 rounded-2xl px-3.5 py-2.5 w-fit rounded-bl-none text-neutral-400">
                    <span className="text-[11px] text-teal-400 font-medium">Assistant thinking</span>
                    <span className="flex gap-1 ml-1">
                      <span className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Quick Prompt Bar */}
              <div className="px-3 py-1.5 border-t border-neutral-800/80 bg-neutral-950/60 flex items-center gap-1.5 overflow-x-auto text-[10px] text-neutral-400">
                <span className="text-neutral-500 uppercase tracking-wider text-[9px] font-mono">Quick:</span>
                <button
                  onClick={() => handleSendMessage("/products")}
                  className="px-2 py-0.5 rounded bg-neutral-900 hover:bg-neutral-800 hover:text-white transition border border-neutral-800"
                >
                  /products
                </button>
                <button
                  onClick={() => handleSendMessage("/categories")}
                  className="px-2 py-0.5 rounded bg-neutral-900 hover:bg-neutral-800 hover:text-white transition border border-neutral-800"
                >
                  /categories
                </button>
                <button
                  onClick={() => handleSendMessage("/stats")}
                  className="px-2 py-0.5 rounded bg-neutral-900 hover:bg-neutral-800 hover:text-white transition border border-neutral-800"
                >
                  /stats
                </button>
                <button
                  onClick={() => handleSendMessage("/graphql")}
                  className="px-2 py-0.5 rounded bg-neutral-900 hover:bg-neutral-800 hover:text-white transition border border-neutral-800"
                >
                  /graphql
                </button>
              </div>

              {/* Input Area */}
              <div className="p-3 border-t border-neutral-800 bg-neutral-900/90 rounded-b-2xl">
                <div className="flex items-center gap-2">
                  <input
                    ref={inputRef}
                    id="chatbot-input"
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask about products, categories, or type /help..."
                    className="flex-1 bg-neutral-950 border border-neutral-800 focus:border-teal-500 focus:ring-1 focus:ring-teal-500/40 rounded-xl px-3.5 py-2 text-xs text-white placeholder-neutral-500 outline-none transition"
                  />
                  <button
                    id="chatbot-send-button"
                    onClick={() => handleSendMessage()}
                    disabled={!inputMessage.trim()}
                    className="p-2 rounded-xl bg-teal-500 hover:bg-teal-600 disabled:opacity-40 disabled:cursor-not-allowed text-white shadow-md shadow-teal-500/20 transition-all hover:scale-105 active:scale-95 flex items-center justify-center"
                    title="Send message (Enter)"
                  >
                    <svg className="w-4 h-4 transform rotate-90" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                    </svg>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Floating Launcher Action Button */}
      <button
        id="chatbot-toggle-button"
        onClick={() => {
          setIsOpen((prev) => !prev);
          if (isMinimized) setIsMinimized(false);
        }}
        className={`group relative flex items-center justify-center w-14 h-14 rounded-full shadow-xl transition-all duration-300 ease-out hover:scale-105 active:scale-95 ${
          isOpen
            ? "bg-neutral-900 border border-teal-500/50 text-teal-400"
            : "bg-gradient-to-tr from-teal-600 to-teal-500 text-white shadow-teal-500/30"
        }`}
        style={{
          boxShadow: isOpen
            ? "0 0 20px rgba(0, 150, 136, 0.4)"
            : "0 8px 25px rgba(0, 150, 136, 0.45)",
        }}
        aria-label="Toggle UniWeb Chatbot"
      >
        {/* Unread badge */}
        {!isOpen && unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-lg animate-pulse">
            {unreadCount}
          </span>
        )}

        {isOpen ? (
          <svg className="w-6 h-6 transition-transform duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <div className="relative">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
              />
            </svg>
            {/* Pulsing indicator ring */}
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-teal-600" />
          </div>
        )}

        {/* Hover Tooltip when closed */}
        {!isOpen && (
          <span className="absolute right-16 px-2.5 py-1 rounded-lg bg-neutral-900 border border-neutral-800 text-[11px] font-medium text-neutral-200 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
            Chat with Assistant
          </span>
        )}
      </button>
    </div>
  );
}
