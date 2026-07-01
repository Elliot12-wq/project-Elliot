import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { Send, Square, Mic, MicOff, Copy, Check, RotateCw, Menu, ImagePlus, X, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ElliotThinking } from "@/components/ElliotThinking";
import { CodeBlock } from "@/components/CodeBlock";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useShell } from "@/components/ChatShell";
import logoAsset from "@/assets/elliot-logo-pride.png.asset.json";
const logo = logoAsset.url;

type TierId = "1.0" | "1.2" | "2.2" | "2.3";
const TIERS: Array<{ id: TierId; name: string; tagline: string }> = [
  { id: "1.0", name: "Elliot 1.0", tagline: "Fastest — instant replies" },
  { id: "1.2", name: "Elliot 1.2", tagline: "Balanced — everyday assistant" },
  { id: "2.2", name: "Elliot 2.2", tagline: "Most accurate — careful, precise" },
  { id: "2.3", name: "Elliot 2.3", tagline: "Best reasoning — deep, multi-step" },
];
const DEFAULT_TIER: TierId = "1.2";
const STORAGE_KEY = "elliot.tier";

type Msg = { id: string; role: "user" | "assistant"; content: string; created_at?: string };

function mergeMessages(existing: Msg[], incoming: Msg[]) {
  const merged = [...existing];
  for (const m of incoming) {
    if (merged.some((x) => x.id === m.id)) continue;
    if (m.id.startsWith("tmp-") && merged.some((x) => !x.id.startsWith("tmp-") && x.role === m.role && x.content.trim() === m.content.trim())) {
      continue;
    }
    const tempIndex = merged.findIndex(
      (x) => x.id.startsWith("tmp-") && x.role === m.role && x.content.trim() === m.content.trim(),
    );
    if (tempIndex >= 0) merged[tempIndex] = m;
    else merged.push(m);
  }
  return merged.sort((a, b) => {
    if (!a.created_at || !b.created_at) return 0;
    return a.created_at.localeCompare(b.created_at);
  });
}

const SUGGESTIONS = [
  "What can you help me with?",
  "Write a short poem about embers.",
  "Brainstorm a startup name with me.",
];

