import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { ConversationSidebar } from "@/components/ConversationSidebar";
import { AmbientBackground } from "@/components/AmbientBackground";
import { Toaster } from "@/components/ui/sonner";

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
          <div
            className="relative h-3 w-3 rounded-full bg-primary"
            style={{ animation: "elliot-breathe 1.6s ease-in-out infinite" }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-[100dvh] overflow-hidden">
      <Toaster />
      <AmbientBackground />

      {/* Desktop sidebar */}
      <div className="hidden md:flex">
        <ConversationSidebar activeId={activeId} />
      </div>

      {/* Mobile drawer */}
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

      <main className="flex min-w-0 flex-1 flex-col">
        <ChildrenWithToggle onToggle={() => setMobileOpen(true)}>{children}</ChildrenWithToggle>
      </main>
    </div>
  );
}

// Tiny helper: pass onToggleSidebar prop down to child route component (which is ChatView)
function ChildrenWithToggle({ children, onToggle }: { children: ReactNode; onToggle: () => void }) {
  if (!children || typeof children !== "object" || !("props" in (children as any))) return <>{children}</>;
  const el = children as any;
  return <el.type {...el.props} onToggleSidebar={onToggle} />;
}
