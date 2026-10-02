"use client";

<<<<<<< HEAD
import React, { useEffect, useRef, useState, useCallback } from "react";
=======
import React, { useCallback, useEffect, useRef, useState } from "react";
>>>>>>> 4682ba6 (Assignment 8: UploadFile)
import Link from "next/link";

export interface ChatMessage {
  id: string;
  sender: "user" | "bot" | "system";
  text: string;
  timestamp: string;
<<<<<<< HEAD
  type?: "text" | "welcome" | "help" | "products" | "categories" | "stats" | "graphql" | "system";
=======
  type?: string;
>>>>>>> 4682ba6 (Assignment 8: UploadFile)
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
<<<<<<< HEAD
    category?: string;
=======
>>>>>>> 4682ba6 (Assignment 8: UploadFile)
  };
}

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
<<<<<<< HEAD
  const [isMinimized, setIsMinimized] = useState(false);
=======
>>>>>>> 4682ba6 (Assignment 8: UploadFile)
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<
<<<<<<< HEAD
    "connecting" | "connected" | "disconnected" | "error"
  >("disconnected");
  const [unreadCount, setUnreadCount] = useState(0);
=======
    "connecting" | "connected" | "disconnected"
  >("disconnected");
>>>>>>> 4682ba6 (Assignment 8: UploadFile)

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

<<<<<<< HEAD
  // WebSocket URL calculation
=======
>>>>>>> 4682ba6 (Assignment 8: UploadFile)
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
    if (
      socketRef.current &&
      (socketRef.current.readyState === WebSocket.OPEN ||
        socketRef.current.readyState === WebSocket.CONNECTING)
    ) {
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
<<<<<<< HEAD

          setIsOpen((currentOpen) => {
            if (!currentOpen) {
              setUnreadCount((c) => c + 1);
            }
            return currentOpen;
          });
        } catch {
          const textMsg: ChatMessage = {
            id: `msg-${Date.now()}`,
            sender: "bot",
            text: event.data,
            timestamp: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, textMsg]);
        }
      };

      ws.onerror = () => setConnectionStatus("error");
=======
        } catch {
          setMessages((prev) => [
            ...prev,
            {
              id: `msg-${Date.now()}`,
              sender: "bot",
              text: event.data,
              timestamp: new Date().toISOString(),
            },
          ]);
        }
      };

      ws.onerror = () => setConnectionStatus("disconnected");
>>>>>>> 4682ba6 (Assignment 8: UploadFile)

      ws.onclose = () => {
        setConnectionStatus("disconnected");
        socketRef.current = null;

        if (!reconnectTimeoutRef.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectTimeoutRef.current = null;
            connectWebSocket();
          }, 3000);
        }
      };
    } catch {
<<<<<<< HEAD
      setConnectionStatus("error");
=======
      setConnectionStatus("disconnected");
>>>>>>> 4682ba6 (Assignment 8: UploadFile)
    }
  }, [getWebSocketUrl]);

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (socketRef.current) socketRef.current.close();
    };
  }, [connectWebSocket]);

  useEffect(() => {
<<<<<<< HEAD
    if (isOpen && !isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isTyping, isOpen, isMinimized]);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      setUnreadCount(0);
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, isMinimized]);
=======
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [messages, isTyping, isOpen]);
>>>>>>> 4682ba6 (Assignment 8: UploadFile)

  const handleSendMessage = (textToSend?: string) => {
    const text = (textToSend ?? inputMessage).trim();
    if (!text) return;

    if (text.toLowerCase() === "/clear") {
      setMessages([]);
      setInputMessage("");
      return;
    }

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: "user",
      text,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputMessage("");

    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ text }));
    } else {
      setMessages((prev) => [
        ...prev,
        {
          id: `sys-${Date.now()}`,
          sender: "system",
<<<<<<< HEAD
          text: "🔌 Oopsie! WebSocket disconnected. Reconnecting... 🏃‍♂️",
=======
          text: "Connection offline. Reconnecting to chat service...",
>>>>>>> 4682ba6 (Assignment 8: UploadFile)
          timestamp: new Date().toISOString(),
        },
      ]);
      connectWebSocket();
    }
  };

