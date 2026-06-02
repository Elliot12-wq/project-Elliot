import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AmbientBackground } from "@/components/AmbientBackground";
import logo from "@/assets/elliot-logo.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Elliot — AI that remembers" },
      { name: "description", content: "Elliot is a thoughtful AI companion that quietly remembers what matters. Powered by Llama via Groq." },
    ],
    links: [{ rel: "icon", href: logo }],
  }),
  component: IndexRedirect,
});

// Bounce to /login or create a fresh conversation and bounce to /c/$id
function IndexRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) {
        navigate({ to: "/login", replace: true });
        return;
      }
      // pick latest or create
      const { data: latest } = await supabase
        .from("conversations")
        .select("id")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latest?.id) {
        navigate({ to: "/c/$id", params: { id: latest.id }, replace: true });
        return;
      }
      const { data: created } = await supabase
        .from("conversations")
        .insert({ user_id: s.session.user.id, title: "New chat" })
        .select("id")
        .single();
      if (created?.id) {
        navigate({ to: "/c/$id", params: { id: created.id }, replace: true });
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
