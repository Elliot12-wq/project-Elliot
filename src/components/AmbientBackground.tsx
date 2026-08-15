// Slow-drifting radial gradients + grain + vignette. Pure CSS, GPU-friendly.
export function AmbientBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        className="absolute -left-40 top-[-10%] h-[60vmax] w-[60vmax] rounded-full opacity-[0.35] blur-[140px] will-change-transform"
        style={{
          background: "radial-gradient(circle, oklch(0.55 0.22 25 / 80%), transparent 70%)",
          animation: "ambient-drift-1 34s ease-in-out infinite alternate",
        }}
      />
      <div
        className="absolute -right-40 bottom-[-10%] h-[55vmax] w-[55vmax] rounded-full opacity-[0.28] blur-[160px] will-change-transform"
        style={{
          background: "radial-gradient(circle, oklch(0.42 0.18 18 / 75%), transparent 70%)",
          animation: "ambient-drift-2 44s ease-in-out infinite alternate",
        }}
      />
      <div
        className="absolute left-1/2 top-1/3 h-[40vmax] w-[40vmax] -translate-x-1/2 rounded-full opacity-[0.16] blur-[170px] will-change-transform"
        style={{
          background: "radial-gradient(circle, oklch(0.7 0.24 32 / 70%), transparent 70%)",
          animation: "ambient-drift-2 56s ease-in-out infinite alternate-reverse",
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.06] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.7'/></svg>\")",
        }}
      />
      {/* vignette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 55%, oklch(0 0 0 / 30%) 100%)",
        }}
      />
    </div>
  );
}
