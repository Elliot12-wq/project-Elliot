// Server-only: a Supabase client scoped to the caller's own access token.
// Works anywhere (Lovable hosting, Vercel) because it only needs the public key —
// no service-role key required.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export function userClient(token: string) {
  const url = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"];
  const key =
    process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) return null;

  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        h.set("apikey", key);
        h.set("Authorization", `Bearer ${token}`);
        return fetch(input as RequestInfo, { ...init, headers: h });
      },
    },
  });
}
