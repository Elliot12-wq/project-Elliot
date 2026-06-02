import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { ConversationSidebar } from "@/components/ConversationSidebar";
import { AmbientBackground } from "@/components/AmbientBackground";
import { Toaster } from "@/components/ui/sonner";
import logo from "@/assets/elliot-logo.png";

const ShellCtx = createContext<{ openSidebar: () => void } | null>(null);
export const useShell = () => useContext(ShellCtx);

export function ChatShell({ activeId, children }: { activeId?: string; children: ReactNode }) {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      if (!data.session) navigate({ to: "/login", replace: true });
      else setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) navigate({ to: "/login", replace: true });
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  if (!ready) {
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
            alt=""
            className="relative h-12 w-12 rounded-full ring-1 ring-primary/50"
            style={{ animation: "elliot-breathe 2.2s ease-in-out infinite" }}
          />
        </div>
      </div>
    );
  }

  return (
    <ShellCtx.Provider value={{ openSidebar: () => setMobileOpen(true) }}>
      <div className="relative flex h-[100dvh] overflow-hidden">
        <Toaster />
        <AmbientBackground />

        <div className="hidden md:flex">
          <ConversationSidebar activeId={activeId} />
        </div>

        {mobileOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm md:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <div className="fixed inset-y-0 left-0 z-50 md:hidden">
              <ConversationSidebar activeId={activeId} onClose={() => setMobileOpen(false)} />
            </div>
          </>
        )}

        <main className="flex min-w-0 flex-1 flex-col">{children}</main>
      </div>
    </ShellCtx.Provider>
  );
}
