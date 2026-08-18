import { createFileRoute } from "@tanstack/react-router";
import { userClient } from "@/lib/supabase-user.server";
import { getAiConfig, aiFetch, streamDeltas, type AiConfig } from "@/lib/ai.server";

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

        // Token-scoped client: validates the JWT and applies RLS as this user.
        // No service-role key needed, so this works on any host (Vercel included).
        const db = userClient(token);
        if (!db) {
          console.error("Supabase env missing on server");
          return jsonError(500, "Backend is not configured on this deployment.");
        }

        const { data: userData, error: userErr } = await db.auth.getUser(token);
        if (userErr || !userData?.user) {
          console.error("chat auth failed", userErr);
          return jsonError(401, "Session expired. Sign in again.");
        }
        const userId = userData.user.id;

        let body: { conversationId?: string; userMessage?: string; imageUrls?: string[]; tier?: string };
        try {
          body = await request.json();
        } catch {
          return jsonError(400, "Bad request body.");
        }
        const conversationId = String(body.conversationId ?? "");
        const userMessage = String(body.userMessage ?? "").slice(0, 8000);
        const imageUrls = Array.isArray(body.imageUrls)
          ? body.imageUrls.filter((u): u is string => typeof u === "string" && u.startsWith("http")).slice(0, 4)
          : [];
        const tier = String(body.tier ?? "1.2");

        const ai = getAiConfig(tier);
        if (!ai) {
          console.error("No AI provider key configured (GROQ_API_KEY / LOVABLE_API_KEY)");
          return jsonError(500, "AI is not configured on this deployment.");
        }

        if (imageUrls.length && !ai.supportsVision) {
          return jsonError(
            400,
            "This Elliot model can't read images. Switch to Elliot 2.2 or 2.3 and try again.",
          );
        }

        if (!conversationId || (!userMessage.trim() && imageUrls.length === 0)) {
          return jsonError(400, "Missing conversation or message.");
        }

        // Verify conversation belongs to user (RLS already scopes this).
        const { data: conv, error: convErr } = await db
          .from("conversations")
          .select("id, user_id, title")
          .eq("id", conversationId)
          .maybeSingle();
        if (convErr || !conv) return jsonError(404, "Conversation not found.");
        if (conv.user_id !== userId) return jsonError(403, "Not your conversation.");

        // Persist user message — embed image URLs as markdown so they render in chat
        const storedContent = [userMessage, ...imageUrls.map((u) => `![image](${u})`)]
          .filter(Boolean)
          .join("\n\n");

        const { data: userMsgRow, error: insErr } = await db
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

        // Build complete history for this conversation (text-only for prior turns).
        const { data: history } = await db
          .from("messages")
          .select("role, content")
          .eq("conversation_id", conversationId)
          .order("created_at", { ascending: true });

        // Replace the just-stored user turn with a multimodal version so the model sees the image
        const historyForModel = (history ?? []).map((m, idx, arr) => {
          const isLastUser = idx === arr.length - 1 && m.role === "user";
          if (!isLastUser || imageUrls.length === 0) return m;
          return {
            role: "user",
            content: [
              { type: "text", text: userMessage || "Please look at this image." },
              ...imageUrls.map((url) => ({ type: "image_url", image_url: { url } })),
            ],
          };
        });

        // Memory: only inject when this is a continuing conversation.
        const priorTurns = Math.max(0, (history?.length ?? 0) - 1);
        let memoryBlock = "";
        if (priorTurns > 0) {
          const { data: memRows } = await db
            .from("memories")
            .select("key, value")
            .eq("user_id", userId)
            .order("updated_at", { ascending: false })
            .limit(50);
          if (memRows && memRows.length) {
            memoryBlock = `\n\nWHAT YOU REMEMBER ABOUT THIS USER (use naturally, never list them back):\n${memRows
              .map((m) => `- ${m.key}: ${m.value}`)
              .join("\n")}`;
          }
        }

        // Custom user instructions apply to every conversation.
        const { data: instrRow } = await db
          .from("user_instructions")
          .select("content")
          .eq("user_id", userId)
          .maybeSingle();
        const instructions = (instrRow?.content ?? "").trim();
        const instructionsBlock = instructions
          ? `\n\nUSER'S CUSTOM INSTRUCTIONS (follow these unless they conflict with safety):\n${instructions}`
          : "";

        // Nickname / persona the user chose in Settings.
        const { data: profileRow } = await db
          .from("profiles")
          .select("nickname")
          .eq("user_id", userId)
          .maybeSingle();
        const nickname = String(profileRow?.nickname ?? "").trim();
        const nicknameBlock = nickname ? `\n\nThe user prefers to be called "${nickname}". Use it naturally.` : "";

        const SYSTEM = `You are Elliot, a thoughtful, creative, warmly confident AI assistant.
Calm, intelligent, a little poetic — never robotic. Use markdown when it helps (lists, code, emphasis).
You simply identify as Elliot.${nicknameBlock}${instructionsBlock}${memoryBlock}`;

        let aiRes: Response;
        try {
          aiRes = await aiFetch(ai, {
            model: ai.chatModel,
            temperature: 0.7,
            stream: true,
            messages: [{ role: "system", content: SYSTEM }, ...historyForModel],
          });
        } catch (e) {
          console.error("AI fetch threw", e);
          return jsonError(502, "Couldn't reach Elliot right now.");
        }

        if (!aiRes.ok || !aiRes.body) {
          const text = await aiRes.text().catch(() => "");
          console.error("AI provider error", ai.provider, aiRes.status, text);
          if (aiRes.status === 401 || aiRes.status === 403)
            return jsonError(502, "Elliot's AI key was rejected. Check the deployment's API key.");
          if (aiRes.status === 429) return jsonError(429, "Elliot is getting too many requests. Try again in a moment.");
          if (aiRes.status === 402) return jsonError(402, "AI credits are exhausted.");
          if (aiRes.status === 400) return jsonError(400, `Model refused this request: ${text.slice(0, 200) || "bad request"}`);
          return jsonError(502, `Elliot couldn't start a response (upstream ${aiRes.status}).`);
        }

        const encoder = new TextEncoder();
        let fullText = "";

        const stream = new ReadableStream({
          async start(controller) {
            try {
              await streamDeltas(aiRes.body!, (delta) => {
                fullText += delta;
                controller.enqueue(encoder.encode(delta));
              });
            } catch (e) {
              console.error("stream error", e);
            } finally {
              try {
                if (fullText.trim()) {
                  const { error: aInsErr } = await db.from("messages").insert({
                    conversation_id: conversationId,
                    user_id: userId,
                    role: "assistant",
                    content: fullText,
                  });
                  if (aInsErr) console.error("insert assistant msg failed", aInsErr);
                }

                if (conv.title === "New chat" && fullText.trim()) {
                  const title = await generateTitle(ai, userMessage, fullText);
                  if (title) {
                    await db.from("conversations").update({ title }).eq("id", conversationId);
                  }
                }

                await extractMemories(ai, db, userId, userMessage, fullText, userMsgRow.id);
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
      },
    },
  },
});

async function generateTitle(ai: AiConfig, userMsg: string, reply: string): Promise<string | null> {
  try {
    const res = await aiFetch(ai, {
      model: ai.smallModel,
      temperature: 0.3,
      max_tokens: 24,
      messages: [
        {
          role: "system",
          content: "Generate a 3-6 word title for this chat. No quotes, no punctuation at the end. Just the title.",
        },
        { role: "user", content: `User: ${userMsg}\n\nAssistant: ${reply.slice(0, 400)}` },
      ],
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
  ai: AiConfig,
  db: NonNullable<ReturnType<typeof userClient>>,
  userId: string,
  userMsg: string,
  reply: string,
  sourceMessageId: string,
) {
  try {
    const res = await aiFetch(ai, {
      model: ai.smallModel,
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
    await db.from("memories").upsert(
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
