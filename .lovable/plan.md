# Elliot v2 — Memory, History & 100x Polish

## 1. Lovable Cloud + Auth

Enable Lovable Cloud. Add Email/Password + Google sign-in on `/login`. Gate the app behind `_authenticated` layout; unauthenticated users land on a marketing-lite login screen with the breathing logo.

## 2. Database schema

```text
conversations
  id uuid pk, user_id uuid (auth.users), title text, created_at, updated_at
messages
  id uuid pk, conversation_id uuid fk, role text, content text, created_at
memories
  id uuid pk, user_id uuid, key text, value text, source_message_id uuid, created_at
  unique(user_id, key)
```

RLS: each table scoped to `auth.uid() = user_id` (messages joined via conversation). Standard GRANTs for `authenticated` + `service_role`.

## 3. Invisible memory engine

After every assistant reply, a server fn runs a lightweight extraction pass (Llama on Groq, JSON mode) over the last user message + reply with a prompt like *"Extract durable facts about the user worth remembering. Return [] if none."* New facts upsert into `memories` by `key`. No UI, no toasts — fully silent.

On every chat call, all of the user's memories are injected into Elliot's system prompt as a "What you remember about this user" block, so Elliot references them naturally.

## 4. Streaming responses

Rewrite the chat backend as a TanStack server route at `src/routes/api/chat.ts` that proxies Groq's SSE stream and re-emits tokens. Client uses `fetch` + `ReadableStream` to append tokens to the in-progress assistant bubble. Thinking animation shows until the first token arrives, then morphs into a subtle pulsing caret while streaming.

## 5. Voice input

Hold-to-talk mic button next to the send button using the browser `SpeechRecognition` API (webkit fallback). Live transcript fills the textarea; release to stop. Graceful "not supported" toast on unsupported browsers (Firefox/Safari desktop).

## 6. Message features

- **Markdown + syntax-highlighted code blocks** via `react-markdown` + `react-syntax-highlighter` (oneDark theme tinted red).
- **Copy button** on every code block and on assistant messages.
- **Regenerate** last assistant response.
- **Edit & resend** any user message (truncates conversation forward).
- **Timestamps** on hover (relative: "2m ago").
- **Auto-generated conversation titles** — first reply triggers a title-summarization server fn.

## 7. Conversation sidebar

Collapsible left sidebar (shadcn `Sidebar`, mobile = sheet) listing conversations newest-first, with search, rename, delete, and a prominent "New chat" button. Active conversation highlighted in crimson. Mobile: hamburger in top bar opens the sheet.

## 8. Richer visuals

- **Ambient background**: slow-drifting radial crimson gradients (CSS `@property` + keyframe), plus a faint animated noise overlay for grain.
- **Logo treatment**: empty state gets a 3D-feeling logo with parallax tilt on mouse move (framer-motion `useMotionValue`), surrounded by upgraded ember field (24 particles, varied sizes, blur layers).
- **Thinking animation upgrade**: add a 4th orbital ring with a glowing satellite dot, a soft chromatic-aberration sheen on the logo, and a typed-out rotating status line ("Consulting memory…" → "Composing reply…" → "Polishing…").
- **Bubble polish**: assistant bubbles get a faint inner crimson glow on hover; user bubbles get a subtle ember gradient. Message-in animation uses a spring with slight scale + blur-out.
- **Send button**: morphs into a stop button while streaming, with a circular progress ring.
- **Sound (optional, toggleable)**: tiny send "tick" and receive "chime" using WebAudio — off by default.

## 9. Technical details

- **Deps to add**: `react-syntax-highlighter`, `@types/react-syntax-highlighter`, `date-fns`.
- **Existing**: `framer-motion`, `react-markdown`, `zod` already installed.
- **Groq key**: stays in `GROQ_API_KEY` secret; only read inside server fns / server route handler.
- **Streaming route** lives at `/api/chat` (not `/api/public/*` — it's auth-gated via `requireSupabaseAuth` equivalent: validates bearer from request header).
- **Memory extraction** runs in a non-awaited background promise after the stream completes so it never blocks the user.

## 10. Files

```text
src/routes/
  __root.tsx                     (add Toaster, auth listener)
  _authenticated.tsx             (gate)
  _authenticated/index.tsx       (chat shell)
  _authenticated/c.$id.tsx       (specific conversation)
  login.tsx                      (email/password + Google)
  api/chat.ts                    (streaming server route)
src/components/
  ChatShell.tsx, MessageList.tsx, Bubble.tsx, Composer.tsx,
  MicButton.tsx, CodeBlock.tsx, ConversationSidebar.tsx,
  ElliotThinking.tsx (upgraded), AmbientBackground.tsx, LogoMark.tsx
src/lib/
  conversations.functions.ts, messages.functions.ts,
  memory.functions.ts, titles.functions.ts
src/hooks/
  useStreamingChat.ts, useSpeechRecognition.ts
```

## Open question

Anything to **explicitly exclude** from memory (e.g. health, finance, location)? Default is no topic filter — Elliot remembers anything durable the user shares.
