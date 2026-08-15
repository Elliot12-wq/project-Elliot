// Guest mode: Elliot without an account. Everything lives on this device only.

export const GUEST_FLAG = "elliot.guest";
export const GUEST_MSGS = "elliot.guest.messages";

export type GuestMsg = { id: string; role: "user" | "assistant"; content: string; created_at?: string };

export function isGuest(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(GUEST_FLAG) === "1";
  } catch {
    return false;
  }
}

export function enterGuest() {
  try {
    window.localStorage.setItem(GUEST_FLAG, "1");
  } catch {}
}

export function leaveGuest() {
  try {
    window.localStorage.removeItem(GUEST_FLAG);
    window.localStorage.removeItem(GUEST_MSGS);
  } catch {}
}

export function loadGuestMessages(): GuestMsg[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(GUEST_MSGS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as GuestMsg[]) : [];
  } catch {
    return [];
  }
}

export function saveGuestMessages(msgs: GuestMsg[]) {
  try {
    window.localStorage.setItem(GUEST_MSGS, JSON.stringify(msgs.slice(-60)));
  } catch {}
}
