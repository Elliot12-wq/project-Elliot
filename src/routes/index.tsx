import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AmbientBackground } from "@/components/AmbientBackground";
import { isGuest } from "@/lib/guest";
import logo from "@/assets/elliot-logo.png";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Elliot — AI that remembers" },
      { name: "description", content: "Elliot is a thoughtful AI companion that quietly remembers what matters." },
    ],
    links: [{ rel: "icon", href: logo }],
  }),
  component: IndexRedirect,
});

// Bounce to /login or create a fresh conversation and bounce to /c/$id
function IndexRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    let done = false;
    const go = async (userId: string) => {
      if (done) return;
      done = true;
      const { data: latest } = await supabase
        .from("conversations")
        .select("id")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latest?.id) {
        navigate({ to: "/c/$id", params: { id: latest.id }, replace: true });
        return;
      }
      const { data: created } = await supabase
        .from("conversations")
        .insert({ user_id: userId, title: "New chat" })
        .select("id")
        .single();
      if (created?.id) {
        navigate({ to: "/c/$id", params: { id: created.id }, replace: true });
      }
    };

    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (s.session) {
        go(s.session.user.id);
      } else if (isGuest()) {
        done = true;
        navigate({ to: "/guest", replace: true });
      } else {

        // Wait briefly for auth to hydrate; fall back to /login
        const t = setTimeout(() => {
          if (!done) {
            done = true;
            navigate({ to: "/login", search: {}, replace: true });
          }
        }, 1200);
        const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
          if (session && !done) {
            clearTimeout(t);
            go(session.user.id);
            sub.subscription.unsubscribe();
          }
        });
      }
    })();
  }, [navigate]);

  return (
    <div className="flex h-[100dvh] items-center justify-center">
      <AmbientBackground />
      <div className="relative">
        <div
          className="absolute inset-[-30px] rounded-full blur-3xl"
          style={{ background: "var(--gradient-glow)", animation: "elliot-halo 2s ease-in-out infinite" }}
        />
        <img
          src={logo}
          alt="Elliot"
          className="relative h-14 w-14 rounded-full ring-1 ring-primary/50"
          style={{ animation: "elliot-breathe 2.2s ease-in-out infinite" }}
        />
      </div>
    </div>
  );
}
