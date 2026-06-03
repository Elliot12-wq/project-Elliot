import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const AI_CHAT_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const CHAT_MODEL = "google/gemini-3-flash-preview";
const SMALL_MODEL = "google/gemini-3.1-flash-lite-preview";

const jsonError = (status: number, error: string) =>
  new Response(JSON.stringify({ error }), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("authorization") ?? "";
        const token = authHeader.replace(/^Bearer\s+/i, "");
        if (!token) return jsonError(401, "Not signed in.");

        // Validate the user via the admin client (re-validates JWT with Auth server)
        const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
        if (userErr || !userData?.user) {
          console.error("chat auth failed", userErr);
          return jsonError(401, "Session expired. Sign in again.");
        }
        const userId = userData.user.id;

        let body: { conversationId?: string; userMessage?: string };
        try {
          body = await request.json();
        } catch {
          return jsonError(400, "Bad request body.");
        }
        const conversationId = String(body.conversationId ?? "");
        const userMessage = String(body.userMessage ?? "").slice(0, 8000);
        if (!conversationId || !userMessage.trim()) {
          return jsonError(400, "Missing conversation or message.");
        }

        // Verify conversation belongs to user
        const { data: conv, error: convErr } = await supabaseAdmin
          .from("conversations")
          .select("id, user_id, title")
          .eq("id", conversationId)
          .maybeSingle();
        if (convErr || !conv) return jsonError(404, "Conversation not found.");
        if (conv.user_id !== userId) return jsonError(403, "Not your conversation.");

        // Persist user message
        const { data: userMsgRow, error: insErr } = await supabaseAdmin
          .from("messages")
          .insert({
            conversation_id: conversationId,
            user_id: userId,
            role: "user",
            content: userMessage,
          })
          .select("id")
          .single();
        if (insErr) {
          console.error("insert user msg failed", insErr);
          return jsonError(500, "Couldn't save your message.");
        }

        // Build complete history for this conversation.
        const { data: history } = await supabaseAdmin
          .from("messages")
          .select("role, content")
          .eq("conversation_id", conversationId)
          .order("created_at", { ascending: true });

        // Memories
        const { data: memRows } = await supabaseAdmin
          .from("memories")
          .select("key, value")
          .eq("user_id", userId)
          .order("updated_at", { ascending: false })
          .limit(50);

        const memoryBlock = memRows && memRows.length
          ? `\n\nWHAT YOU REMEMBER ABOUT THIS USER (use naturally, never list them back):\n${memRows
              .map((m) => `- ${m.key}: ${m.value}`)
              .join("\n")}`
          : "";

        const SYSTEM = `You are Elliot, a thoughtful, creative, warmly confident AI assistant.
Calm, intelligent, a little poetic — never robotic. Use markdown when it helps (lists, code, emphasis).
You simply identify as Elliot.${memoryBlock}`;

        const aiKey = process.env.LOVABLE_API_KEY;
        if (!aiKey) {
          console.error("LOVABLE_API_KEY missing");
          return jsonError(500, "AI is not configured yet.");
        }

        let aiRes: Response;
        try {
          aiRes = await fetch(AI_CHAT_URL, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${aiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: CHAT_MODEL,
              temperature: 0.7,
              stream: true,
              messages: [
                { role: "system", content: SYSTEM },
                ...(history ?? []),
              ],
            }),
          });
        } catch (e) {
          console.error("AI gateway fetch threw", e);
          return jsonError(502, "Couldn't reach Elliot right now.");
        }

        if (!aiRes.ok || !aiRes.body) {
          const text = await aiRes.text().catch(() => "");
          console.error("AI gateway error", aiRes.status, text);
          if (aiRes.status === 429) return jsonError(429, "Elliot is getting too many requests. Try again in a moment.");
          if (aiRes.status === 402) return jsonError(402, "AI credits are exhausted. Add credits in Workspace usage to continue.");
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
              controller.close();

              (async () => {
                try {
                  if (fullText.trim()) {
                    await supabaseAdmin.from("messages").insert({
                      conversation_id: conversationId,
                      user_id: userId,
                      role: "assistant",
                      content: fullText,
                    });
                  }

                  if (conv.title === "New chat" && fullText.trim()) {
                    const title = await generateTitle(aiKey, userMessage, fullText);
                    if (title) {
                      await supabaseAdmin
                        .from("conversations")
                        .update({ title })
                        .eq("id", conversationId);
                    }
                  }

                  await extractMemories(aiKey, userId, userMessage, fullText, userMsgRow.id);
                } catch (e) {
                  console.error("post-stream work failed", e);
                }
              })();
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

async function generateTitle(groqKey: string, userMsg: string, reply: string): Promise<string | null> {
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${groqKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        temperature: 0.3,
        max_tokens: 24,
        messages: [
          {
            role: "system",
            content: "Generate a 3-6 word title for this chat. No quotes, no punctuation at the end. Just the title.",
          },
          { role: "user", content: `User: ${userMsg}\n\nAssistant: ${reply.slice(0, 400)}` },
        ],
      }),
    });
    if (!res.ok) return null;
    const j = await res.json();
    const t = j.choices?.[0]?.message?.content?.trim().replace(/^["']|["']$/g, "").slice(0, 60);
    return t || null;
  } catch {
    return null;
  }
}

async function extractMemories(
  groqKey: string,
  userId: string,
  userMsg: string,
  reply: string,
  sourceMessageId: string,
) {
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${groqKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
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
      (m) => m && typeof m.key === "string" && typeof m.value === "string" && m.key.length < 60 && m.value.length < 240,
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
