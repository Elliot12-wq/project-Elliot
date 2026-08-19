// Server-only: a Supabase client scoped to the caller's own access token.
// Works anywhere (Lovable hosting, Vercel) because it only needs the public key —
// no service-role key required.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function env(name: string): string | undefined {
  // process.env on Node/Workers; import.meta.env for values inlined at build (Vercel).
  const fromProcess =
    typeof process !== "undefined" ? (process.env as Record<string, string | undefined>)[name] : undefined;
  const fromVite = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.[name];
  return fromProcess || fromVite;
}

export function userClient(token: string) {
  const url = env("SUPABASE_URL") ?? env("VITE_SUPABASE_URL");
  const key = env("SUPABASE_PUBLISHABLE_KEY") ?? env("VITE_SUPABASE_PUBLISHABLE_KEY");
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
