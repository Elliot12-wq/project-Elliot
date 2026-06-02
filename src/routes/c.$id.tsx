import { createFileRoute } from "@tanstack/react-router";
import { ChatShell } from "@/components/ChatShell";
import { ChatView } from "@/components/ChatView";

export const Route = createFileRoute("/c/$id")({
  head: () => ({ meta: [{ title: "Elliot" }] }),
  component: ConversationPage,
});

function ConversationPage() {
  const { id } = Route.useParams();
  return (
    <ChatShell activeId={id}>
      <ChatView conversationId={id} />
    </ChatShell>
  );
}
