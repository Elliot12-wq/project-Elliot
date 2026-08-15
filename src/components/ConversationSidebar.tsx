import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Plus, Search, Trash2, LogOut, MessageSquare, X, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import logo from "@/assets/elliot-logo.png";
import { InstructionsDialog } from "@/components/InstructionsDialog";

type Conv = { id: string; title: string; updated_at: string };

export function ConversationSidebar({
  activeId,
  onClose,
}: {
  activeId?: string;
  onClose?: () => void;
}) {
  const [list, setList] = useState<Conv[]>([]);
  const [q, setQ] = useState("");
  const [instrOpen, setInstrOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data } = await supabase
        .from("conversations")
        .select("id,title,updated_at")
        .eq("user_id", u.user.id)
        .order("updated_at", { ascending: false })
        .limit(100);
      if (alive && data) setList(data as Conv[]);
    };
    load();

    const channelName = `conv-list-${Math.random().toString(36).slice(2)}`;
    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, load)
      .subscribe();
    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
  }, []);

  async function newChat() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data, error } = await supabase
      .from("conversations")
      .insert({ user_id: u.user.id, title: "New chat" })
      .select("id")
      .single();
    if (error || !data) return toast.error("Couldn't start chat");
    onClose?.();
    window.setTimeout(() => navigate({ to: "/c/$id", params: { id: data.id } }), 0);
  }

  async function remove(id: string, title: string) {
    const ok = window.confirm(`Delete “${title || "this chat"}”? This removes the whole conversation.`);
    if (!ok) return;
    const { error } = await supabase.from("conversations").delete().eq("id", id);
    if (error) return toast.error("Couldn't delete that chat.");
    setList((l) => l.filter((c) => c.id !== id));
    toast.success("Chat deleted.");
    if (id === activeId) {
      onClose?.();
      window.setTimeout(() => navigate({ to: "/" }), 0);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  }

  const filtered = q
    ? list.filter((c) => c.title.toLowerCase().includes(q.toLowerCase()))
    : list;

  return (
    <aside className="flex h-full w-72 max-w-[86vw] flex-col border-r border-border/60 bg-card/90 backdrop-blur-xl md:bg-card/40">
      <div className="flex items-center gap-2 px-4 py-4">
        <img src={logo} alt="" className="h-8 w-8 rounded-full ring-1 ring-primary/40" />
        <span className="flex-1 font-display text-2xl tracking-tight">Elliot</span>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-background/60 hover:text-foreground active:scale-95 md:hidden"
            aria-label="Close chats"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <button
        onClick={newChat}
        className="mx-3 mb-3 flex min-h-[44px] items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium text-primary-foreground shadow-[var(--shadow-ember)] transition duration-300 hover:brightness-110 active:scale-[0.98]"
        style={{ background: "var(--gradient-ember)" }}
      >
        <Plus className="h-4 w-4" /> New chat
      </button>

      <div className="mx-3 mb-2 flex items-center gap-2 rounded-lg border border-border bg-input/40 px-3 py-2">
        <Search className="h-3.5 w-3.5 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search chats"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
        />
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-2">
        {filtered.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground">
            No conversations yet.
          </div>
        ) : (
          filtered.map((c) => (
            <div
              key={c.id}
              role="button"
              tabIndex={0}
              onClick={() => {
                onClose?.();
                window.setTimeout(() => navigate({ to: "/c/$id", params: { id: c.id } }), 0);
              }}
              onKeyDown={(e) => {
                if (e.key !== "Enter" && e.key !== " ") return;
                e.preventDefault();
                onClose?.();
                window.setTimeout(() => navigate({ to: "/c/$id", params: { id: c.id } }), 0);
              }}
              className={`group flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition duration-200 ${
                c.id === activeId
                  ? "bg-primary/15 text-foreground"
                  : "text-foreground/80 hover:bg-card/60"
              }`}
            >
              <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate">{c.title}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  remove(c.id, c.title);
                }}
                className="rounded-md p-1 text-muted-foreground opacity-100 transition hover:bg-background/60 hover:text-destructive md:opacity-0 md:group-hover:opacity-100"
                aria-label={`Delete ${c.title}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))
        )}
      </nav>

      <div className="safe-bottom m-3 flex flex-col gap-2">
        <button
          onClick={() => setInstrOpen(true)}
          className="flex items-center justify-center gap-2 rounded-lg border border-primary/30 bg-primary/5 min-h-[40px] py-2 text-xs text-foreground/90 transition hover:border-primary/60 hover:bg-primary/10"
        >
          <Sparkles className="h-3.5 w-3.5 text-primary-glow" /> Custom instructions
        </button>
        <button
          onClick={signOut}
          className="flex items-center justify-center gap-2 rounded-lg border border-border bg-background/40 min-h-[40px] py-2 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
        >
          <LogOut className="h-3.5 w-3.5" /> Sign out
        </button>
      </div>
      <InstructionsDialog open={instrOpen} onClose={() => setInstrOpen(false)} />
    </aside>
  );
}
