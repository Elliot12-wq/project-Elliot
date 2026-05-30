# Elliot — Groq Llama Chat App

A sleek red & black chat interface for "Elliot", powered by Meta's Llama via Groq. Logo is your Celtic-knot "E" mark.

## Security first — please rotate your Groq key
You pasted your Groq API key in chat. Chat messages aren't a safe place for secrets, so that key should be considered exposed.

**Action for you:** Revoke it at https://console.groq.com/keys and generate a new one.

**What I'll do:** Store the new key as a server-side secret named `GROQ_API_KEY` using Lovable's secret manager. It will only be readable inside server functions (`process.env.GROQ_API_KEY`) — never bundled into the browser, never visible in network requests, never in git. All Groq calls go through a TanStack Start server function.

## What I'll build

### 1. Logo
Copy your upload to `src/assets/elliot-logo.png` and import it as an ES module.

### 2. Backend — secure Groq proxy
`src/lib/chat.functions.ts` — a `createServerFn` (POST) that:
- Reads `GROQ_API_KEY` from `process.env` inside the handler
- Calls `https://api.groq.com/openai/v1/chat/completions` with model `llama-3.3-70b-versatile` (latest production Llama on Groq)
- Prepends a system prompt establishing identity: "You are Elliot, a thoughtful and creative AI assistant…"
- Validates input with Zod (messages array, max length caps)
- Returns assistant message; surfaces 401/429/quota errors as typed responses

### 3. Frontend — `src/routes/index.tsx`
Full-screen chat UI, mobile-first (you're on 424px):
- **Header**: Elliot logo with a slow-rotating red glow halo behind it, "Elliot" wordmark, subtle tagline
- **Message list**: glassy bubbles — user messages in deep crimson, Elliot's in dark slate with a thin red border; markdown rendered via `react-markdown`
- **Composer**: auto-grow textarea, send on Enter, red gradient send button with hover glow
- **Empty state**: centered logo with breathing glow + 3 suggestion chips
- Smooth fade-in/slide-up on every new message (framer-motion)

### 4. "Elliot is thinking" animation (the showpiece)
While waiting for a response, render a custom loader inspired by the Celtic-knot logo:
- The logo sits center, with **three concentric rings** of red light rotating around it at different speeds and easings
- A soft crimson **breathing halo** pulses behind the logo in sync with the rings
- Tiny **ember particles** drift upward from beneath the logo and fade out
- "Elliot is thinking…" text below with a **red-gradient shimmer sweep** moving left-to-right on loop
- Built with Tailwind keyframes + framer-motion; all GPU-friendly transforms

### 5. Design tokens — `src/styles.css`
Replace the default palette with:
- `--background`: near-black with a hint of navy (matches logo backdrop)
- `--primary`: crimson `oklch(0.55 0.22 25)` → glow variant
- Gradient tokens: `--gradient-ember` (crimson → bright red), `--gradient-glow` (radial red haze)
- Shadow tokens: `--shadow-ember` (red-tinted drop shadow), `--shadow-deep`
- Sharp 14px radius, generous spacing
- Typography: `Instrument Serif` for the Elliot wordmark (matches the Celtic/medieval feel of the logo), `Inter` for body — loaded via Google Fonts

### 6. Page metadata
Title "Elliot — AI Assistant", description, og:title/og:description/og:image using the logo, favicon set to the logo.

## Tech details
- New deps: `react-markdown`, `framer-motion`, `zod` (likely already present)
- Conversation history kept in component state (in-memory). Refresh = new chat.
- Errors (rate limit, quota, network) shown as red toasts via existing `sonner`
- Streaming: Groq supports SSE but `createServerFn` returns plain DTOs — for v1 I'll use a single non-streaming response so the thinking animation is the wait experience. If you later want token-by-token streaming, that needs a server route instead and I can add it.

## Open questions
1. **Confirm you'll rotate the key** — say "rotated" once done and I'll prompt for the new value via the secrets form. Without this, your key stays compromised.
2. **Persistence**: keep chats in-memory (default) or save history with Lovable Cloud so it survives refresh?
3. **Streaming now or later**: ok to start non-streaming, or want SSE token-by-token from day one?
