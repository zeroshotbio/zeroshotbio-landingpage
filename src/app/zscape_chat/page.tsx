"use client";

import { useState, useRef, useEffect, FormEvent, KeyboardEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const ENDPOINT =
  process.env.NEXT_PUBLIC_ZSCAPE_ENDPOINT ?? "http://localhost:5002";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTED_PROMPTS = [
  "What happened to mafba knockout cells?",
  "Which knockouts show the strongest distributional shifts?",
  "Tell me about tfap2a perturbation effects.",
  "Which cell types are most affected by foxd3 knockout?",
];

// Markdown component map — styles tables, headings, lists, code, etc.
const mdComponents: React.ComponentProps<typeof ReactMarkdown>["components"] = {
  h2: ({ children }) => (
    <h2 className="roboto-slab-semibold text-base text-gray-dark mt-4 mb-2">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="roboto-slab-medium text-xsm text-gray-dark mt-3 mb-1">
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="list-disc list-outside ml-5 mb-3 space-y-1">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal list-outside ml-5 mb-3 space-y-1">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => (
    <strong className="roboto-slab-semibold text-gray-dark">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  hr: () => <hr className="border-gray-200 my-4" />,
  table: ({ children }) => (
    <div className="overflow-x-auto my-3">
      <table className="w-full text-xxxsm border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="border-b border-gray-200">{children}</thead>
  ),
  th: ({ children }) => (
    <th className="text-left py-1.5 px-3 roboto-slab-medium text-gray-dark whitespace-nowrap">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="py-1.5 px-3 border-b border-gray-100 text-gray-semidark">
      {children}
    </td>
  ),
  code: ({ children, className }) => {
    const isBlock = className?.includes("language-");
    return isBlock ? (
      <pre className="bg-gray-100 rounded-lg px-4 py-3 overflow-x-auto my-3 text-xxxsm font-mono text-gray-dark">
        <code>{children}</code>
      </pre>
    ) : (
      <code className="bg-gray-100 rounded px-1 py-0.5 text-xxxsm font-mono text-gray-dark">
        {children}
      </code>
    );
  },
};

export default function ZscapeChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(userText: string) {
    if (!userText.trim() || streaming) return;

    const userMsg: Message = { role: "user", content: userText.trim() };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput("");
    setStreaming(true);

    // Append empty assistant placeholder
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const res = await fetch(`${ENDPOINT}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6);
          if (payload === "[DONE]") break;
          try {
            const parsed = JSON.parse(payload);
            if (parsed.error) throw new Error(parsed.error);
            setMessages((prev) => {
              const updated = [...prev];
              updated[updated.length - 1] = {
                role: "assistant",
                content: updated[updated.length - 1].content + parsed.text,
              };
              return updated;
            });
          } catch {
            // malformed SSE chunk — skip
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: `Error: ${msg}. Is the ZSCAPE service running?`,
        };
        return updated;
      });
    } finally {
      setStreaming(false);
      inputRef.current?.focus();
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    send(input);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  const isEmpty = messages.length === 0;

  return (
    <main className="flex flex-col items-center min-h-screen px-4 pt-16 pb-8">
      {/* Header */}
      <div className="text-center mb-10">
        <h1 className="roboto-slab-light text-2xl text-gray-dark mb-2">
          ZSCAPE Explorer
        </h1>
        <p className="roboto-slab-regular text-xsm text-gray-light max-w-md">
          Ask about zebrafish CRISPR perturbation effects across cell types and
          developmental timepoints.
        </p>
      </div>

      {/* Chat window */}
      <div className="w-full max-w-2xl flex flex-col gap-4 flex-1 mb-4">
        {/* Suggested prompts — shown only before first message */}
        {isEmpty && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
            {SUGGESTED_PROMPTS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                disabled={streaming}
                className="text-left px-4 py-3 border border-gray-200 rounded-xl text-xsm text-gray-semidark hover:border-gray-400 hover:text-gray-dark disabled:opacity-40"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Message bubbles */}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "user" ? (
              <div className="max-w-[85%] px-4 py-3 rounded-2xl rounded-br-sm bg-gray-100 text-xsm text-gray-dark leading-relaxed">
                {msg.content}
              </div>
            ) : (
              <div className="max-w-[85%] text-xsm text-gray-semidark">
                {msg.content ? (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={mdComponents}
                  >
                    {msg.content}
                  </ReactMarkdown>
                ) : (
                  <span className="text-gray-verylight roboto-slab-light italic">
                    thinking...
                  </span>
                )}
              </div>
            )}
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {/* Input form */}
      <div className="w-full max-w-2xl sticky bottom-4">
        <form
          onSubmit={handleSubmit}
          className="flex items-end gap-3 border border-gray-200 rounded-2xl px-4 py-3 bg-white dark:bg-gray-900"
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about a gene, cell type, or timepoint… (Enter to send)"
            disabled={streaming}
            rows={1}
            className="flex-1 bg-transparent outline-none resize-none roboto-slab-regular text-xsm text-gray-dark placeholder:text-gray-verylight leading-relaxed max-h-40 overflow-y-auto"
            style={{ fieldSizing: "content" } as React.CSSProperties}
          />
          <button
            type="submit"
            disabled={streaming || !input.trim()}
            className="roboto-slab-regular text-xsm text-gray-medium hover:text-gray-dark disabled:text-gray-verylight shrink-0 pb-0.5"
          >
            {streaming ? "···" : "Send"}
          </button>
        </form>
        <p className="text-center mt-2 text-xxxsm text-gray-verylight roboto-slab-regular">
          ZSCAPE · zebrafish scRNA-seq CRISPR knockout
        </p>
      </div>
    </main>
  );
}
