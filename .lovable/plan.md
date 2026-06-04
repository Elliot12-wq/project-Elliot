# Fix: chat route crash + mobile burger menu

## What's actually happening

The "This page didn't load" screen is the **root error boundary** in `src/routes/__root.tsx` firing. "Try again" calls `router.invalidate()` + `reset()`, which re-mounts the same component — so if the crash is deterministic (SSR throw, missing session, bad conversation id), retrying can never recover. That's why the button does nothing.

Two independent problems feed into this:

1. **`/c/$id` server-renders** even though everything inside (Supabase session, realtime, localStorage) is browser-only. On a hard refresh or when Opera opens a deep link cold, SSR can throw and bubble straight to the root error boundary.
2. **Mobile burger** opens the sidebar, but the sidebar's realtime channel is named `conv-list` (collides across mounts) and the overlay lives inside `ChatShell`'s flex/overflow-hidden container — on some mobile browsers (Opera, in-app Facebook browser) that ancestor creates a stacking context that hides the panel, so tapping the burger looks like nothing happens.

## Changes

### 1. Make the chat shell client-only — `src/routes/c.$id.tsx` and `src/routes/index.tsx`

Add `ssr: false` to both routes. Both are auth-gated and render nothing meaningful on the server anyway. This kills the SSR crash path entirely.

### 2. Give `/c/$id` its own friendly errorComponent — `src/routes/c.$id.tsx`

Instead of falling through to the root "This page didn't load", show a small "Couldn't open this chat" card with two buttons:
- **Open latest chat** → navigates to `/` (which picks the most recent conversation)
- **Try again** → `router.invalidate()` + `reset()`

This way even if something does throw, the user lands somewhere usable instead of a dead-end retry loop.

### 3. Delete the `/index` alias — `src/routes/[index].tsx`

The bracketed filename is a workaround that's caused more trouble than it solved. Remove it; TanStack's default not-found will route stray `/index` hits to the root 404, and the root `Go home` button works fine. (The user's screenshot is on `/index`, suggesting this alias may itself be implicated.)

### 4. Harden the mobile sidebar — `src/components/ChatShell.tsx` and `src/components/ConversationSidebar.tsx`

- Render the mobile overlay + sidebar via `createPortal(..., document.body)` so no ancestor's stacking context can hide it.
- Lock body scroll while `mobileOpen` is true (`document.body.style.overflow = 'hidden'`).
- In `ConversationSidebar`, give the realtime channel a unique name: `` `conv-list-${userId}-${Math.random()}` `` so repeated mounts don't collide.

### 5. Defensive guard in `ChatView` — `src/components/ChatView.tsx`

Wrap the initial `supabase.from("messages").select(...)` `.then` in a `.catch` that surfaces a toast instead of throwing into the boundary. The realtime channel name should also include `Date.now()` to avoid collisions across remounts.

## Technical notes

- `ssr: false` on a `createFileRoute` skips both server render and prerender for that route — the route still renders normally on the client.
- The root `ErrorComponent` stays as the last-resort fallback; per-route `errorComponent` takes precedence and prevents the dead-end retry.
- No backend/schema changes. No new dependencies.

## Out of scope

- The AI streaming/disappear behavior (already fixed per your last message).
- Visual redesign of the sidebar.
