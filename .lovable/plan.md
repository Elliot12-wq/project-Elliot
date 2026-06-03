## What's broken

1. **"Couldn't reach Elliot"** — POSTs to `/api/chat` fail. Most likely cause: the server route hand-rolls auth with `supabase.auth.getClaims(token)` and a manually-constructed client. On this stack, the canonical pattern is `requireSupabaseAuth` middleware on a `createServerFn`, with `attachSupabaseAuth` registered in `src/start.ts` so the browser auto-attaches the bearer. The current route also returns plain `Response` errors with no detail, so the UI just shows the generic toast.

2. **Sidebar / "chat memory" broken on hamburger tap** — `ChatShell` mounts the mobile sidebar in a `fixed` overlay only when `mobileOpen` is true, but the close handler and the conversation list `onClick` both fire `navigate()` without closing first on some paths; tapping a conversation re-mounts `ChatView`, which calls `setMessages([])` and refetches — so history briefly disappears and, if RLS or session is off, never returns. The `conversations` query also has no `eq("user_id", …)` filter; it relies entirely on RLS, which is fine, but if the session token isn't attached yet on first render it returns `[]` and the sidebar shows "No conversations yet."

3. **Mic doesn't work** — `useSpeechRecognition` uses the Web Speech API (`webkitSpeechRecognition`). On Android Opera / Firefox / desktop Safari, this API either doesn't exist or silently no-ops, so the button does nothing. There is also no permission prompt and no user feedback on `onerror`.

## Fix plan

### 1. Rewrite `/api/chat` as a streaming server function

- Convert `src/routes/api/chat.ts` into `src/lib/chat.functions.ts` exporting `streamChat = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(...).handler(...)` — but since server functions don't natively stream raw bytes, keep it as a **server route** AND fix the auth path:
  - Validate the bearer with `supabaseAdmin.auth.getUser(token)` instead of `getClaims` (more reliable, re-validates with the Auth server).
  - On any failure, return JSON `{ error: "…" }` with a real message so the client can surface it.
  - Add a `try/catch` around the Groq fetch and log the actual response body.
- Verify `src/start.ts` registers `attachSupabaseAuth` in `functionMiddleware` (already required by the template; confirm it's intact).
- Client (`ChatView.send`): use `supabase.auth.getUser()` first to ensure a valid session, then read the access token from `getSession()` for the bearer. On non-OK response, read the error JSON and show it in the toast instead of "Couldn't reach Elliot."

### 2. Sidebar + history reliability

- In `ConversationSidebar`, wait for `supabase.auth.getUser()` to resolve before the first query, and explicitly filter `.eq("user_id", user.id)` (defense in depth — RLS still applies).
- Close the mobile sheet **before** navigating, and use `setTimeout(navigate, 0)` so the overlay unmount doesn't swallow the route change on slow Android browsers.
- In `ChatView`, don't `setMessages([])` synchronously on `conversationId` change — keep the old list visible until the new fetch resolves, then swap. Prevents the "memory wiped" flash users perceive as broken history.
- Add a realtime subscription on `messages` for the active `conversationId` so newly-persisted assistant replies appear even if the streaming swap-in fails.

### 3. Mic: graceful capability + permission handling

- In `useSpeechRecognition`:
  - If `SpeechRecognition` is unsupported, expose `supported: false` (already done) AND have the button **still render** but show a toast "Voice input isn't supported in this browser" when tapped — right now it's hidden, so users think it's "broken."
  - Surface real errors (`onerror`): toast "Microphone blocked — enable it in browser settings" on `not-allowed`, "No speech detected" on `no-speech`, etc.
  - Before `rec.start()`, proactively call `navigator.permissions.query({ name: "microphone" })` when available and short-circuit with a clear toast if denied.
  - Keep `rec.start()` synchronous inside the click handler (already correct — don't add awaits before it, per browser gesture rules).

### 4. Misc polish while we're in there

- `src/routes/index.tsx`: if `getSession()` returns null on first call but the user is actually signed in (race on slow networks), also listen to `onAuthStateChange` once before redirecting, to avoid bouncing signed-in users to `/login`.

## Files touched

- `src/routes/api/chat.ts` — auth + error handling
- `src/components/ChatView.tsx` — better error surface, soft history swap, send() auth flow, mic button always visible
- `src/components/ConversationSidebar.tsx` — explicit user filter, close-before-navigate
- `src/hooks/useSpeechRecognition.ts` — error callbacks, permission check
- `src/routes/index.tsx` — auth race fix
- `src/start.ts` — verify `attachSupabaseAuth` is registered (no-op if already correct)

No DB migrations, no new dependencies.
