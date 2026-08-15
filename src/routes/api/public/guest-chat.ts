import { createFileRoute } from "@tanstack/react-router";

const AI_CHAT_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
// Guests are hard-locked to the Elliot 1.0 engine. No other tier is reachable here.
const GUEST_MODEL = "google/gemini-2.5-flash-lite";

const jsonError = (status: number, error: string) =>
  new Response(JSON.stringify({ error }), {
    status,
    headers: { "Content-Type": "application/json" },
  });

// Simple in-memory rate limit per IP (best effort — instance-local).
const hits = new Map<string, { n: number; reset: number }>();
const LIMIT = 20;
const WINDOW_MS = 60_000;

function rateLimited(ip: string) {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now > entry.reset) {
    hits.set(ip, { n: 1, reset: now + WINDOW_MS });
    return false;
  }
  entry.n += 1;
  return entry.n > LIMIT;
}

type InMsg = { role: "user" | "assistant"; content: string };

export const Route = createFileRoute("/api/public/guest-chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ip =
          request.headers.get("cf-connecting-ip") ||
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          "unknown";
        if (rateLimited(ip)) {
          return jsonError(429, "Guest mode is busy right now. Try again in a minute, or sign in.");
        }

        let body: { messages?: unknown };
        try {
          body = await request.json();
        } catch {
          return jsonError(400, "Bad request body.");
        }

        const raw = Array.isArray(body.messages) ? body.messages : [];
        const messages: InMsg[] = raw
          .filter(
            (m): m is InMsg =>
              !!m &&
              typeof (m as InMsg).content === "string" &&
              ((m as InMsg).role === "user" || (m as InMsg).role === "assistant"),
          )
          // Guests send text only — no images.
          .map((m) => ({ role: m.role, content: String(m.content).slice(0, 4000) }))
          .slice(-16);

        if (!messages.length || messages[messages.length - 1].role !== "user") {
          return jsonError(400, "Missing message.");
        }

        const aiKey = process.env.LOVABLE_API_KEY;
        if (!aiKey) return jsonError(500, "AI is not configured yet.");

        const SYSTEM = `You are Elliot, a thoughtful, creative, warmly confident AI assistant.
Calm, intelligent, a little poetic — never robotic. Use markdown when it helps.
You are talking to a guest who is not signed in, so you cannot remember them between sessions.
If they ask you to remember something, gently mention that creating an account lets you remember.
You simply identify as Elliot.`;

        let aiRes: Response;
        try {
          aiRes = await fetch(AI_CHAT_URL, {
            method: "POST",
            headers: { Authorization: `Bearer ${aiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: GUEST_MODEL,
              temperature: 0.7,
              stream: true,
              messages: [{ role: "system", content: SYSTEM }, ...messages],
            }),
          });
        } catch (e) {
          console.error("guest AI fetch failed", e);
          return jsonError(502, "Couldn't reach Elliot right now.");
        }

        if (!aiRes.ok || !aiRes.body) {
          const text = await aiRes.text().catch(() => "");
          console.error("guest AI gateway error", aiRes.status, text);
          if (aiRes.status === 429) return jsonError(429, "Elliot is getting too many requests. Try again shortly.");
          if (aiRes.status === 402) return jsonError(402, "AI credits are exhausted.");
          return jsonError(502, `Elliot couldn't start a response (upstream ${aiRes.status}).`);
        }

        const encoder = new TextEncoder();
        const decoder = new TextDecoder();

        const stream = new ReadableStream({
          async start(controller) {
            const reader = aiRes.body!.getReader();
            let buffer = "";
            try {
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
                  if (payload === "[DONE]") continue;
                  try {
                    const json = JSON.parse(payload);
                    const delta = json.choices?.[0]?.delta?.content;
                    if (delta) controller.enqueue(encoder.encode(delta));
                  } catch {
                    /* ignore */
                  }
                }
              }
            } catch (e) {
              console.error("guest stream error", e);
            } finally {
              controller.close();
            }
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
          },
        });
      },
    },
  },
});
