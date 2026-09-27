import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";

const url = "https://elliotgpt.lovable.app/privacy";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Elliot" },
      { name: "description", content: "Learn what Elliot saves, what is sent to AI providers, and how guest and account chats differ." },
      { property: "og:title", content: "Privacy Policy — Elliot" },
      { property: "og:description", content: "Learn what Elliot saves, what is sent to AI providers, and how guest and account chats differ." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: url },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: url }],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <LegalPage label="Your information" title="Privacy Policy" intro="This explains how Elliot handles the information you share when you chat, create an account, or browse as a guest.">
      <section>
        <h2>Information you provide</h2>
        <p>If you create an account, we process your email address and sign-in details to authenticate you. You can add a nickname, profile picture, and custom instructions. Signed-in chats include your messages, Elliot’s responses, conversation titles, and images you attach. Elliot may also extract personal facts from your chats into saved memories to personalize later replies in continuing conversations.</p>
      </section>
      <section>
        <h2>How Elliot uses it</h2>
        <p>Your information is used to run your account, respond to your messages, preserve signed-in chat history, personalize replies, and keep the service functioning. To generate responses, relevant chat history and, when applicable, your nickname, instructions, memories, and attached images are sent to an AI provider. Elliot uses Groq when configured, with Lovable’s AI service as a hosting fallback. Those providers process the information needed to return an answer under their own terms and privacy practices.</p>
      </section>
      <section>
        <h2>Guest chats and device storage</h2>
        <p>Guest messages are stored in your browser on that device, not in an Elliot account’s saved chat history. Recent guest messages are sent to the AI provider each time you ask a question so Elliot can answer in context. Starting a new guest chat or leaving guest mode clears the locally saved guest messages. The browser also stores preferences such as your selected model and appearance; account switching can remember previously used email addresses on the device. Clearing your browser storage can remove this local information.</p>
      </section>
      <section>
        <h2>Images and voice</h2>
        <p>Signed-in users can upload chat images and profile pictures to cloud storage. Attached images are made available to the AI provider when you send them in a chat; chat image links are saved with the message. Deleting a conversation removes its message records, but may not remove separately stored image files or saved memories derived from it. Voice input uses your browser’s speech-recognition feature to turn speech into text; its availability and audio processing depend on your browser and device. Elliot receives the resulting text when you send it as a message.</p>
      </section>
      <section>
        <h2>Storage and access</h2>
        <p>Signed-in account data, conversations, memories, instructions, and uploads are stored using Lovable Cloud. Access to saved account records and private uploads is limited to your account through access controls. Service hosts and infrastructure providers may process technical information needed to operate, secure, and deliver the site. We do not claim that AI conversations are end-to-end encrypted.</p>
      </section>
      <section>
        <h2>Your choices</h2>
        <p>You can delete individual conversations in the sidebar, edit your nickname and custom instructions in Settings, or clear guest chat data by starting a new guest chat or leaving guest mode. These actions do not necessarily erase separate uploads or previously extracted memories. For questions about your data or requests for access or deletion, email <a href="mailto:elliptmal@gmail.com">elliptmal@gmail.com</a>. We will handle requests as applicable law requires. We do not promise a specific retention period or an in-app account-deletion option.</p>
      </section>
      <section>
        <h2>Updates and contact</h2>
        <p>We may update this policy as Elliot changes. The date at the top of this page shows the latest update. If you have a privacy question, contact <a href="mailto:elliptmal@gmail.com">elliptmal@gmail.com</a>. The <Link to="/terms">Terms of Service</Link> cover use of the app.</p>
      </section>
    </LegalPage>
  );
}