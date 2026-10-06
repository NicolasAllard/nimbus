"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "ai/react";
import { Bot, Cloud, Loader2, RotateCcw, Send, User } from "lucide-react";
import { MODELS } from "@/models.config";
import { ModelSelector } from "@/components/ModelSelector";
import { MessageMetrics } from "@/components/MessageMetrics";
import { SessionSummary } from "@/components/SessionSummary";
import { SuggestedPrompts } from "@/components/SuggestedPrompts";
import { FormattedText } from "@/components/FormattedText";
import { isMetricsAnnotation, type MetricsAnnotation } from "@/lib/chat-types";

export default function ChatPage() {
  const [modelId, setModelId] = useState(MODELS[0].id);

  const { messages, input, handleInputChange, handleSubmit, isLoading, error, setMessages, append } = useChat({
    api: "/api/chat",
    body: { modelId },
  });

  const sessionTotals = useMemo(() => {
    let promptTokens = 0;
    let completionTokens = 0;
    let cost = 0;
    let messageCount = 0;

    for (const message of messages) {
      const metrics = message.annotations?.find(isMetricsAnnotation) as MetricsAnnotation | undefined;
      if (!metrics) continue;
      messageCount += 1;
      promptTokens += Number.isFinite(metrics.usage.promptTokens) ? metrics.usage.promptTokens : 0;
      completionTokens += Number.isFinite(metrics.usage.completionTokens) ? metrics.usage.completionTokens : 0;
      cost += Number.isFinite(metrics.cost) ? metrics.cost : 0;
    }

    return { promptTokens, completionTokens, cost, messageCount };
  }, [messages]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Keep the transcript pinned to the latest message while the answer streams in.
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [messages, isLoading]);

  const canSubmit = input.trim().length > 0 && !isLoading;

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    handleSubmit(event);
  }

  function onNewConversation() {
    setMessages([]);
  }

  function onSelectPrompt(prompt: string) {
    if (isLoading) return;
    void append({ role: "user", content: prompt });
  }

  return (
    <div className="mx-auto flex h-screen w-full max-w-6xl flex-col gap-4 p-4">
      <header className="flex items-center gap-2.5 px-1">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-950/40">
          <Cloud className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-base font-semibold leading-tight text-neutral-100">NimbusStack Assistant</h1>
          <p className="text-xs text-neutral-500">Internal product knowledge chatbot</p>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 gap-4">
        <aside className="flex w-64 shrink-0 flex-col gap-4">
          <ModelSelector value={modelId} onChange={setModelId} disabled={isLoading} />

          <button
            type="button"
            onClick={onNewConversation}
            className="flex items-center justify-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900/60 px-3 py-2 text-sm text-neutral-200 shadow-sm transition-colors hover:border-neutral-700 hover:bg-neutral-800"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            New conversation
          </button>

          <SessionSummary
            messageCount={sessionTotals.messageCount}
            promptTokens={sessionTotals.promptTokens}
            completionTokens={sessionTotals.completionTokens}
            cost={sessionTotals.cost}
          />
        </aside>

        <main className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/20 shadow-sm">
          <div ref={scrollContainerRef} className="flex-1 space-y-4 overflow-y-auto p-4">
            {messages.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-500/10">
                  <Cloud className="h-6 w-6 text-indigo-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-neutral-300">Ask about Vault, Pulse, Relay, or Ledger</p>
                  <p className="mt-1 text-xs text-neutral-500">
                    Pricing, features, troubleshooting, and support policy -- grounded in the docs.
                  </p>
                </div>
                <SuggestedPrompts onSelect={onSelectPrompt} />
              </div>
            )}

            {messages.map((message) => {
              const metrics = message.annotations?.find(isMetricsAnnotation) as MetricsAnnotation | undefined;
              const isUser = message.role === "user";

              return (
                <div
                  key={message.id}
                  className={`animate-message-in flex items-start gap-2.5 ${isUser ? "flex-row-reverse" : ""}`}
                >
                  <div
                    className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                      isUser ? "bg-indigo-600" : "bg-neutral-800"
                    }`}
                  >
                    {isUser ? (
                      <User className="h-3.5 w-3.5 text-white" />
                    ) : (
                      <Bot className="h-3.5 w-3.5 text-neutral-300" />
                    )}
                  </div>
                  <div className={`flex min-w-0 flex-col ${isUser ? "items-end" : "items-start"}`}>
                    <div
                      className={
                        isUser
                          ? "max-w-[80%] whitespace-pre-wrap break-words rounded-2xl rounded-tr-sm bg-indigo-600 px-3.5 py-2 text-sm text-white shadow-sm"
                          : "max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-tl-sm bg-neutral-800 px-3.5 py-2 text-sm text-neutral-100 shadow-sm"
                      }
                    >
                      <FormattedText text={message.content} />
                    </div>
                    {!isUser && metrics && <MessageMetrics metrics={metrics} />}
                  </div>
                </div>
              );
            })}

            {isLoading && (
              <div className="flex items-center gap-2.5">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-800">
                  <Bot className="h-3.5 w-3.5 text-neutral-300" />
                </div>
                <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm bg-neutral-800 px-3.5 py-2 text-sm text-neutral-400">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Thinking...
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-red-900/60 bg-red-950/40 px-3.5 py-2.5 text-sm text-red-300">
                {error.message}
              </div>
            )}
          </div>

          <form onSubmit={onSubmit} className="flex gap-2 border-t border-neutral-800 p-3">
            <input
              value={input}
              onChange={handleInputChange}
              placeholder="Ask a question about NimbusStack products..."
              className="flex-1 rounded-full border border-neutral-800 bg-neutral-900 px-4 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-600 outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-50"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!canSubmit}
              className="flex items-center gap-1.5 rounded-full bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600"
            >
              <Send className="h-3.5 w-3.5" />
              Send
            </button>
          </form>
        </main>
      </div>
    </div>
  );
}
