// Remembered accounts on this device — email labels only, never credentials.

const KEY = "elliot.accounts";

export type RememberedAccount = { email: string; lastUsed: number };

export function listAccounts(): RememberedAccount[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as RememberedAccount[]) : [];
  } catch {
    return [];
  }
}

export function rememberAccount(email?: string | null) {
  if (!email) return;
  try {
    const list = listAccounts().filter((a) => a.email !== email);
    list.unshift({ email, lastUsed: Date.now() });
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, 6)));
  } catch {}
}

export function forgetAccount(email: string) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(listAccounts().filter((a) => a.email !== email)));
  } catch {}
}
