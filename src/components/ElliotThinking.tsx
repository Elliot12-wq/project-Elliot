import { useEffect, useState } from "react";
import logo from "@/assets/elliot-logo.png";

const STATUSES = [
  "Consulting memory…",
  "Gathering embers…",
  "Composing reply…",
  "Polishing words…",
];

export function ElliotThinking() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % STATUSES.length), 1600);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex items-center gap-4 px-4 py-3">
      <div className="relative h-14 w-14">
        {/* halo */}
        <div
          className="absolute inset-[-12px] rounded-full blur-2xl"
          style={{ background: "var(--gradient-glow)", animation: "elliot-halo 2.4s ease-in-out infinite" }}
        />
        {/* rings */}
        <div className="absolute inset-[-4px] rounded-full border border-primary/40" style={{ animation: "elliot-ring-spin 3.8s linear infinite" }}>
          <div className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-primary shadow-[0_0_8px_var(--primary-glow)]" />
        </div>
        <div className="absolute inset-[2px] rounded-full border border-primary/30" style={{ animation: "elliot-ring-spin 2.4s linear infinite reverse" }} />
        <div className="absolute inset-[7px] rounded-full border border-primary/25" style={{ animation: "elliot-ring-spin 1.4s linear infinite" }}>
          <div className="absolute top-1/2 -left-0.5 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-ember shadow-[0_0_6px_var(--primary)]" />
        </div>
        {/* logo */}
        <img
          src={logo}
          alt=""
          className="absolute inset-[14%] h-[72%] w-[72%] rounded-full object-cover ring-1 ring-primary/40"
          style={{ animation: "elliot-breathe 2.6s ease-in-out infinite" }}
        />
        {/* embers */}
        {Array.from({ length: 8 }).map((_, idx) => (
          <span
            key={idx}
            className="absolute left-1/2 top-full h-1 w-1 rounded-full bg-ember"
            style={{
              animation: `elliot-ember-rise ${2.4 + (idx % 4) * 0.4}s ease-out ${idx * 0.25}s infinite`,
              ["--dx" as any]: `${(idx % 2 ? 1 : -1) * (10 + (idx * 5) % 25)}px`,
              filter: "blur(0.5px)",
              boxShadow: "0 0 6px var(--primary-glow)",
            }}
          />
        ))}
      </div>
      <div className="font-display text-lg elliot-shimmer min-w-[160px]">
        {STATUSES[i]}
      </div>
    </div>
  );
}
