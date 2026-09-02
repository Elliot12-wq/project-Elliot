import { createFileRoute } from "@tanstack/react-router";
import { getAiConfig } from "@/lib/ai.server";

export const Route = createFileRoute("/api/public/ai-health")({
  server: {
    handlers: {
      GET: async () => {
        const ai = getAiConfig("1.0");

        return Response.json(
          ai
            ? { ready: true, provider: ai.provider, model: ai.chatModel }
            : {
                ready: false,
                provider: null,
                reason: "No server-side AI provider is configured. Add GROQ_API_KEY to this deployment and redeploy.",
              },
          {
            status: ai ? 200 : 503,
            headers: { "Cache-Control": "no-store" },
          },
        );
      },
    },
  },
});