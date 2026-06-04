import { createFileRoute, useRouter, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ChatShell } from "@/components/ChatShell";
import { ChatView } from "@/components/ChatView";
import { AmbientBackground } from "@/components/AmbientBackground";

export const Route = createFileRoute("/c/$id")({
  ssr: false,
  head: () => ({ meta: [{ title: "Elliot" }] }),
  component: ConversationPage,
  errorComponent: ConversationError,
});

function ConversationPage() {
  const { id } = Route.useParams();
  return (
    <ChatShell activeId={id}>
      <ChatView conversationId={id} />
    </ChatShell>
  );
}

function ConversationError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  const navigate = useNavigate();
  useEffect(() => {
    console.error("[c.$id] errorComponent caught:", error);
  }, [error]);
  return (
    <div className="relative flex h-[100dvh] items-center justify-center px-6 text-center">
      <AmbientBackground />
      <div className="relative max-w-sm">
        <h1 className="font-display text-2xl tracking-tight text-foreground">
          Couldn't open this chat
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try again or jump back to your latest chat.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="rounded-md px-4 py-2 text-sm font-medium text-primary-foreground shadow-[var(--shadow-ember)]"
            style={{ background: "var(--gradient-ember)" }}
          >
            Try again
          </button>
          <button
            onClick={() => navigate({ to: "/", replace: true })}
            className="rounded-md border border-border bg-background/40 px-4 py-2 text-sm text-foreground hover:bg-card/60"
          >
            Open latest chat
          </button>
        </div>
      </div>
    </div>
  );
}
