import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useGlassBootstrap } from "@/lib/appearance";

import { supabase } from "@/integrations/supabase/client";
import { ConversationSidebar } from "@/components/ConversationSidebar";
import { AmbientBackground } from "@/components/AmbientBackground";
import { Toaster } from "@/components/ui/sonner";
import logo from "@/assets/elliot-logo.png";

const ShellCtx = createContext<{ openSidebar: () => void } | null>(null);
export const useShell = () => useContext(ShellCtx);

export function ChatShell({
  activeId,
  guest,
  children,
}: {
  activeId?: string;
  guest?: boolean;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  useGlassBootstrap();

  useEffect(() => {
    if (guest) {
      setReady(true);
      return;
    }
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      if (!data.session) navigate({ to: "/login", search: {}, replace: true });
      else setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) navigate({ to: "/login", search: {}, replace: true });
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [navigate, guest]);


  // Body scroll lock while mobile sidebar is open
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (mobileOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [mobileOpen]);

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

  const mobileOverlay =
    typeof document !== "undefined"
      ? createPortal(
          <AnimatePresence>
            {mobileOpen && (
              <div className="md:hidden">
                <motion.div
                  initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
                  animate={{ opacity: 1, backdropFilter: "blur(10px)" }}
                  exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
                  transition={{ duration: 0.26, ease: "easeOut" }}
                  className="fixed inset-0 z-[1000] bg-background/70"
                  onClick={() => setMobileOpen(false)}
                />
                <motion.div
                  initial={{ x: "-100%", filter: "blur(6px)" }}
                  animate={{ x: 0, filter: "blur(0px)" }}
                  exit={{ x: "-100%", filter: "blur(6px)" }}
                  transition={{ type: "spring", stiffness: 320, damping: 34 }}
                  className="fixed inset-y-0 left-0 z-[1001]"
                >
                  <ConversationSidebar
                    activeId={activeId}
                    guest={guest}
                    onClose={() => setMobileOpen(false)}
                  />
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body,
        )
      : null;

  return (
    <ShellCtx.Provider value={{ openSidebar: () => setMobileOpen(true) }}>
      <div className="relative flex h-[100dvh] overflow-hidden">
        <Toaster />
        <AmbientBackground />

        <div className="hidden md:flex">
          <ConversationSidebar activeId={activeId} guest={guest} />
        </div>


        <main className="flex min-w-0 flex-1 flex-col">{children}</main>
      </div>
      {mobileOverlay}
    </ShellCtx.Provider>
  );
}
