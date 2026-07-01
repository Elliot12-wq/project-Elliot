# Plan: Model picker, generation fix, global instructions, memory scoping

## 1. Model picker in the header

Add a compact `v1.2` dropdown next to the Elliot title in `ChatView.tsx`. Four tiers, each mapped to a real Lovable AI model:

| Label | Tagline | Real model |
| --- | --- | --- |
| Elliot 1.0 | Fastest — instant replies | `google/gemini-3.1-flash-lite` |
| Elliot 1.2 | Balanced — everyday assistant (default) | `google/gemini-3-flash-preview` |
| Elliot 2.2 | Most accurate — careful, precise | `google/gemini-2.5-pro` |
| Elliot 2.3 | Best reasoning — deep, multi-step | `google/gemini-3.1-pro-preview` |

Header layout is rebuilt with `min-w-0`, `flex-1 truncate` on the title block, and the model button pushed to `shrink-0` on the right so the dropdown and logo never overlap (fixes the collision seen in the screenshot). Selection persists in `localStorage` under `elliot.model`. The empty-state subtitle keeps showing the current tier ("ELLIOT 1.2 · Balanced — everyday assistant").

## 2. Fix "Elliot couldn't start a response"

Client sends the selected tier as `model` in the POST body to `/api/chat`. Server maps it against an allowlist (values above) and falls back to `google/gemini-3-flash-preview` if unknown. This also fixes the current failure: right now every send goes to `google/gemini-3-flash-preview` unconditionally, and if that preview id is rejected the whole app looks broken. The allowlist gives us a safe default plus three alternate models the user can switch to.

I'll also tail the AI Gateway logs after wiring to confirm the exact upstream error (400 vs 402 vs 429) and surface a clearer toast for each.

## 3. Global custom instructions

New table `public.user_instructions` (one row per user) storing a `content text` field, with standard RLS + grants. New button in the sidebar footer ("Instructions") opens a dialog with a textarea (max ~2000 chars) that reads/writes that row. Server-side `chat.ts` loads the caller's instructions and prepends them to the system prompt on every request, so they apply across every conversation.

## 4. Memory only for returning chats

In `chat.ts`, memory injection currently runs on every turn. Change it to skip when the conversation has ≤ 1 prior message (i.e. the very first user turn of a brand-new chat gets a clean system prompt). Memory *extraction* keeps running so memories still accumulate — only the injection into the system prompt is gated. Existing chats you return to keep getting the full memory block.

## Files touched

- `src/components/ChatView.tsx` — header rebuild, model dropdown, send `model` in body, tier-aware empty state
- `src/components/ConversationSidebar.tsx` — "Instructions" button + dialog (or a new small `InstructionsDialog.tsx`)
- `src/lib/instructions.functions.ts` — `getMyInstructions` / `saveMyInstructions` server functions (auth-gated)
- `src/routes/api/chat.ts` — model allowlist, instructions injection, gated memory injection, clearer error messages
- `supabase/migrations/<ts>_user_instructions.sql` — new table + RLS + GRANTs

## Out of scope

- No changes to the pride logo, greeting, or credit line.
- No new voice/image behavior.
