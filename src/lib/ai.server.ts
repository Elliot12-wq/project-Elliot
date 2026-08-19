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
  "1.0": "llama-3.1-8b-instant",
  "1.2": "llama-3.3-70b-versatile",
  "2.2": "meta-llama/llama-4-scout-17b-16e-instruct",
  "2.3": "meta-llama/llama-4-maverick-17b-128e-instruct",
};

// Groq Llama models that can read images.
const GROQ_VISION = new Set([
  "meta-llama/llama-4-scout-17b-16e-instruct",
  "meta-llama/llama-4-maverick-17b-128e-instruct",
]);

export type AiConfig = {
  provider: Provider;
  url: string;
  key: string;
  chatModel: string;
  smallModel: string;
  supportsVision: boolean;
};

export function getAiConfig(tier = "1.2"): AiConfig | null {
  const groqKey = process.env["GROQ_API_KEY"];
  const lovableKey = process.env["LOVABLE_API_KEY"];
  // Lovable hosting: built-in gateway. Anywhere else (Vercel): Groq/Llama.
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
  return null;
}


export async function aiFetch(cfg: AiConfig, body: Record<string, unknown>) {
  return fetch(cfg.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.key}`,
      "Content-Type": "application/json",
    },
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
