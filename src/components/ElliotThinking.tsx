import { useMemo } from "react";
import logo from "@/assets/elliot-logo.png";

/**
 * Elliot's thinking animation:
 * - Logo centered, breathing crimson halo behind it
 * - Three concentric rings rotating at different speeds
 * - Ember particles drifting upward
 * - Shimmering "Elliot is thinking…" caption
 */
export function ElliotThinking() {
  const embers = useMemo(
    () =>
      Array.from({ length: 8 }, (_, i) => ({
        id: i,
        left: 35 + Math.random() * 30,
        delay: Math.random() * 2,
        duration: 2.2 + Math.random() * 1.6,
        dx: (Math.random() - 0.5) * 60,
        size: 3 + Math.random() * 4,
      })),
    [],
  );

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="relative h-16 w-16 shrink-0">
        {/* Breathing halo */}
        <div
          className="absolute inset-0 rounded-full blur-2xl"
          style={{
            background: "var(--gradient-glow)",
            animation: "elliot-halo 2.4s ease-in-out infinite",
          }}
        />

        {/* Ring 1 — outer, slow */}
        <div
          className="absolute inset-[-10px] rounded-full border border-transparent"
          style={{
            borderTopColor: "var(--color-primary)",
            borderRightColor: "var(--color-primary-glow)",
            animation: "elliot-ring-spin 3.8s linear infinite",
          }}
        />
        {/* Ring 2 — middle, reverse */}
        <div
          className="absolute inset-[-4px] rounded-full border border-transparent"
          style={{
            borderBottomColor: "var(--color-ember)",
            borderLeftColor: "var(--color-primary)",
            animation: "elliot-ring-spin 2.4s linear infinite reverse",
          }}
        />
        {/* Ring 3 — inner, fast */}
        <div
          className="absolute inset-[2px] rounded-full border border-transparent"
          style={{
            borderTopColor: "var(--color-primary-glow)",
            animation: "elliot-ring-spin 1.4s cubic-bezier(0.5, 0, 0.5, 1) infinite",
          }}
        />

        {/* Logo */}
        <div
          className="absolute inset-1.5 overflow-hidden rounded-full ring-1 ring-primary/40"
          style={{ animation: "elliot-breathe 2.4s ease-in-out infinite" }}
        >
          <img src={logo} alt="" className="h-full w-full object-cover" />
        </div>

        {/* Ember particles */}
        <div className="pointer-events-none absolute inset-0 overflow-visible">
          {embers.map((e) => (
            <span
              key={e.id}
              className="absolute bottom-0 rounded-full"
              style={{
                left: `${e.left}%`,
                width: e.size,
                height: e.size,
                background: "var(--color-ember)",
                boxShadow: "0 0 8px var(--color-ember)",
                animation: `elliot-ember-rise ${e.duration}s ease-out ${e.delay}s infinite`,
                ["--dx" as string]: `${e.dx}px`,
              }}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col">
        <span className="elliot-shimmer font-display text-lg leading-tight">
          Elliot is thinking
        </span>
        <span className="text-xs text-muted-foreground">
          weaving a thoughtful reply…
        </span>
      </div>
    </div>
  );
}