<<<<<<< HEAD
  const parseInline = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={i} className="font-bold text-white">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return (
          <code
            key={i}
            className="rounded bg-neutral-800 border border-teal-500/20 px-1 py-0.5 font-mono text-[11px] text-teal-300"
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      return part;
    });
  };

  const renderContent = (content: string) => {
    return content.split("\n").map((line, idx) => {
      if (line.startsWith("### ")) {
        return (
          <h4 key={idx} className="font-bold text-teal-400 mt-2 mb-1 text-xs">
            {line.replace("### ", "")}
          </h4>
        );
      }
      if (line.startsWith("- ")) {
        return (
          <div key={idx} className="flex items-start gap-1.5 ml-1 my-0.5 text-xs text-neutral-300">
            <span className="text-teal-400 font-bold">👉</span>
            <span>{parseInline(line.replace("- ", ""))}</span>
          </div>
        );
      }
      if (line.startsWith("```")) return null;
      if (!line.trim()) return <div key={idx} className="h-1.5" />;
      return (
        <p key={idx} className="text-xs leading-relaxed text-neutral-200">
          {parseInline(line)}
=======
  const renderMessageContent = (text: string) => {
    return text.split("\n").map((line, idx) => {
      if (!line.trim()) return <div key={idx} className="h-1.5" />;
      const parts = line.split(/(\*\*.*?\*\*|`.*?`)/g);
      const renderedParts = parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={i} className="font-semibold text-white">
              {part.slice(2, -2)}
            </strong>
          );
        }
        if (part.startsWith("`") && part.endsWith("`")) {
          return (
            <code key={i} className="rounded bg-neutral-800 px-1 py-0.5 font-mono text-[11px] text-teal-300">
              {part.slice(1, -1)}
            </code>
          );
        }
        return part;
      });

      return (
        <p key={idx} className="text-xs leading-relaxed">
          {renderedParts}
>>>>>>> 4682ba6 (Assignment 8: UploadFile)
        </p>
      );
    });
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
<<<<<<< HEAD
      {/* Silly Chat Window */}
      {isOpen && (
        <div
          id="chatbot-window"
          className={`mb-3 w-[92vw] sm:w-[390px] max-w-sm transition-all duration-200 ease-out origin-bottom-right shadow-2xl rounded-2xl border-2 border-teal-500/40 bg-neutral-950/95 backdrop-blur-xl flex flex-col text-neutral-100 ${
            isMinimized ? "h-14 overflow-hidden" : "h-[510px] max-h-[80vh]"
          }`}
          style={{
            boxShadow: "0 0 25px rgba(0, 150, 136, 0.3), 0 20px 40px rgba(0,0,0,0.8)",
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-neutral-800 bg-neutral-900/90 rounded-t-2xl">
            <div className="flex items-center gap-2.5">
              <span className="text-2xl animate-bounce" style={{ animationDuration: "2s" }}>
                🤪
              </span>
              <div>
                <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                  SillyBot 3000
                  <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-teal-500/30 text-teal-300 font-mono font-bold">
                    WS
                  </span>
                </h3>
                <p className="text-[10px] text-neutral-400 flex items-center gap-1">
                  {connectionStatus === "connected" ? (
                    <span className="text-emerald-400 font-medium">● 0% AI • 100% vibes</span>
                  ) : connectionStatus === "connecting" ? (
                    <span className="text-amber-400 font-medium">● connecting...</span>
                  ) : (
                    <span className="text-rose-400 font-medium">● offline (sleeping 💤)</span>
                  )}
=======
      {isOpen && (
        <div
          id="chatbot-window"
          className="mb-3 w-[92vw] sm:w-[380px] max-w-sm h-[480px] max-h-[80vh] shadow-2xl rounded-2xl border border-neutral-800 bg-neutral-950 text-neutral-100 flex flex-col overflow-hidden"
          style={{ boxShadow: "0 10px 30px rgba(0,0,0,0.5)" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800 bg-neutral-900">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-teal-600 flex items-center justify-center text-white text-sm font-bold">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                  Store Assistant
                </h3>
                <p className="text-[10px] text-neutral-400 flex items-center gap-1">
                  <span
                    className={`inline-block w-1.5 h-1.5 rounded-full ${
                      connectionStatus === "connected"
                        ? "bg-emerald-400"
                        : connectionStatus === "connecting"
                        ? "bg-amber-400"
                        : "bg-rose-400"
                    }`}
                  />
                  {connectionStatus === "connected"
                    ? "Online"
                    : connectionStatus === "connecting"
                    ? "Connecting..."
                    : "Offline"}
>>>>>>> 4682ba6 (Assignment 8: UploadFile)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
<<<<<<< HEAD
                id="chatbot-clear-button"
                onClick={() => setMessages([])}
                title="Wipe brain memory (/clear)"
                className="p-1 rounded text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 text-xs transition"
              >
                🧹
              </button>
              <button
                id="chatbot-minimize-button"
                onClick={() => setIsMinimized((prev) => !prev)}
                title={isMinimized ? "Expand" : "Minimize"}
                className="p-1 rounded text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 text-xs transition"
              >
                {isMinimized ? "🔼" : "🔽"}
              </button>
              <button
                id="chatbot-close-button"
                onClick={() => setIsOpen(false)}
                title="Bye bye!"
                className="p-1 rounded text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 text-xs transition"
              >
                ❌
=======
                onClick={() => setMessages([])}
                title="Clear chat"
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 text-xs transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
              <button
                onClick={() => setIsOpen(false)}
                title="Close chat"
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 text-xs transition"
              >
                ✕
>>>>>>> 4682ba6 (Assignment 8: UploadFile)
              </button>
            </div>
          </div>

<<<<<<< HEAD
          {!isMinimized && (
            <>
              {/* Message History */}
              <div
                id="chatbot-messages-container"
                className="flex-1 overflow-y-auto p-3 space-y-2.5 scrollbar-thin scrollbar-thumb-neutral-800"
              >
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-center text-neutral-500 py-6 px-4">
                    <span className="text-4xl mb-2">🤖✨</span>
                    <p className="text-xs text-neutral-300 font-bold">SillyBot is awake!</p>
                    <p className="text-[11px] text-neutral-500 mt-0.5">
                      Say &quot;products&quot;, &quot;stats&quot;, or click a silly button!
                    </p>
                  </div>
                )}

                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs shadow-sm ${
                        msg.sender === "user"
                          ? "bg-teal-600 text-white rounded-br-none font-medium"
                          : msg.sender === "system"
                          ? "bg-rose-950/70 border border-rose-800/60 text-rose-200"
                          : "bg-neutral-900 border border-neutral-800 text-neutral-200 rounded-bl-none"
                      }`}
                    >
                      <div>{renderContent(msg.text)}</div>

                      {/* Silly mini product cards */}
                      {msg.data?.products && msg.data.products.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-neutral-800 space-y-1.5">
                          {msg.data.products.slice(0, 3).map((p) => (
                            <div
                              key={p.id}
                              className="p-1.5 rounded-lg bg-neutral-950 border border-neutral-800 hover:border-teal-500/50 transition flex items-center justify-between gap-2"
                            >
                              <div className="truncate">
                                <span className="font-bold text-white text-[11px]">{p.name}</span>
                                <span className="text-[9px] text-neutral-400 block truncate">
                                  {p.description}
                                </span>
                              </div>
                              <span className="font-mono text-[11px] font-bold text-teal-400 whitespace-nowrap">
                                ${p.price.toFixed(2)}
                              </span>
                            </div>
                          ))}
                          <div className="pt-0.5 flex justify-end">
                            <Link
                              href="/products"
                              className="text-[10px] text-teal-400 hover:underline font-bold"
                            >
                              Inspect all loot in Products →
                            </Link>
                          </div>
                        </div>
                      )}

                      {/* Categories badges */}
                      {msg.data?.categories && msg.data.categories.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-neutral-800 flex flex-wrap gap-1">
                          {msg.data.categories.map((cat) => (
                            <button
                              key={cat.id}
                              onClick={() => handleSendMessage(`category ${cat.name}`)}
                              className="px-2 py-0.5 rounded-md bg-neutral-800 hover:bg-teal-900/60 border border-neutral-700 hover:border-teal-400 text-[10px] text-neutral-200 hover:text-teal-300 transition cursor-pointer"
                            >
                              {cat.name} ({cat.productCount})
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Silly Suggestion Chips */}
                    {msg.suggestions && msg.suggestions.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5 ml-1">
                        {msg.suggestions.map((suggestion, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleSendMessage(suggestion)}
                            className="px-2.5 py-0.5 rounded-full bg-neutral-900 border border-teal-500/30 hover:border-teal-400 hover:bg-teal-950/60 text-[10px] text-teal-300 font-medium transition hover:scale-105 active:scale-95 cursor-pointer"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {/* Silly Typing Animation */}
                {isTyping && (
                  <div className="flex items-center gap-1.5 bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-1.5 w-fit rounded-bl-none text-neutral-400 text-[11px]">
                    <span>Thinking very hard</span>
                    <span className="flex gap-1">
                      <span className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Quick Silly Actions Bar */}
              <div className="px-3 py-1 bg-neutral-950/90 border-t border-neutral-800/60 flex items-center gap-1 overflow-x-auto text-[10px]">
                <button
                  onClick={() => handleSendMessage("/products")}
                  className="px-2 py-0.5 rounded bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-800 whitespace-nowrap"
                >
                  🛍️ Loot
                </button>
                <button
                  onClick={() => handleSendMessage("/categories")}
                  className="px-2 py-0.5 rounded bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-800 whitespace-nowrap"
                >
                  📦 Buckets
                </button>
                <button
                  onClick={() => handleSendMessage("/stats")}
                  className="px-2 py-0.5 rounded bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-800 whitespace-nowrap"
                >
                  🧠 Stats
                </button>
                <button
                  onClick={() => handleSendMessage("quack")}
                  className="px-2 py-0.5 rounded bg-neutral-900 hover:bg-neutral-800 text-teal-300 border border-teal-800/40 whitespace-nowrap"
                >
                  🦆 Quack
                </button>
                <button
                  onClick={() => handleSendMessage("do not click")}
                  className="px-2 py-0.5 rounded bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 whitespace-nowrap font-bold"
                >
                  💣 DO NOT CLICK
                </button>
              </div>

              {/* Input Box */}
              <div className="p-2.5 border-t border-neutral-800 bg-neutral-900/90 rounded-b-2xl">
                <div className="flex items-center gap-1.5">
                  <input
                    ref={inputRef}
                    id="chatbot-input"
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder="Ask for loot, stats, or say quack..."
                    className="flex-1 bg-neutral-950 border border-neutral-800 focus:border-teal-500 rounded-xl px-3 py-1.5 text-xs text-white placeholder-neutral-500 outline-none transition"
                  />
                  <button
                    id="chatbot-send-button"
                    onClick={() => handleSendMessage()}
                    disabled={!inputMessage.trim()}
                    className="p-1.5 px-3 rounded-xl bg-teal-500 hover:bg-teal-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition hover:scale-105 active:scale-95"
                    title="Send message"
                  >
                    🚀
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Silly Floating Action Button */}
      <button
        id="chatbot-toggle-button"
        onClick={() => {
          setIsOpen((prev) => !prev);
          if (isMinimized) setIsMinimized(false);
        }}
        className={`group relative flex items-center justify-center w-14 h-14 rounded-full shadow-2xl transition-all duration-300 hover:scale-110 active:scale-90 ${
          isOpen
            ? "bg-neutral-900 border-2 border-teal-500 text-2xl"
            : "bg-gradient-to-tr from-teal-500 to-teal-400 text-2xl shadow-teal-500/40 hover:rotate-12"
        }`}
        style={{
          boxShadow: isOpen
            ? "0 0 20px rgba(0, 150, 136, 0.4)"
            : "0 8px 25px rgba(0, 150, 136, 0.5)",
        }}
        aria-label="Toggle SillyBot"
      >
        {!isOpen && unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow animate-bounce">
            {unreadCount}
          </span>
        )}

        {isOpen ? "❌" : "🤪"}

        {/* Silly tooltip on hover */}
        {!isOpen && (
          <span className="absolute right-16 px-2.5 py-1 rounded-lg bg-neutral-900 border border-teal-500/40 text-[11px] font-bold text-teal-300 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-xl">
            Talk to SillyBot 🤪
          </span>
=======
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center text-neutral-500 py-6">
                <svg className="w-10 h-10 mb-2 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
                <p className="text-xs font-semibold text-neutral-300">How can I help you?</p>
                <p className="text-[11px] text-neutral-500 mt-1">Ask about products, categories, or store stats.</p>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-xl px-3.5 py-2 text-xs leading-relaxed ${
                    msg.sender === "user"
                      ? "bg-teal-600 text-white rounded-br-xs"
                      : msg.sender === "system"
                      ? "bg-rose-950/60 border border-rose-900 text-rose-300"
                      : "bg-neutral-900 border border-neutral-800 text-neutral-200 rounded-bl-xs"
                  }`}
                >
                  <div>{renderMessageContent(msg.text)}</div>

                  {/* Optional Mini Product List */}
                  {msg.data?.products && msg.data.products.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-neutral-800 space-y-1.5">
                      {msg.data.products.slice(0, 3).map((p) => (
                        <div
                          key={p.id}
                          className="p-1.5 rounded bg-neutral-950 border border-neutral-800 flex items-center justify-between gap-2"
                        >
                          <div className="truncate">
                            <span className="font-semibold text-white text-[11px]">{p.name}</span>
                          </div>
                          <span className="font-mono text-[11px] font-semibold text-teal-400">
                            ${p.price.toFixed(2)}
                          </span>
                        </div>
                      ))}
                      <div className="pt-1 flex justify-end">
                        <Link href="/products" className="text-[10px] text-teal-400 hover:underline">
                          View all in Catalog →
                        </Link>
                      </div>
                    </div>
                  )}

                  {/* Optional Category Chips */}
                  {msg.data?.categories && msg.data.categories.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-neutral-800 flex flex-wrap gap-1">
                      {msg.data.categories.map((cat) => (
                        <button
                          key={cat.id}
                          onClick={() => handleSendMessage(`category ${cat.name}`)}
                          className="px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-[10px] text-neutral-300 transition"
                        >
                          {cat.name} ({cat.productCount})
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Suggestions */}
                {msg.suggestions && msg.suggestions.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5 ml-1">
                    {msg.suggestions.map((suggestion, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSendMessage(suggestion)}
                        className="px-2.5 py-0.5 rounded-full bg-neutral-900 border border-neutral-700 hover:border-teal-500 hover:text-teal-300 text-[10px] text-neutral-300 transition"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {isTyping && (
              <div className="flex items-center gap-1.5 bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-1.5 w-fit text-neutral-400 text-[11px]">
                <span>Assistant is typing</span>
                <span className="flex gap-1">
                  <span className="w-1 h-1 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1 h-1 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1 h-1 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Bar */}
          <div className="p-2.5 border-t border-neutral-800 bg-neutral-900">
            <div className="flex items-center gap-1.5">
              <input
                ref={inputRef}
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="Ask about products, categories..."
                className="flex-1 bg-neutral-950 border border-neutral-800 focus:border-teal-500 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 outline-none transition"
              />
              <button
                onClick={() => handleSendMessage()}
                disabled={!inputMessage.trim()}
                className="p-2 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold transition"
                title="Send message"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toggle Button */}
      <button
        id="chatbot-toggle-button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center justify-center w-12 h-12 rounded-full bg-teal-600 hover:bg-teal-500 text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
        aria-label="Toggle Store Assistant"
      >
        {isOpen ? (
          <span className="text-base font-bold">✕</span>
        ) : (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
            />
          </svg>
>>>>>>> 4682ba6 (Assignment 8: UploadFile)
        )}
      </button>
    </div>
  );
}
