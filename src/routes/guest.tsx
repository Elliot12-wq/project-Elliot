import { createFileRoute } from "@tanstack/react-router";
import { ChatShell } from "@/components/ChatShell";
import { ChatView } from "@/components/ChatView";
import logo from "@/assets/elliot-logo.png";

export const Route = createFileRoute("/guest")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Guest chat — Elliot" },
      { name: "description", content: "Try Elliot without an account. Guest chats stay on your device." },
      { property: "og:title", content: "Guest chat — Elliot" },
      { property: "og:description", content: "Try Elliot without an account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "icon", href: logo }],
  }),
  component: GuestPage,
});

function GuestPage() {
  return (
    <ChatShell guest>
      <ChatView guest />
    </ChatShell>
  );
}
