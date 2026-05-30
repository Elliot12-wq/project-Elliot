import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { Send } from "lucide-react";
import { toast } from "sonner";

import { chatWithElliot } from "@/lib/chat.functions";
import { ElliotThinking } from "@/components/ElliotThinking";
import { Toaster } from "@/components/ui/sonner";
import logo from "@/assets/elliot-logo.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Elliot — AI Assistant" },
      { name: "description", content: "Elliot: a thoughtful AI companion, woven in red and shadow." },
      { property: "og:title", content: "Elliot — AI Assistant" },
      { property: "og:description", content: "A thoughtful AI companion, woven in red and shadow." },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "icon", href: logo }],
  }),
  component: ElliotChat,
});

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "What can you do for me?",
  "Write a short poem about embers.",
  "Help me brainstorm a startup name.",
];

function ElliotChat() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const chatFn = useServerFn(chatWithElliot);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, loading]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
  }, [input]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || loading) return;
    const next = [...messages, { role: "user" as const, content }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await chatFn({ data: { messages: next } });
      if (res.ok) {
        setMessages((prev) => [...prev, { role: "assistant", content: res.content }]);
      } else {
        toast.error(res.error);
      }
    } catch (err) {
      console.error(err);
      toast.error("Couldn't reach Elliot. Try again.");
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    send(input);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  return (
    <div className="flex h-[100dvh] flex-col">
      <Toaster />

      {/* Header */}
      <header className="relative z-10 flex items-center gap-3 border-b border-border/60 bg-background/60 px-4 py-3 backdrop-blur-xl">
        <div className="relative h-10 w-10">
          <div
            className="absolute inset-[-6px] rounded-full blur-md"
            style={{ background: "var(--gradient-glow)", opacity: 0.7 }}
          />
          <img
            src={logo}
            alt="Elliot logo"
            className="relative h-10 w-10 rounded-full object-cover ring-1 ring-primary/50"
          />
        </div>
        <div className="flex flex-col leading-tight">
          <h1 className="font-display text-2xl tracking-tight">Elliot</h1>
          <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Woven from llama · forged in red
          </span>
        </div>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
        {messages.length === 0 && !loading ? (
          <EmptyState onPick={send} />
        ) : (
          <div className="mx-auto flex max-w-2xl flex-col gap-4">
            <AnimatePresence initial={false}>
              {messages.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  className={
                    m.role === "user"
                      ? "flex justify-end"
                      : "flex justify-start"
                  }
                >
                  <Bubble role={m.role} content={m.content} />
                </motion.div>
              ))}
            </AnimatePresence>

            {loading && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-start"
              >
                <div className="rounded-2xl border border-border/60 bg-card/70 backdrop-blur-md">
                  <ElliotThinking />
                </div>
              </motion.div>
            )}
          </div>
        )}
      </div>

      {/* Composer */}
      <form
        onSubmit={onSubmit}
        className="relative border-t border-border/60 bg-background/70 px-4 py-4 backdrop-blur-xl"
      >
        <div className="mx-auto flex max-w-2xl items-end gap-2 rounded-2xl border border-border bg-input/40 p-2 shadow-[var(--shadow-deep)] focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/30 transition">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Speak to Elliot…"
            rows={1}
            disabled={loading}
            className="flex-1 resize-none bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/70 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="group relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-primary-foreground shadow-[var(--shadow-ember)] transition active:scale-95 disabled:opacity-40 disabled:shadow-none"
            style={{ background: "var(--gradient-ember)" }}
            aria-label="Send"
          >
            <Send className="h-4 w-4 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </button>
        </div>
        <p className="mx-auto mt-2 max-w-2xl text-center text-[10px] text-muted-foreground/70">
          Press Enter to send · Shift+Enter for newline
        </p>
      </form>
    </div>
  );
}

function Bubble({ role, content }: { role: "user" | "assistant"; content: string }) {
  if (role === "user") {
    return (
      <div
        className="max-w-[85%] rounded-2xl rounded-br-md px-4 py-2.5 text-sm text-primary-foreground shadow-[var(--shadow-ember)]"
        style={{ background: "var(--gradient-ember)" }}
      >
        {content}
      </div>
    );
  }
  return (
    <div className="max-w-[90%] rounded-2xl rounded-bl-md border border-primary/20 bg-card/70 px-4 py-3 text-card-foreground backdrop-blur-md">
      <div className="prose-elliot">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (s: string) => void }) {
  return (
    <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center pt-10 text-center">
      <div className="relative mb-6 h-28 w-28">
        <div
          className="absolute inset-[-20px] rounded-full blur-3xl"
          style={{ background: "var(--gradient-glow)", animation: "elliot-halo 3s ease-in-out infinite" }}
        />
        <img
          src={logo}
          alt="Elliot"
          className="relative h-28 w-28 rounded-full object-cover ring-1 ring-primary/50"
          style={{ animation: "elliot-breathe 3.6s ease-in-out infinite" }}
        />
      </div>
      <h2 className="font-display text-4xl tracking-tight">Hello, I'm Elliot.</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Ask me anything. I think in embers and answer in ink.
      </p>
      <div className="mt-7 flex w-full flex-col gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onPick(s)}
            className="group rounded-xl border border-border bg-card/40 px-4 py-3 text-left text-sm text-foreground/90 backdrop-blur-md transition hover:border-primary/50 hover:bg-card/70 hover:shadow-[var(--shadow-ember)]"
          >
            <span className="mr-2 text-primary">›</span>
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
