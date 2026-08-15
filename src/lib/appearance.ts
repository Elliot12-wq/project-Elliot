import { useCallback, useEffect, useState } from "react";

const GLASS_KEY = "elliot.liquidGlass";

export function isAndroid() {
  if (typeof navigator === "undefined") return false;
  return /android/i.test(navigator.userAgent);
}

function readGlass() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(GLASS_KEY) === "1";
  } catch {
    return false;
  }
}

export function applyGlass(on: boolean) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("liquid-glass", on);
  // Android GPUs choke on heavy backdrop blur — use the lighter variant there.
  root.classList.toggle("glass-lite", on && isAndroid());
}

/** Applies the saved preference on mount. Mount once, high in the tree. */
export function useGlassBootstrap() {
  useEffect(() => {
    applyGlass(readGlass());
  }, []);
}

export function useLiquidGlass() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(readGlass());
  }, []);

  const toggle = useCallback((next: boolean) => {
    setEnabled(next);
    try {
      window.localStorage.setItem(GLASS_KEY, next ? "1" : "0");
    } catch {}
    applyGlass(next);
  }, []);

  return { enabled, toggle, android: isAndroid() };
}
