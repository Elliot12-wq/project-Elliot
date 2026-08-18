import { createFileRoute } from "@tanstack/react-router";
import { getAiConfig, aiFetch, streamDeltas } from "@/lib/ai.server";

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

        // Guests are hard-locked to the Elliot 1.0 engine.
        const ai = getAiConfig("1.0");
        if (!ai) return jsonError(500, "AI is not configured on this deployment.");

        const SYSTEM = `You are Elliot, a thoughtful, creative, warmly confident AI assistant.
Calm, intelligent, a little poetic — never robotic. Use markdown when it helps.
You are talking to a guest who is not signed in, so you cannot remember them between sessions.
If they ask you to remember something, gently mention that creating an account lets you remember.
You simply identify as Elliot.`;

        let aiRes: Response;
        try {
          aiRes = await aiFetch(ai, {
            model: ai.chatModel,
            temperature: 0.7,
            stream: true,
            messages: [{ role: "system", content: SYSTEM }, ...messages],
          });
        } catch (e) {
          console.error("guest AI fetch failed", e);
          return jsonError(502, "Couldn't reach Elliot right now.");
        }

        if (!aiRes.ok || !aiRes.body) {
          const text = await aiRes.text().catch(() => "");
          console.error("guest AI error", ai.provider, aiRes.status, text);
          if (aiRes.status === 401 || aiRes.status === 403)
            return jsonError(502, "Elliot's AI key was rejected. Check the deployment's API key.");
          if (aiRes.status === 429) return jsonError(429, "Elliot is getting too many requests. Try again shortly.");
          if (aiRes.status === 402) return jsonError(402, "AI credits are exhausted.");
          return jsonError(502, `Elliot couldn't start a response (upstream ${aiRes.status}).`);
        }

        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          async start(controller) {
            try {
              await streamDeltas(aiRes.body!, (delta) => controller.enqueue(encoder.encode(delta)));
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
