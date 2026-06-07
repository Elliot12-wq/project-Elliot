# Elliot version tiers + guest mode

## 1. Four Elliot versions (Groq)

Create `src/lib/elliot-models.ts` as the single source of truth:

- **Elliot 1.0** — `llama-3.1-8b-instant` (fastest, lowest latency)
- **Elliot 1.2** — `llama-3.3-70b-versatile` (balanced default)
- **Elliot 2.2** — `llama-3.1-405b-reasoning` if available, otherwise `llama-3.3-70b-versatile` with low temp (most accurate)
- **Elliot 2.3** — `openai/gpt-oss-120b` or `deepseek-r1-distill-llama-70b` (best reasoning)

Each entry: `{ id, label, groqModel, tagline, temperature }`. Swapping a model = edit one line.

Route `src/routes/api/chat.ts` changes:
- Replace the Lovable AI Gateway fetch with a Groq call to `https://api.groq.com/openai/v1/chat/completions` using `process.env.GROQ_API_KEY` (already set).
- Accept a `version` field in the request body, look it up in `ELLIOT_MODELS`, pass its `groqModel` + `temperature`.
- Title generation + memory extraction also move to Groq (using Elliot 1.0's fast model) so we're Groq-only.
- Image messages: only Elliot 1.2/2.2/2.3 see image_url parts (Groq vision models). For 1.0 we strip images and add a note.

## 2. Version picker in UI

- Header dropdown next to the Elliot logo in `ChatView.tsx`.
- Shows current label (e.g. "Elliot 1.2"), opens a small menu listing all 4 with their taglines.
- Selected version stored in `localStorage` (`elliot:version`, default `1.2`) and sent with every chat request.
- The active label also subtly appears under the greeting in `EmptyState`.

## 3. Guest mode (no sign-in required)

Auth changes:
- Add a "Continue as guest" button on `src/routes/login.tsx` beneath Google sign-in.
- Guest = no Supabase session. We set `localStorage["elliot:guest"] = true` and route to `/`.

Routing/guards:
- The `_authenticated` gate currently blocks `/`. Loosen it so guests can reach the chat surface, but keep image upload + voice gated.

Guest chat backend:
- New endpoint behavior in `/api/chat`: if no auth header but a `guest: true` flag is in the body, skip DB writes entirely and just stream the Groq response back. No persistence server-side.
- Guest conversations + messages stored in `localStorage` (`elliot:guest:conversations`, `elliot:guest:messages:<convId>`). Sidebar reads from there when in guest mode.
- Memories: disabled for guests (no cross-session memory without an account).

Guest UI restrictions in `ChatView.tsx`:
- Image attach button → if guest, show a small "Sign in to send images" tooltip and open a sign-in prompt instead of the file picker.
- Mic / voice button → same treatment.
- Subtle banner at the top of the chat: "You're chatting as a guest. Sign in to save conversations across devices, send images, and use voice." with a "Sign in" link.

## 4. Files touched

- `src/lib/elliot-models.ts` (new) — model registry
- `src/routes/api/chat.ts` — Groq integration, `version` param, guest path
- `src/components/ChatView.tsx` — header dropdown, guest banner, gated image/mic, version label
- `src/components/ConversationSidebar.tsx` — read from localStorage when guest
- `src/routes/login.tsx` — "Continue as guest" button
- `src/routes/_authenticated/route.tsx` or equivalent — allow guests through to `/`
- `src/hooks/useGuestSession.ts` (new) — small helper for `isGuest`, guest storage CRUD

## Technical notes

- Groq's OpenAI-compatible streaming format is identical to what `chat.ts` already parses, so the SSE loop stays.
- Exact Groq model IDs will be verified against `https://api.groq.com/openai/v1/models` during build (the catalog moves quickly — I'll pin the IDs that respond 200 at build time and fall back to `llama-3.3-70b-versatile` if a chosen ID is decommissioned).
- No database migrations needed. Guest data never touches the server.
- `GROQ_API_KEY` is already configured.
