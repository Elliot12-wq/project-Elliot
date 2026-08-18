import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import logo from "@/assets/elliot-logo.png";
import { Toaster } from "@/components/ui/sonner";
import { rememberAccount } from "@/lib/accounts";
import { enterGuest, leaveGuest } from "@/lib/guest";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): { email?: string } =>
    typeof search.email === "string" ? { email: search.email } : {},

  head: () => ({
    meta: [{ title: "Sign in — Elliot" }],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { email: prefill } = Route.useSearch();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState(prefill ?? "");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        rememberAccount(data.session.user.email);
        leaveGuest();
        navigate({ to: "/", replace: true });
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) {
        rememberAccount(session.user.email);
        leaveGuest();
        navigate({ to: "/", replace: true });
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);


  function friendlyAuthError(message: string): string {
    const m = message.toLowerCase();
    if (m.includes("invalid login credentials")) return "Wrong email or password.";
    if (m.includes("password") && m.includes("6")) return "Password must be at least 6 characters.";
    if (m.includes("invalid") && m.includes("email")) return "That email address doesn't look valid.";
    if (m.includes("rate") || m.includes("too many")) return "Too many attempts — wait a moment and try again.";
    return message;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: window.location.origin },
        });

        if (error) {
          const already = /already registered|already exists|user already/i.test(error.message);
          if (!already) throw error;

          // The address exists: try signing them straight in with what they typed.
          const { error: siErr } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });
          if (!siErr) return;

          if (/invalid login credentials/i.test(siErr.message)) {
            setMode("signin");
            toast.error("This email already has an account. Sign in, or use Continue with Google.");
            return;
          }
          throw siErr;
        }

        if (data.session) {
          toast.success("Welcome to Elliot.");
        } else {
          // Confirmation is auto-approved — sign in directly.
          const { error: siErr } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });
          if (siErr) throw siErr;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      }
    } catch (err) {
      toast.error(err instanceof Error ? friendlyAuthError(err.message) : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }


  async function googleSignIn() {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) toast.error("Google sign-in failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden px-4">
      <Toaster />
      <AmbientGlow />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-5 h-20 w-20">
            <div
              className="absolute inset-[-20px] rounded-full blur-3xl"
              style={{ background: "var(--gradient-glow)", animation: "elliot-halo 3s ease-in-out infinite" }}
            />
            <img
              src={logo}
              alt="Elliot"
              className="relative h-20 w-20 rounded-full object-cover ring-1 ring-primary/50"
            />
          </div>
          <h1 className="font-display text-5xl tracking-tight">Elliot</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your AI companion. Woven in red and shadow.
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="mt-8 rounded-2xl border border-border/70 bg-card/60 p-6 backdrop-blur-xl shadow-[var(--shadow-deep)]"
        >
          <label className="block text-xs uppercase tracking-[0.2em] text-muted-foreground">Email</label>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-2 w-full rounded-xl border border-border bg-input/40 px-4 py-3 text-sm outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/30"
          />

          <label className="mt-4 block text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Password
          </label>
          <input
            type="password"
            required
            minLength={6}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-2 w-full rounded-xl border border-border bg-input/40 px-4 py-3 text-sm outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/30"
          />

          <button
            type="submit"
            disabled={loading}
            className="mt-5 w-full rounded-xl py-3 text-sm font-medium text-primary-foreground shadow-[var(--shadow-ember)] transition active:scale-[0.99] disabled:opacity-50"
            style={{ background: "var(--gradient-ember)" }}
          >
            {loading ? "…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>

          <div className="relative my-5 flex items-center">
            <div className="h-px flex-1 bg-border" />
            <span className="px-3 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <button
            type="button"
            onClick={googleSignIn}
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-background/50 py-3 text-sm font-medium transition hover:border-primary/60 hover:bg-card/70 disabled:opacity-50"
          >
            <GoogleIcon /> Continue with Google
          </button>

          <button
            type="button"
            onClick={() => {
              enterGuest();
              navigate({ to: "/guest" });
            }}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-primary/25 bg-primary/5 py-3 text-sm text-foreground/90 transition hover:border-primary/50 hover:bg-primary/10"
          >
            Continue as a guest
          </button>
          <p className="mt-2 text-center text-[10px] text-muted-foreground/70">
            Guests chat with Elliot 1.0 only — photos, voice and memory need an account.
          </p>



          <p className="mt-5 text-center text-xs text-muted-foreground">
            {mode === "signin" ? "New to Elliot?" : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="text-primary-glow underline"
            >
              {mode === "signin" ? "Create an account" : "Sign in"}
            </button>
          </p>
        </form>
      </motion.div>
    </div>
  );
}

function AmbientGlow() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute -left-32 top-1/4 h-[480px] w-[480px] rounded-full opacity-40 blur-[120px]"
        style={{ background: "radial-gradient(circle, oklch(0.55 0.22 25 / 60%), transparent 70%)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 bottom-0 h-[520px] w-[520px] rounded-full opacity-30 blur-[140px]"
        style={{ background: "radial-gradient(circle, oklch(0.4 0.18 22 / 55%), transparent 70%)" }}
      />
    </>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4">
      <path fill="#EA4335" d="M12 11v3.2h7.4c-.3 1.7-2.1 5-7.4 5-4.5 0-8.1-3.7-8.1-8.2S7.5 2.8 12 2.8c2.5 0 4.2 1.1 5.2 2l3-2.9C18.2.9 15.4 0 12 0 5.4 0 0 5.4 0 12s5.4 12 12 12c6.9 0 11.5-4.8 11.5-11.7 0-.8-.1-1.4-.2-2H12z" />
    </svg>
  );
}
