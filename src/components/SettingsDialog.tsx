import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  X,
  Sparkles,
  Loader2,
  Droplets,
  UserRound,
  LogOut,
  Repeat,
  Camera,
  ChevronRight,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getMyInstructions, saveMyInstructions } from "@/lib/instructions.functions";
import { useLiquidGlass } from "@/lib/appearance";
import { useProfile } from "@/hooks/useProfile";
import { listAccounts, forgetAccount, type RememberedAccount } from "@/lib/accounts";
import { leaveGuest } from "@/lib/guest";

const MAX = 2000;
type Pane = "home" | "instructions" | "account" | "switch";

export function SettingsDialog({
  open,
  onClose,
  guest,
}: {
  open: boolean;
  onClose: () => void;
  guest?: boolean;
}) {
  const [pane, setPane] = useState<Pane>("home");

  useEffect(() => {
    if (open) setPane("home");
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[1200] flex items-end justify-center px-0 sm:items-center sm:px-4">
          <motion.div
            initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
            animate={{ opacity: 1, backdropFilter: "blur(10px)" }}
            exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
            transition={{ duration: 0.24 }}
            className="absolute inset-0 bg-background/70"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className="safe-bottom relative max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-border/80 bg-card/95 p-5 shadow-[var(--shadow-deep)] sm:rounded-2xl"
          >
            <div className="mb-4 flex items-center gap-2">
              {pane !== "home" && (
                <button
                  onClick={() => setPane("home")}
                  className="rounded-md p-1 text-muted-foreground transition hover:text-foreground"
                  aria-label="Back"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
              )}
              <h2 className="flex-1 font-display text-xl tracking-tight">
                {pane === "home"
                  ? "Settings"
                  : pane === "instructions"
                    ? "Custom instructions"
                    : pane === "account"
                      ? "Account manager"
                      : "Switch accounts"}
              </h2>
              <button
                onClick={onClose}
                className="rounded-md p-1 text-muted-foreground transition hover:text-foreground"
                aria-label="Close settings"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={pane}
                initial={{ opacity: 0, x: pane === "home" ? -12 : 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: pane === "home" ? -12 : 12 }}
                transition={{ duration: 0.18 }}
              >
                {pane === "home" && <HomePane guest={guest} go={setPane} />}
                {pane === "instructions" && <InstructionsPane guest={guest} onDone={() => setPane("home")} />}
                {pane === "account" && <AccountPane guest={guest} onSwitch={() => setPane("switch")} />}
                {pane === "switch" && <SwitchPane />}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function Row({
  icon,
  title,
  sub,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl border border-border/70 bg-background/40 px-4 py-3 text-left transition hover:border-primary/50 hover:bg-card/70 active:scale-[0.99]"
    >
      <span className="text-primary-glow">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-foreground">{title}</span>
        <span className="block truncate text-[11px] text-muted-foreground">{sub}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

function HomePane({ guest, go }: { guest?: boolean; go: (p: Pane) => void }) {
  const { enabled, toggle, android } = useLiquidGlass();
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-background/40 px-4 py-3">
        <Droplets className="h-4 w-4 shrink-0 text-primary-glow" />
        <div className="min-w-0 flex-1">
          <div className="text-sm text-foreground">Liquid glass</div>
          <div className="text-[11px] text-muted-foreground">
            Frosted, translucent surfaces{android ? " — tuned lighter for Android" : ""}.
          </div>
        </div>
        <button
          role="switch"
          aria-checked={enabled}
          onClick={() => toggle(!enabled)}
          className={`relative h-6 w-11 shrink-0 rounded-full border transition duration-300 ${
            enabled ? "border-primary/60" : "border-border bg-input/60"
          }`}
          style={enabled ? { background: "var(--gradient-ember)" } : undefined}
        >
          <motion.span
            layout
            transition={{ type: "spring", stiffness: 500, damping: 32 }}
            className={`absolute top-0.5 h-4.5 w-4.5 rounded-full bg-foreground shadow ${enabled ? "right-0.5" : "left-0.5"}`}
            style={{ height: 18, width: 18 }}
          />
        </button>
      </div>

      <Row
        icon={<Sparkles className="h-4 w-4" />}
        title="Custom instructions"
        sub={guest ? "Sign in to personalise Elliot" : "Tell Elliot how to respond"}
        onClick={() => go("instructions")}
      />
      <Row
        icon={<UserRound className="h-4 w-4" />}
        title="Account manager"
        sub={guest ? "You're browsing as a guest" : "Picture, nickname, sign out"}
        onClick={() => go("account")}
      />
    </div>
  );
}

function GuestNotice({ what }: { what: string }) {
  const navigate = useNavigate();
  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-center">
      <p className="text-sm text-foreground/90">{what}</p>
      <button
        onClick={() => {
          leaveGuest();
          navigate({ to: "/login", search: {} });
        }}
        className="mt-3 rounded-lg px-4 py-2 text-sm font-medium text-primary-foreground shadow-[var(--shadow-ember)]"
        style={{ background: "var(--gradient-ember)" }}
      >
        Log in or create an account
      </button>
    </div>
  );
}

function InstructionsPane({ guest, onDone }: { guest?: boolean; onDone: () => void }) {
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(!guest);
  const [saving, setSaving] = useState(false);
  const load = useServerFn(getMyInstructions);
  const save = useServerFn(saveMyInstructions);

  useEffect(() => {
    if (guest) return;
    setLoading(true);
    load({})
      .then((r) => setValue(r?.content ?? ""))
      .catch(() => toast.error("Couldn't load your instructions."))
      .finally(() => setLoading(false));
  }, [guest, load]);

  if (guest) return <GuestNotice what="Custom instructions are for signed-in accounts." />;

  return (
    <div>
      <p className="mb-3 text-xs text-muted-foreground">
        Tell Elliot how you'd like him to respond. Applied to every conversation.
      </p>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value.slice(0, MAX))}
        placeholder={loading ? "Loading…" : "e.g. Prefer concise answers. I'm a student — explain code carefully."}
        disabled={loading || saving}
        rows={7}
        className="w-full resize-none rounded-xl border border-border bg-input/40 px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-primary/60 focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
      />
      <div className="mt-1 text-right text-[10px] text-muted-foreground/70">
        {value.length}/{MAX}
      </div>
      <button
        onClick={async () => {
          setSaving(true);
          try {
            await save({ data: { content: value } });
            toast.success("Instructions saved.");
            onDone();
          } catch (e: any) {
            toast.error(e?.message || "Couldn't save.");
          } finally {
            setSaving(false);
          }
        }}
        disabled={loading || saving}
        className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-[var(--shadow-ember)] transition active:scale-[0.99] disabled:opacity-60"
        style={{ background: "var(--gradient-ember)" }}
      >
        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save
      </button>
    </div>
  );
}

function AccountPane({ guest, onSwitch }: { guest?: boolean; onSwitch: () => void }) {
  const navigate = useNavigate();
  const { profile, save, uploadAvatar } = useProfile(!guest);
  const [nickname, setNickname] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile) setNickname(profile.nickname);
  }, [profile]);

  if (guest) return <GuestNotice what="You're using Elliot as a guest. Sign in to keep a profile." />;

  async function pick(file?: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Pick an image file.");
    if (file.size > 6 * 1024 * 1024) return toast.error("That picture is over 6MB.");
    setBusy(true);
    try {
      const url = await uploadAvatar(file);
      await save({ avatarUrl: url });
      toast.success("Profile picture updated.");
    } catch (e: any) {
      toast.error(e?.message || "Couldn't update your picture.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <button
          onClick={() => fileRef.current?.click()}
          className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-full border border-primary/40 bg-background/50"
          aria-label="Change profile picture"
        >
          {profile?.avatarUrl ? (
            <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <UserRound className="m-auto h-8 w-8 text-muted-foreground" />
          )}
          <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-background/70 py-1 text-[10px] text-foreground opacity-0 transition group-hover:opacity-100">
            <Camera className="h-3 w-3" /> Change
          </span>
          {busy && (
            <span className="absolute inset-0 flex items-center justify-center bg-background/60">
              <Loader2 className="h-4 w-4 animate-spin text-primary-glow" />
            </span>
          )}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            pick(e.target.files?.[0]);
            if (fileRef.current) fileRef.current.value = "";
          }}
        />
        <div className="min-w-0">
          <div className="truncate text-sm text-foreground">{profile?.email || "…"}</div>
          <div className="text-[11px] text-muted-foreground">Tap the photo to pick from your gallery</div>
        </div>
      </div>

      <div>
        <label className="block text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Nickname — what Elliot calls you
        </label>
        <div className="mt-2 flex gap-2">
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value.slice(0, 40))}
            placeholder="e.g. Charlie"
            className="flex-1 rounded-xl border border-border bg-input/40 px-3 py-2.5 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/30"
          />
          <button
            onClick={async () => {
              try {
                await save({ nickname: nickname.trim() });
                toast.success(nickname.trim() ? `Elliot will call you ${nickname.trim()}.` : "Nickname cleared.");
              } catch (e: any) {
                toast.error(e?.message || "Couldn't save.");
              }
            }}
            className="rounded-xl px-4 text-sm font-medium text-primary-foreground shadow-[var(--shadow-ember)] active:scale-[0.98]"
            style={{ background: "var(--gradient-ember)" }}
          >
            Save
          </button>
        </div>
      </div>

      <div className="space-y-2 pt-1">
        <button
          onClick={onSwitch}
          className="flex w-full items-center gap-2 rounded-xl border border-border bg-background/40 px-4 py-3 text-sm transition hover:border-primary/50"
        >
          <Repeat className="h-4 w-4 text-primary-glow" /> Switch accounts
        </button>
        <button
          onClick={async () => {
            await supabase.auth.signOut();
            navigate({ to: "/login", search: {} });
          }}
          className="flex w-full items-center gap-2 rounded-xl border border-border bg-background/40 px-4 py-3 text-sm text-muted-foreground transition hover:border-destructive/50 hover:text-foreground"
        >
          <LogOut className="h-4 w-4" /> Log out
        </button>
      </div>
    </div>
  );
}

