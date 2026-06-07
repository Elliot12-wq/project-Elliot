import { useEffect, useState } from "react";

// Guest mode = no Supabase session. All data lives in localStorage on this device.

const GUEST_FLAG = "elliot:guest";
const GUEST_CONVS = "elliot:guest:conversations";
const GUEST_MSGS = (id: string) => `elliot:guest:messages:${id}`;

export type GuestConv = { id: string; title: string; updated_at: string };
export type GuestMsg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeJSON(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota */
  }
}

export const guestStore = {
  isGuest(): boolean {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(GUEST_FLAG) === "true";
  },
  enable() {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(GUEST_FLAG, "true");
  },
  disable() {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(GUEST_FLAG);
  },
  listConversations(): GuestConv[] {
    return readJSON<GuestConv[]>(GUEST_CONVS, []).sort((a, b) =>
      b.updated_at.localeCompare(a.updated_at),
    );
  },
  createConversation(title = "New chat"): GuestConv {
    const conv: GuestConv = {
      id: cryptoRandomId(),
      title,
      updated_at: new Date().toISOString(),
    };
    const list = readJSON<GuestConv[]>(GUEST_CONVS, []);
    list.unshift(conv);
    writeJSON(GUEST_CONVS, list);
    writeJSON(GUEST_MSGS(conv.id), []);
    return conv;
  },
  deleteConversation(id: string) {
    const list = readJSON<GuestConv[]>(GUEST_CONVS, []).filter((c) => c.id !== id);
    writeJSON(GUEST_CONVS, list);
    if (typeof window !== "undefined") window.localStorage.removeItem(GUEST_MSGS(id));
  },
  renameConversation(id: string, title: string) {
    const list = readJSON<GuestConv[]>(GUEST_CONVS, []);
    const i = list.findIndex((c) => c.id === id);
    if (i === -1) return;
    list[i] = { ...list[i], title, updated_at: new Date().toISOString() };
    writeJSON(GUEST_CONVS, list);
  },
  touchConversation(id: string) {
    const list = readJSON<GuestConv[]>(GUEST_CONVS, []);
    const i = list.findIndex((c) => c.id === id);
    if (i === -1) return;
    list[i] = { ...list[i], updated_at: new Date().toISOString() };
    writeJSON(GUEST_CONVS, list);
  },
  getConversation(id: string): GuestConv | null {
    return readJSON<GuestConv[]>(GUEST_CONVS, []).find((c) => c.id === id) ?? null;
  },
  listMessages(convId: string): GuestMsg[] {
    return readJSON<GuestMsg[]>(GUEST_MSGS(convId), []);
  },
  appendMessage(convId: string, msg: GuestMsg) {
    const msgs = readJSON<GuestMsg[]>(GUEST_MSGS(convId), []);
    msgs.push(msg);
    writeJSON(GUEST_MSGS(convId), msgs);
    guestStore.touchConversation(convId);
  },
};

function cryptoRandomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `guest-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function useIsGuest(): boolean {
  const [v, setV] = useState<boolean>(() => guestStore.isGuest());
  useEffect(() => {
    const onStorage = () => setV(guestStore.isGuest());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  return v;
}
