import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Plus, Search, Trash2, MessageSquare, X, Settings, UserRound, LogIn } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import logo from "@/assets/elliot-logo.png";
import { SettingsDialog } from "@/components/SettingsDialog";
import { CreditsDialog } from "@/components/CreditsDialog";
import { useProfile } from "@/hooks/useProfile";
import { leaveGuest } from "@/lib/guest";

type Conv = { id: string; title: string; updated_at: string };

export function ConversationSidebar({
  activeId,
  onClose,
  guest,
}: {
  activeId?: string;
  onClose?: () => void;
  guest?: boolean;
}) {
  const [list, setList] = useState<Conv[]>([]);
  const [q, setQ] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [creditsOpen, setCreditsOpen] = useState(false);
  const navigate = useNavigate();
  const { profile } = useProfile(!guest);

  useEffect(() => {
    if (guest) return;
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
  }, [guest]);

  async function newChat() {
    if (guest) {
      onClose?.();
      window.dispatchEvent(new CustomEvent("elliot:guest-new-chat"));
      return;
    }
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

  const filtered = q ? list.filter((c) => c.title.toLowerCase().includes(q.toLowerCase())) : list;

  return (
    <aside className="glass-surface flex h-full w-72 max-w-[86vw] flex-col border-r border-border/60 bg-card/90 backdrop-blur-xl md:bg-card/40">
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

      {guest ? (
        <div className="mx-3 mb-3 rounded-xl border border-primary/25 bg-primary/5 px-3 py-3 text-center">
          <p className="text-xs text-foreground/90">You're browsing as a guest.</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Chats stay on this device only.</p>
          <button
            onClick={() => {
              leaveGuest();
              navigate({ to: "/login" });
            }}
            className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 py-2 text-xs text-foreground transition hover:bg-primary/20"
          >
            <LogIn className="h-3.5 w-3.5" /> Log in or create an account
          </button>
        </div>
      ) : (
        <div className="mx-3 mb-2 flex items-center gap-2 rounded-lg border border-border bg-input/40 px-3 py-2">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search chats"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
          />
        </div>
      )}

      <nav className="flex-1 overflow-y-auto px-2 pb-2">
        {guest ? (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground">
            Guest chats aren't saved to history.
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground">No conversations yet.</div>
        ) : (
          filtered.map((c, i) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(i, 12) * 0.025, type: "spring", stiffness: 300, damping: 28 }}
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
                c.id === activeId ? "bg-primary/15 text-foreground" : "text-foreground/80 hover:bg-card/60"
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
            </motion.div>
          ))
        )}
      </nav>

      <div className="safe-bottom m-3 flex flex-col gap-2">
        <button
          onClick={() => setSettingsOpen(true)}
          className="flex items-center gap-2 rounded-xl border border-border bg-background/40 px-3 py-2.5 text-left text-xs text-foreground/90 transition hover:border-primary/50 hover:bg-card/60"
        >
          <span className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full border border-primary/40 bg-card/60">
            {profile?.avatarUrl ? (
              <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <UserRound className="m-auto h-4 w-4 text-muted-foreground" />
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate">
              {guest ? "Guest" : profile?.nickname || profile?.email || "Your account"}
            </span>
            <span className="block text-[10px] text-muted-foreground">Settings</span>
          </span>
          <Settings className="h-3.5 w-3.5 text-muted-foreground" />
        </button>

        <button
          onClick={() => setCreditsOpen(true)}
          className="self-center text-[10px] text-muted-foreground/40 transition hover:text-muted-foreground"
        >
          credits
        </button>
      </div>

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} guest={guest} />
      <CreditsDialog open={creditsOpen} onClose={() => setCreditsOpen(false)} />
    </aside>
  );
}