export function ChatView({ conversationId }: { conversationId: string }) {
  const shell = useShell();
  const onToggleSidebar = shell?.openSidebar;
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const interimRef = useRef("");

  const [tier, setTierState] = useState<TierId>(() => {
    if (typeof window === "undefined") return DEFAULT_TIER;
    const raw = window.localStorage.getItem(STORAGE_KEY) as TierId | null;
    return raw && TIERS.some((t) => t.id === raw) ? raw : DEFAULT_TIER;
  });
  const setTier = (id: TierId) => {
    setTierState(id);
    try {
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch {}
  };
  const activeTier = TIERS.find((t) => t.id === tier) ?? TIERS[1];

  // Load history — don't wipe immediately, swap on resolve
  useEffect(() => {
    let alive = true;
    setStreamingText("");
    supabase
      .from("messages")
      .select("id,role,content,created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) {
          console.error("[ChatView] load messages failed:", error);
          toast.error("Couldn't load this chat's history.");
          return;
        }
        setMessages((data as Msg[]) ?? []);
      });

    // Realtime: catch newly-persisted assistant replies even if streaming swap-in fails
    const channel = supabase
      .channel(`msgs-${conversationId}-${Date.now()}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const m = payload.new as Msg;
          setMessages((prev) => {
            if (prev.some((x) => x.id === m.id)) return prev;
            return mergeMessages(prev, [m]);
          });
        },
      )
      .subscribe();

    return () => {
      alive = false;
      abortRef.current?.abort();
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streamingText, streaming]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
  }, [input]);

  // Voice input
  const speech = useSpeechRecognition((text, isFinal) => {
    if (isFinal) {
      setInput((prev) => (prev ? prev + " " : "") + text.trim());
      interimRef.current = "";
    } else {
      interimRef.current = text;
    }
  });

  const [pendingImages, setPendingImages] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function addImages(files: FileList | null) {
    if (!files) return;
    const next: File[] = [];
    for (const f of Array.from(files)) {
      if (!f.type.startsWith("image/")) {
        toast.error(`${f.name} isn't an image.`);
        continue;
      }
      if (f.size > 8 * 1024 * 1024) {
        toast.error(`${f.name} is over 8MB.`);
        continue;
      }
      next.push(f);
    }
    setPendingImages((prev) => [...prev, ...next].slice(0, 4));
  }

  async function uploadImages(files: File[], userId: string): Promise<string[]> {
    const urls: string[] = [];
    for (const f of files) {
      const ext = (f.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
      const path = `${userId}/${conversationId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from("chat-images").upload(path, f, {
        contentType: f.type,
        upsert: false,
      });
      if (error) throw new Error(error.message);
      const { data, error: signErr } = await supabase.storage
        .from("chat-images")
        .createSignedUrl(path, 60 * 60 * 24 * 365 * 10); // 10 years
      if (signErr || !data?.signedUrl) throw new Error(signErr?.message || "Couldn't sign image URL");
      urls.push(data.signedUrl);
    }
    return urls;
  }

  async function send(text: string) {
    const content = text.trim();
    const imagesToSend = pendingImages;
    if ((!content && imagesToSend.length === 0) || streaming) return;
    const tempUserId = `tmp-u-${Date.now()}`;

    setInput("");
    setPendingImages([]);
    setStreaming(true);
    setStreamingText("");

    try {
      const { data: u, error: userError } = await supabase.auth.getUser();
      if (userError || !u.user) throw new Error("Session expired. Sign in again.");
      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token;
      if (!token) throw new Error("Not signed in");

      let imageUrls: string[] = [];
      if (imagesToSend.length > 0) {
        imageUrls = await uploadImages(imagesToSend, u.user.id);
      }

      const optimisticContent = [content, ...imageUrls.map((url) => `![image](${url})`)]
        .filter(Boolean)
        .join("\n\n");
      setMessages((prev) => [...prev, { id: tempUserId, role: "user", content: optimisticContent }]);

      const ctrl = new AbortController();
      abortRef.current = ctrl;

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ conversationId, userMessage: content, imageUrls, tier }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        let msg = `Couldn't reach Elliot (HTTP ${res.status}).`;
        try {
          const j = await res.json();
          if (j?.error) msg = j.error;
        } catch {
          /* not json */
        }
        throw new Error(msg);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setStreamingText(acc);
      }

      if (acc.trim()) {
        setMessages((prev) => mergeMessages(prev, [{ id: `tmp-a-${Date.now()}`, role: "assistant", content: acc }]));
      }

      // Refresh from DB — realtime may have already added rows
      const { data } = await supabase
        .from("messages")
        .select("id,role,content,created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
      if (data) setMessages((prev) => mergeMessages(prev, data as Msg[]));
      setStreamingText("");
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        console.error(err);
        toast.error(err?.message || "Couldn't reach Elliot.");
      }
      setMessages((prev) => prev.filter((m) => m.id !== tempUserId));
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  async function regenerate() {
    // Find last user message, delete subsequent assistant message(s), resend
    const lastUserIdx = [...messages].reverse().findIndex((m) => m.role === "user");
    if (lastUserIdx === -1 || streaming) return;
    const realIdx = messages.length - 1 - lastUserIdx;
    const lastUser = messages[realIdx];
    // delete all messages after the last user message
    const toDelete = messages.slice(realIdx + 1).map((m) => m.id).filter((id) => !id.startsWith("tmp"));
    if (toDelete.length) {
      await supabase.from("messages").delete().in("id", toDelete);
    }
    // Also delete the last user message — send() will re-insert it server-side
    if (!lastUser.id.startsWith("tmp")) {
      await supabase.from("messages").delete().eq("id", lastUser.id);
    }
    setMessages((prev) => prev.slice(0, realIdx));
    send(lastUser.content);
  }

  function stopStream() {
    abortRef.current?.abort();
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

  const empty = messages.length === 0 && !streaming;

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col">
      {/* Top bar */}
      <header className="flex items-center gap-3 border-b border-border/60 bg-background/40 px-4 py-3 backdrop-blur-xl">
        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            className="rounded-lg p-2 text-muted-foreground transition hover:bg-card/60 hover:text-foreground md:hidden"
            aria-label="Open chats"
          >
            <Menu className="h-4 w-4" />
          </button>
        )}
        <div className="relative h-9 w-9">
          <div className="absolute inset-[-4px] rounded-full blur-md" style={{ background: "var(--gradient-glow)", opacity: 0.7 }} />
          <img src={logo} alt="" className="relative h-9 w-9 rounded-full object-cover ring-1 ring-primary/50" />
        </div>
        <div className="flex flex-col leading-tight">
          <h1 className="font-display text-xl tracking-tight">Elliot</h1>
          <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Woven from memory · forged in red
          </span>
        </div>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
        {empty ? (
          <EmptyState onPick={send} />
        ) : (
          <div className="mx-auto flex max-w-2xl flex-col gap-4">
            <AnimatePresence initial={false}>
              {messages.map((m) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  transition={{ type: "spring", stiffness: 260, damping: 26 }}
                  className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
                >
                  <Bubble role={m.role} content={m.content} />
                </motion.div>
              ))}
            </AnimatePresence>

            {streaming && streamingText && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-start"
              >
                <Bubble role="assistant" content={streamingText} streaming />
              </motion.div>
            )}

            {streaming && !streamingText && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                <div className="rounded-2xl border border-border/60 bg-card/70 backdrop-blur-md">
                  <ElliotThinking />
                </div>
              </motion.div>
            )}

            {!streaming && messages.length > 0 && messages[messages.length - 1].role === "assistant" && (
              <div className="flex justify-start">
                <button
                  onClick={regenerate}
                  className="ml-1 flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground transition hover:bg-card/60 hover:text-foreground"
                >
                  <RotateCw className="h-3 w-3" /> Regenerate
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Composer */}
      <form
        onSubmit={onSubmit}
        className="relative border-t border-border/60 bg-background/50 px-4 py-4 backdrop-blur-xl"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            addImages(e.target.files);
            if (fileInputRef.current) fileInputRef.current.value = "";
          }}
        />

        {pendingImages.length > 0 && (
          <div className="mx-auto mb-2 flex max-w-2xl flex-wrap gap-2">
            {pendingImages.map((f, i) => (
              <div key={i} className="group relative h-16 w-16 overflow-hidden rounded-lg border border-border bg-card/40">
                <img src={URL.createObjectURL(f)} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => setPendingImages((prev) => prev.filter((_, j) => j !== i))}
                  className="absolute right-0.5 top-0.5 rounded-full bg-background/80 p-0.5 text-foreground transition hover:bg-destructive hover:text-destructive-foreground"
                  aria-label="Remove image"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mx-auto flex max-w-2xl items-end gap-2 rounded-2xl border border-border bg-input/40 p-2 shadow-[var(--shadow-deep)] transition focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/30">
          <textarea
            ref={textareaRef}
            value={input + (speech.listening && interimRef.current ? ` ${interimRef.current}` : "")}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={speech.listening ? "Listening…" : "Speak to Elliot…"}
            rows={1}
            disabled={streaming}
            className="flex-1 resize-none bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/70 disabled:opacity-60"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={streaming || pendingImages.length >= 4}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-background/40 text-muted-foreground transition hover:text-foreground active:scale-95 disabled:opacity-40"
            aria-label="Attach image"
          >
            <ImagePlus className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={speech.listening ? speech.stop : speech.start}
            disabled={streaming}
            className={`relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition active:scale-95 ${
              speech.listening
                ? "border-primary/60 bg-primary/15 text-primary-glow"
                : "border-border bg-background/40 text-muted-foreground hover:text-foreground"
            }`}
            aria-label={speech.listening ? "Stop voice input" : "Voice input"}
          >
            {speech.listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            {speech.listening && (
              <span className="absolute -inset-0.5 rounded-xl border border-primary/40" style={{ animation: "elliot-halo 1.4s ease-in-out infinite" }} />
            )}
          </button>

          <button
            type={streaming ? "button" : "submit"}
            onClick={streaming ? stopStream : undefined}
            disabled={!streaming && !input.trim() && pendingImages.length === 0}
            className="group relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-primary-foreground shadow-[var(--shadow-ember)] transition active:scale-95 disabled:opacity-40 disabled:shadow-none"
            style={{ background: "var(--gradient-ember)" }}
            aria-label={streaming ? "Stop" : "Send"}
          >
            {streaming ? <Square className="h-4 w-4 fill-current" /> : <Send className="h-4 w-4 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />}
          </button>
        </div>
        <p className="mx-auto mt-2 max-w-2xl text-center text-[10px] text-muted-foreground/70">
          Elliot quietly remembers things that matter · Enter sends · Shift+Enter for newline
        </p>
        <p className="mx-auto mt-1 max-w-2xl text-center text-[10px] text-muted-foreground/50">
          Made by Charlie Nathaniel P. Sagun
        </p>
      </form>
    </div>
  );
}

function Bubble({ role, content, streaming }: { role: "user" | "assistant"; content: string; streaming?: boolean }) {
  const [copied, setCopied] = useState(false);
  if (role === "user") {
    // Split out markdown image lines so they render as actual images
    const imgRegex = /!\[[^\]]*\]\(([^)]+)\)/g;
    const images: string[] = [];
    const textOnly = content.replace(imgRegex, (_m, url) => {
      images.push(url);
      return "";
    }).trim();
    return (
      <div
        className="max-w-[85%] space-y-2 rounded-2xl rounded-br-md px-3 py-2 text-sm text-primary-foreground shadow-[var(--shadow-ember)]"
        style={{ background: "var(--gradient-ember)" }}
      >
        {images.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {images.map((u, i) => (
              <a key={i} href={u} target="_blank" rel="noreferrer" className="block">
                <img src={u} alt="" className="max-h-56 max-w-[14rem] rounded-lg object-cover" />
              </a>
            ))}
          </div>
        )}
        {textOnly && <div className="px-1 py-0.5 whitespace-pre-wrap">{textOnly}</div>}
      </div>
    );
  }
  return (
    <div className="group relative max-w-[90%] rounded-2xl rounded-bl-md border border-primary/20 bg-card/70 px-4 py-3 text-card-foreground backdrop-blur-md transition hover:border-primary/40 hover:shadow-[var(--shadow-ember)]">
      <div className="prose-elliot">
        <ReactMarkdown
          components={{
            code({ inline, className, children, ...props }: any) {
              const match = /language-(\w+)/.exec(className || "");
              const value = String(children).replace(/\n$/, "");
              if (!inline && (match || value.includes("\n"))) {
                return <CodeBlock language={match?.[1] || ""} value={value} />;
              }
              return (
                <code className={className} {...props}>
                  {children}
                </code>
              );
            },
          }}
        >
          {content}
        </ReactMarkdown>
        {streaming && <span className="ml-0.5 inline-block h-3 w-1.5 -mb-0.5 animate-pulse rounded-sm bg-primary-glow" />}
      </div>
      {!streaming && (
        <button
          onClick={() => {
            navigator.clipboard.writeText(content);
            setCopied(true);
            setTimeout(() => setCopied(false), 1400);
          }}
          className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-primary-glow"
          aria-label="Copy"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        </button>
      )}
    </div>
  );
}

function useElliotGreeting() {
  return useMemo(() => {
    const now = new Date();
    const h = now.getHours();
    const dow = now.getDay();
    const date = now.getDate();
    const monthName = now.toLocaleString(undefined, { month: "long" });

    let timeGreeting: string;
    if (h >= 5 && h < 12) timeGreeting = "Good morning";
    else if (h >= 12 && h < 17) timeGreeting = "Good afternoon";
    else if (h >= 17 && h < 21) timeGreeting = "Good evening";
    else timeGreeting = "It's night";

    const dayLinesByDow: Record<number, string[]> = {
      0: ["Sunday calm — ask away.", "Easy Sunday — what's on your mind?"],
      1: ["You got any questions on Monday?", "Fresh Monday — where do we start?"],
      2: ["Nice Tuesday, innit?", "Tuesday's quietly productive — let's go."],
      3: ["Midweek already — what's on your mind?", "Hump-day Wednesday — anything I can help with?"],
      4: ["Thursday treating you well?", "Almost Friday — what are we working on?"],
      5: ["Happy Friday — what are we tackling?", "Friday energy — what's the move?"],
      6: ["Lazy Saturday questions?", "Saturday's yours — how can I help?"],
    };
    const variants = dayLinesByDow[dow];
    const dayLine = variants[date % variants.length];

    const monthBadge = date <= 3 ? `Happy ${monthName} ✦` : null;

    return { timeGreeting, dayLine, monthBadge };
  }, []);
}

function EmptyState({ onPick }: { onPick: (s: string) => void }) {
  const { timeGreeting, dayLine, monthBadge } = useElliotGreeting();
  return (
    <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center pt-10 text-center">
      <div className="relative mb-6 h-32 w-32">
        <div
          className="absolute inset-[-24px] rounded-full blur-3xl"
          style={{ background: "var(--gradient-glow)", animation: "elliot-halo 3s ease-in-out infinite" }}
        />
        <img
          src={logo}
          alt="Elliot"
          className="relative h-32 w-32 rounded-full object-cover ring-1 ring-primary/50"
          style={{ animation: "elliot-breathe 3.6s ease-in-out infinite" }}
        />
      </div>
      {monthBadge && (
        <span className="mb-3 inline-block rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-primary-glow">
          {monthBadge}
        </span>
      )}
      <h2 className="font-display text-4xl tracking-tight">{timeGreeting}.</h2>
      <p className="mt-2 text-sm text-muted-foreground">{dayLine}</p>
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

