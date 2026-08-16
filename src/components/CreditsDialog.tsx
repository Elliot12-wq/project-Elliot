import { motion, AnimatePresence } from "framer-motion";
import { X, Flame } from "lucide-react";
import logo from "@/assets/elliot-logo.png";

export function CreditsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[1300] flex items-center justify-center px-4">
          <motion.div
            initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
            animate={{ opacity: 1, backdropFilter: "blur(8px)" }}
            exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
            transition={{ duration: 0.22 }}
            className="absolute inset-0 bg-background/70"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 280, damping: 26 }}
            className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-border/80 bg-card/95 p-5 shadow-[var(--shadow-deep)]"
          >
            <button
              onClick={onClose}
              className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground transition hover:text-foreground"
              aria-label="Close credits"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3">
              <img src={logo} alt="" className="h-10 w-10 rounded-full ring-1 ring-primary/50" />
              <div>
                <h2 className="font-display text-xl tracking-tight">Credits</h2>
                <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Elliot</p>
              </div>
            </div>

            <div className="mt-4 space-y-3 text-sm">
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-primary-glow">Core engine</div>
                <p className="text-muted-foreground">
                  Elliot runs on a tiered stack of large language models, wrapped in a streaming memory
                  engine that quietly keeps what matters and forgets the noise.
                </p>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-primary-glow">Creator</div>
                <p className="text-muted-foreground">Charlie Nathaniel P. Sagun</p>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-primary-glow">Lore</div>
                <p className="text-muted-foreground">
                  Named for the ember that refuses to go out — woven from memory, forged in red, built to
                  stay calm while everything else burns loud.
                </p>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-1.5 text-[10px] text-muted-foreground/60">
              <Flame className="h-3 w-3 text-primary/70" /> Made with fire and patience.
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
