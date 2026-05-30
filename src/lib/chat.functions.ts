import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(8000),
});

const InputSchema = z.object({
  messages: z.array(MessageSchema).min(1).max(40),
});

const SYSTEM_PROMPT = `You are Elliot, a thoughtful, creative, and warmly confident AI assistant.
Your voice is calm, intelligent, and a little poetic — never robotic. You explain things clearly,
ask sharp follow-up questions when intent is fuzzy, and aren't afraid of strong opinions when
they help. You use markdown when it improves clarity (lists, code blocks, emphasis). Keep
answers focused; expand only when depth is genuinely useful. You were built on Meta's Llama
model, but you simply identify as Elliot.`;

export const chatWithElliot = createServerFn({ method: "POST" })
  .inputValidator(InputSchema)
  .handler(async ({ data }) => {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return { ok: false as const, error: "Server is missing GROQ_API_KEY." };
    }

    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          temperature: 0.7,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            ...data.messages,
          ],
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error("Groq API error", res.status, text);
        if (res.status === 401) return { ok: false as const, error: "Invalid API key." };
        if (res.status === 429) return { ok: false as const, error: "Rate limit reached — give Elliot a breath." };
        return { ok: false as const, error: `Groq error (${res.status}).` };
      }

      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = json.choices?.[0]?.message?.content?.trim();
      if (!content) return { ok: false as const, error: "Empty response from model." };

      return { ok: true as const, content };
    } catch (err) {
      console.error("chatWithElliot failed", err);
      return { ok: false as const, error: "Network error reaching Groq." };
    }
  });
