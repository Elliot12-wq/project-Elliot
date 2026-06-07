import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  ELLIOT_UTILITY_MODEL,
  ELLIOT_VISION_MODEL,
  getElliotVersion,
} from "@/lib/elliot-models";

const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";

const jsonError = (status: number, error: string) =>
  new Response(JSON.stringify({ error }), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const groqKey = process.env.GROQ_API_KEY;
        if (!groqKey) {
          console.error("GROQ_API_KEY missing");
          return jsonError(500, "Groq is not configured yet.");
        }

        let body: {
          conversationId?: string;
          userMessage?: string;
          imageUrls?: string[];
          version?: string;
          guest?: boolean;
          history?: Array<{ role: "user" | "assistant"; content: string }>;
        };
        try {
          body = await request.json();
        } catch {
          return jsonError(400, "Bad request body.");
        }

        const userMessage = String(body.userMessage ?? "").slice(0, 8000);
        const imageUrls = Array.isArray(body.imageUrls)
          ? body.imageUrls
              .filter((u): u is string => typeof u === "string" && u.startsWith("http"))
              .slice(0, 4)
          : [];
        if (!userMessage.trim() && imageUrls.length === 0) {
          return jsonError(400, "Missing message.");
        }

        const version = getElliotVersion(body.version);
        const useVision = imageUrls.length > 0;
        const model = useVision ? ELLIOT_VISION_MODEL : version.groqModel;

        const SYSTEM_BASE = `You are Elliot, a thoughtful, creative, warmly confident AI assistant.
Calm, intelligent, a little poetic — never robotic. Use markdown when it helps (lists, code, emphasis).
You simply identify as Elliot. You are currently running as ${version.label} — ${version.tagline}.`;

        // ============ GUEST PATH — no auth, no DB ============
        if (body.guest === true) {
          const history = Array.isArray(body.history)
            ? body.history
                .filter(
                  (m) =>
                    m &&
                    (m.role === "user" || m.role === "assistant") &&
                    typeof m.content === "string",
                )
                .slice(-20)
            : [];

          const lastUser = buildUserTurn(userMessage, imageUrls, useVision);
          const messages = [
            { role: "system", content: SYSTEM_BASE + "\n\n(Guest session — no memory persists across visits.)" },
            ...history,
            lastUser,
          ];

          return streamGroq(groqKey, model, version.temperature, messages);
        }

        // ============ AUTHENTICATED PATH ============
        const authHeader = request.headers.get("authorization") ?? "";
        const token = authHeader.replace(/^Bearer\s+/i, "");
        if (!token) return jsonError(401, "Not signed in.");

        const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
        if (userErr || !userData?.user) {
          console.error("chat auth failed", userErr);
          return jsonError(401, "Session expired. Sign in again.");
        }
        const userId = userData.user.id;

        const conversationId = String(body.conversationId ?? "");
        if (!conversationId) return jsonError(400, "Missing conversation.");

        const { data: conv, error: convErr } = await supabaseAdmin
          .from("conversations")
          .select("id, user_id, title")
          .eq("id", conversationId)
          .maybeSingle();
        if (convErr || !conv) return jsonError(404, "Conversation not found.");
        if (conv.user_id !== userId) return jsonError(403, "Not your conversation.");

        const storedContent = [
          userMessage,
          ...imageUrls.map((u) => `![image](${u})`),
        ]
          .filter(Boolean)
          .join("\n\n");

        const { data: userMsgRow, error: insErr } = await supabaseAdmin
          .from("messages")
          .insert({
            conversation_id: conversationId,
            user_id: userId,
            role: "user",
            content: storedContent,
          })
          .select("id")
          .single();
        if (insErr) {
          console.error("insert user msg failed", insErr);
          return jsonError(500, "Couldn't save your message.");
        }

        const { data: history } = await supabaseAdmin
          .from("messages")
          .select("role, content")
          .eq("conversation_id", conversationId)
          .order("created_at", { ascending: true });

        const historyForModel = (history ?? []).map((m, idx, arr) => {
          const isLastUser = idx === arr.length - 1 && m.role === "user";
          if (!isLastUser) return m;
          return buildUserTurn(userMessage, imageUrls, useVision);
        });

        const { data: memRows } = await supabaseAdmin
          .from("memories")
          .select("key, value")
          .eq("user_id", userId)
          .order("updated_at", { ascending: false })
          .limit(50);

        const memoryBlock =
          memRows && memRows.length
            ? `\n\nWHAT YOU REMEMBER ABOUT THIS USER (use naturally, never list them back):\n${memRows
                .map((m) => `- ${m.key}: ${m.value}`)
                .join("\n")}`
            : "";

        const messages = [
          { role: "system", content: SYSTEM_BASE + memoryBlock },
          ...historyForModel,
        ];

        const streamRes = await streamGroq(
          groqKey,
          model,
          version.temperature,
          messages,
          {
            onComplete: async (fullText) => {
              if (!fullText.trim()) return;
              const { error: aInsErr } = await supabaseAdmin.from("messages").insert({
                conversation_id: conversationId,
                user_id: userId,
                role: "assistant",
                content: fullText,
              });
              if (aInsErr) console.error("insert assistant msg failed", aInsErr);

              if (conv.title === "New chat") {
                const title = await generateTitle(groqKey, userMessage, fullText);
                if (title) {
                  await supabaseAdmin
                    .from("conversations")
                    .update({ title })
                    .eq("id", conversationId);
                }
              }

              await extractMemories(groqKey, userId, userMessage, fullText, userMsgRow.id);
            },
          },
        );

        return streamRes;
      },
    },
  },
});

