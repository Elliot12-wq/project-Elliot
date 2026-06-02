import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Streaming chat endpoint: validates Supabase bearer, calls Groq SSE,
// streams tokens to the client, persists messages, then runs background
// memory extraction.
export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("authorization") ?? "";
        const token = authHeader.replace(/^Bearer\s+/i, "");
        if (!token) return new Response("Unauthorized", { status: 401 });

        const SUPABASE_URL = process.env.SUPABASE_URL!;
        const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY!;
        const supa = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: claimsData, error: claimsErr } = await supa.auth.getClaims(token);
        if (claimsErr || !claimsData?.claims?.sub) {
          return new Response("Unauthorized", { status: 401 });
        }
        const userId = claimsData.claims.sub as string;

        let body: { conversationId: string; userMessage: string };
        try {
          body = await request.json();
        } catch {
          return new Response("Bad request", { status: 400 });
        }
        const conversationId = String(body.conversationId ?? "");
        const userMessage = String(body.userMessage ?? "").slice(0, 8000);
        if (!conversationId || !userMessage.trim()) {
          return new Response("Bad request", { status: 400 });
        }

        // Verify the conversation belongs to the user
        const { data: conv, error: convErr } = await supabaseAdmin
          .from("conversations")
          .select("id, user_id, title")
          .eq("id", conversationId)
          .single();
        if (convErr || !conv || conv.user_id !== userId) {
          return new Response("Forbidden", { status: 403 });
        }

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
          console.error(insErr);
          return new Response("DB error", { status: 500 });
        }

        // Build history (last 30 messages)
        const { data: history } = await supabaseAdmin
          .from("messages")
          .select("role, content")
          .eq("conversation_id", conversationId)
          .order("created_at", { ascending: true })
          .limit(30);

        // Load memories
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
You were built on Meta's Llama via Groq, but you simply identify as Elliot.${memoryBlock}`;

        const groqKey = process.env.GROQ_API_KEY;
        if (!groqKey) return new Response("Server missing GROQ_API_KEY", { status: 500 });

        const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${groqKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            temperature: 0.7,
            stream: true,
            messages: [
              { role: "system", content: SYSTEM },
              ...(history ?? []),
            ],
          }),
        });

        if (!groqRes.ok || !groqRes.body) {
          const text = await groqRes.text().catch(() => "");
          console.error("Groq error", groqRes.status, text);
          return new Response(`Groq error ${groqRes.status}`, { status: 502 });
        }

        const encoder = new TextEncoder();
        const decoder = new TextDecoder();
        let fullText = "";

        const stream = new ReadableStream({
          async start(controller) {
            const reader = groqRes.body!.getReader();
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

              // Background work: persist assistant message, maybe title, extract memories
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

                  // Auto-title on first reply
                  if (conv.title === "New chat" && fullText.trim()) {
                    const title = await generateTitle(groqKey, userMessage, fullText);
                    if (title) {
                      await supabaseAdmin
                        .from("conversations")
                        .update({ title })
                        .eq("id", conversationId);
                    }
                  }

                  // Memory extraction (silent)
                  await extractMemories(groqKey, supabaseAdmin, userId, userMessage, fullText, userMsgRow.id);
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
  admin: typeof supabaseAdmin,
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
    await admin.from("memories").upsert(
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