function SwitchPane() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<RememberedAccount[]>([]);

  useEffect(() => {
    setAccounts(listAccounts());
  }, []);

  async function goTo(email?: string) {
    await supabase.auth.signOut();
    leaveGuest();
    navigate({ to: "/login", search: email ? { email } : {} });
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Accounts used on this device. Choosing one signs you out and takes you to the login screen for it.
      </p>
      {accounts.length === 0 ? (
        <div className="rounded-xl border border-border/70 bg-background/40 px-4 py-6 text-center text-xs text-muted-foreground">
          No other accounts remembered yet.
        </div>
      ) : (
        accounts.map((a) => (
          <div
            key={a.email}
            className="flex items-center gap-2 rounded-xl border border-border/70 bg-background/40 px-4 py-3"
          >
            <UserRound className="h-4 w-4 shrink-0 text-primary-glow" />
            <button onClick={() => goTo(a.email)} className="min-w-0 flex-1 truncate text-left text-sm">
              {a.email}
            </button>
            <button
              onClick={() => {
                forgetAccount(a.email);
                setAccounts(listAccounts());
              }}
              className="text-[11px] text-muted-foreground transition hover:text-destructive"
            >
              Forget
            </button>
          </div>
        ))
      )}
      <button
        onClick={() => goTo()}
        className="w-full rounded-xl px-4 py-3 text-sm font-medium text-primary-foreground shadow-[var(--shadow-ember)] active:scale-[0.99]"
        style={{ background: "var(--gradient-ember)" }}
      >
        Log in / create another account
      </button>
    </div>
  );
}