function buildUserTurn(text: string, imageUrls: string[], useVision: boolean) {
  if (!useVision || imageUrls.length === 0) {
    return { role: "user" as const, content: text };
  }
  return {
    role: "user" as const,
    content: [
      { type: "text", text: text || "Please look at this image." },
      ...imageUrls.map((url) => ({ type: "image_url", image_url: { url } })),
    ] as unknown as string, // OpenAI-compatible multimodal payload
  };
}

async function streamGroq(
  apiKey: string,
  model: string,
  temperature: number,
  messages: unknown[],
  opts: { onComplete?: (fullText: string) => Promise<void> } = {},
): Promise<Response> {
  let aiRes: Response;
  try {
    aiRes = await fetch(GROQ_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature,
        stream: true,
        messages,
      }),
    });
  } catch (e) {
    console.error("Groq fetch threw", e);
    return jsonError(502, "Couldn't reach Elliot right now.");
  }

  if (!aiRes.ok || !aiRes.body) {
    const text = await aiRes.text().catch(() => "");
    console.error("Groq error", aiRes.status, text);
    if (aiRes.status === 429)
      return jsonError(429, "Elliot is getting too many requests. Try again in a moment.");
    if (aiRes.status === 401)
      return jsonError(500, "Groq API key is invalid.");
    return jsonError(502, "Elliot couldn't start a response. Please try again.");
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let fullText = "";

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
              if (delta) {
                fullText += delta;
                controller.enqueue(encoder.encode(delta));
              }
            } catch {
              /* ignore */
            }
          }
        }
      } catch (e) {
        console.error("stream error", e);
      } finally {
        try {
          if (opts.onComplete) await opts.onComplete(fullText);
        } catch (e) {
          console.error("post-stream work failed", e);
        }
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
}

async function generateTitle(apiKey: string, userMsg: string, reply: string): Promise<string | null> {
  try {
    const res = await fetch(GROQ_CHAT_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: ELLIOT_UTILITY_MODEL,
        temperature: 0.3,
        max_tokens: 24,
        messages: [
          {
            role: "system",
            content:
              "Generate a 3-6 word title for this chat. No quotes, no punctuation at the end. Just the title.",
          },
          { role: "user", content: `User: ${userMsg}\n\nAssistant: ${reply.slice(0, 400)}` },
        ],
      }),
    });
    if (!res.ok) return null;
    const j = await res.json();
    const t = j.choices?.[0]?.message?.content
      ?.trim()
      .replace(/^["']|["']$/g, "")
      .slice(0, 60);
    return t || null;
  } catch {
    return null;
  }
}

async function extractMemories(
  apiKey: string,
  userId: string,
  userMsg: string,
  reply: string,
  sourceMessageId: string,
) {
  try {
    const res = await fetch(GROQ_CHAT_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: ELLIOT_UTILITY_MODEL,
        temperature: 0.1,
        response_format: { type: "json_object" },
        max_tokens: 400,
        messages: [
          {
            role: "system",
            content: `Extract durable, personal facts about the USER worth remembering long-term
(name, role, location, preferences, ongoing projects, relationships, goals, recurring interests).
Ignore one-off questions, generic curiosities, and anything about the assistant.
Return JSON: {"memories":[{"key":"snake_case_label","value":"short factual statement"}]}.
Return {"memories":[]} when nothing notable. Max 5 items. Each value under 200 chars.`,
          },
          { role: "user", content: `User said: ${userMsg}\n\nAssistant replied: ${reply.slice(0, 600)}` },
        ],
      }),
    });
    if (!res.ok) return;
    const j = await res.json();
    const raw = j.choices?.[0]?.message?.content;
    if (!raw) return;
    let parsed: { memories?: Array<{ key: string; value: string }> };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }
    const items = (parsed.memories ?? []).filter(
      (m) =>
        m &&
        typeof m.key === "string" &&
        typeof m.value === "string" &&
        m.key.length < 60 &&
        m.value.length < 240,
    );
    if (!items.length) return;
    await supabaseAdmin.from("memories").upsert(
      items.map((m) => ({
        user_id: userId,
        key: m.key.toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 60),
        value: m.value,
        source_message_id: sourceMessageId,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: "user_id,key" },
    );
  } catch (e) {
    console.error("memory extraction failed", e);
  }
}
