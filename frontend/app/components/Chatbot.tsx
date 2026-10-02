"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

export interface ChatMessage {
  id: string;
  sender: "user" | "bot" | "system";
  text: string;
  timestamp: string;
  type?: string;
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
  };
}

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<
    "connecting" | "connected" | "disconnected"
  >("disconnected");

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

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
      setConnectionStatus("disconnected");
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
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [messages, isTyping, isOpen]);

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
          text: "Connection offline. Reconnecting to chat service...",
          timestamp: new Date().toISOString(),
        },
      ]);
      connectWebSocket();
    }
  };

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
        </p>
      );
    });
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
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
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                id="chatbot-clear-button"
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
                id="chatbot-close-button"
                onClick={() => setIsOpen(false)}
                title="Close chat"
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 text-xs transition"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Messages */}
          <div id="chatbot-messages-container" className="flex-1 overflow-y-auto p-3 space-y-3">
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
                          className="px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-[10px] text-neutral-300 transition cursor-pointer"
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
                        className="px-2.5 py-0.5 rounded-full bg-neutral-900 border border-neutral-700 hover:border-teal-500 hover:text-teal-300 text-[10px] text-neutral-300 transition cursor-pointer"
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
                placeholder="Ask about products, categories..."
                className="flex-1 bg-neutral-950 border border-neutral-800 focus:border-teal-500 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 outline-none transition"
              />
              <button
                id="chatbot-send-button"
                onClick={() => handleSendMessage()}
                disabled={!inputMessage.trim()}
                className="p-2 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold transition cursor-pointer"
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
        className="flex items-center justify-center w-12 h-12 rounded-full bg-teal-600 hover:bg-teal-500 text-white shadow-lg transition-transform hover:scale-105 active:scale-95 cursor-pointer"
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
        )}
      </button>
    </div>
  );
}
