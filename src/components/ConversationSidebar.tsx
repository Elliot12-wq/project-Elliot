import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { Plus, Search, Trash2, LogOut, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import logo from "@/assets/elliot-logo.png";

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

    const channel = supabase
      .channel("conv-list")
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
    navigate({ to: "/c/$id", params: { id: data.id } });
  }

  async function remove(id: string) {
    await supabase.from("conversations").delete().eq("id", id);
    setList((l) => l.filter((c) => c.id !== id));
    if (id === activeId) navigate({ to: "/" });
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  }

  const filtered = q
    ? list.filter((c) => c.title.toLowerCase().includes(q.toLowerCase()))
    : list;

  return (
    <aside className="flex h-full w-72 flex-col border-r border-border/60 bg-card/40 backdrop-blur-xl">
      <div className="flex items-center gap-2 px-4 py-4">
        <img src={logo} alt="" className="h-8 w-8 rounded-full ring-1 ring-primary/40" />
        <span className="font-display text-2xl tracking-tight">Elliot</span>
      </div>

      <button
        onClick={newChat}
        className="mx-3 mb-3 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium text-primary-foreground shadow-[var(--shadow-ember)] transition active:scale-[0.99]"
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
            <Link
              key={c.id}
              to="/c/$id"
              params={{ id: c.id }}
              onClick={onClose}
              className={`group flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
                c.id === activeId
                  ? "bg-primary/15 text-foreground"
                  : "text-foreground/80 hover:bg-card/60"
              }`}
            >
              <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate">{c.title}</span>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  remove(c.id);
                }}
                className="opacity-0 transition group-hover:opacity-100 hover:text-destructive"
                aria-label="Delete"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </Link>
          ))
        )}
      </nav>

      <button
        onClick={signOut}
        className="m-3 flex items-center justify-center gap-2 rounded-lg border border-border bg-background/40 py-2 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
      >
        <LogOut className="h-3.5 w-3.5" /> Sign out
      </button>
    </aside>
  );
}
