// Server-only AI provider switch.
// Uses Groq (Llama) when GROQ_API_KEY is present (e.g. on Vercel),
// otherwise falls back to the built-in Lovable AI gateway.
// Keys are read inside functions — never at module scope, never sent to the browser.

const LOVABLE_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

export type Provider = "groq" | "lovable";

const LOVABLE_TIER_MODEL: Record<string, string> = {
  "1.0": "google/gemini-2.5-flash-lite",
  "1.2": "google/gemini-2.5-flash",
  "2.2": "google/gemini-2.5-pro",
  "2.3": "google/gemini-2.5-pro",
};

const GROQ_TIER_MODEL: Record<string, string> = {
  "1.0": "openai/gpt-oss-20b",
  "1.2": "openai/gpt-oss-120b",
  "2.2": "groq/compound-mini",
  "2.3": "groq/compound",
};

// Groq models on this account that can read images.
const GROQ_VISION = new Set(["groq/compound-mini", "groq/compound"]);


export type AiConfig = {
  provider: Provider;
  url: string;
  key: string;
  chatModel: string;
  smallModel: string;
  supportsVision: boolean;
};

function env(name: string): string | undefined {
  const fromProcess =
    typeof process !== "undefined" ? (process.env as Record<string, string | undefined>)[name] : undefined;
  const fromVite = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.[name];
  const value = fromProcess || fromVite;
  return value?.trim() || undefined;
}

export function getAiConfig(tier = "1.2"): AiConfig | null {
  const groqKey = env("GROQ_API_KEY");
  const lovableKey = env("LOVABLE_API_KEY");

  // Groq is Elliot's primary engine. Lovable is a hosting fallback only.
  if (groqKey) {
    const chatModel = GROQ_TIER_MODEL[tier] ?? GROQ_TIER_MODEL["1.2"]!;
    return {
      provider: "groq",
      url: GROQ_URL,
      key: groqKey,
      chatModel,
      smallModel: GROQ_TIER_MODEL["1.0"]!,
      supportsVision: GROQ_VISION.has(chatModel),
    };
  }
  if (lovableKey) {
    return {
      provider: "lovable",
      url: LOVABLE_URL,
      key: lovableKey,
      chatModel: LOVABLE_TIER_MODEL[tier] ?? LOVABLE_TIER_MODEL["1.2"]!,
      smallModel: LOVABLE_TIER_MODEL["1.0"]!,
      supportsVision: true,
    };
  }
  return null;
}


export async function aiFetch(cfg: AiConfig, body: Record<string, unknown>) {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (cfg.provider === "lovable") {
    headers.set("Lovable-API-Key", cfg.key);
    headers.set("X-Lovable-AIG-SDK", "direct-fetch");
  } else {
    headers.set("Authorization", `Bearer ${cfg.key}`);
  }

  return fetch(cfg.url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

/** Parse an OpenAI-compatible SSE stream into plain text deltas. */
export function streamDeltas(
  source: ReadableStream<Uint8Array>,
  onDelta: (text: string) => void,
): Promise<void> {
  const decoder = new TextDecoder();
  const reader = source.getReader();
  return (async () => {
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const json = JSON.parse(payload);
          const delta = json.choices?.[0]?.delta?.content;
          if (typeof delta === "string" && delta) onDelta(delta);
        } catch {
          /* ignore partial frames */
        }
      }
    }
  })();
}
