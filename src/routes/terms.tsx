import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";

const url = "https://elliotgpt.lovable.app/terms";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — Elliot" },
      { name: "description", content: "Read the terms for using Elliot, including account responsibilities, AI responses, and acceptable use." },
      { property: "og:title", content: "Terms of Service — Elliot" },
      { property: "og:description", content: "Read the terms for using Elliot, including account responsibilities, AI responses, and acceptable use." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: url },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: url }],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <LegalPage label="The agreement" title="Terms of Service" intro="The ground rules for using Elliot. Please read these before creating an account or starting a guest chat.">
      <section>
        <h2>Using Elliot</h2>
        <p>By using Elliot, you agree to these terms. If you do not agree, please do not use the service. You must be able to enter into this agreement under the laws that apply to you; if you are a minor, use Elliot only with the permission and supervision required by those laws.</p>
      </section>
      <section>
        <h2>Your account</h2>
        <p>You can use the limited guest chat without an account. An account provides saved chats and additional features. Keep your sign-in details secure, provide accurate account information, and tell us if you believe someone else has accessed your account. You are responsible for activity under your account.</p>
      </section>
      <section>
        <h2>What you share</h2>
        <p>You retain rights to content you submit, such as messages, instructions, and images. You give us permission to store and process that content, and to send it to the services needed to operate Elliot and generate responses. Only share content you have the right to use; avoid sensitive information you would not want processed by an AI service. See the <Link to="/privacy">Privacy Policy</Link> for details.</p>
      </section>
      <section>
        <h2>AI responses</h2>
        <p>Elliot can make mistakes, invent facts, or produce incomplete or inappropriate answers. Check important information independently. Do not rely on Elliot as a substitute for qualified medical, legal, financial, or other professional advice. You are responsible for how you use its responses.</p>
      </section>
      <section>
        <h2>Responsible use</h2>
        <p>Do not use Elliot to break the law, harm others, infringe someone else’s rights, spread malware, attempt to bypass access restrictions, or overload or disrupt the service. We may restrict access when necessary to protect the service, its users, or others.</p>
      </section>
      <section>
        <h2>Service changes</h2>
        <p>Elliot is provided as available. Models, features, limits, or access may change, pause, or stop. We may update these terms; the updated date on this page will change when we do. Continuing to use Elliot after an update means you accept the revised terms.</p>
      </section>
      <section>
        <h2>Disclaimers and liability</h2>
        <p>To the extent allowed by applicable law, Elliot is offered without warranties of uninterrupted availability, accuracy, or fitness for a particular purpose. We are not responsible for losses arising from reliance on AI responses, interruptions, or third-party services except where the law does not allow that exclusion. Nothing here limits rights you cannot waive under applicable law.</p>
      </section>
      <section>
        <h2>Governing law and contact</h2>
        <p>These terms are governed by applicable laws of the United States, subject to any mandatory local consumer protections that apply to you. Questions about these terms? Email <a href="mailto:elliptmal@gmail.com">elliptmal@gmail.com</a>.</p>
      </section>
    </LegalPage>
  );
}