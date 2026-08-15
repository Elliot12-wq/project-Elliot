# Elliot: visuals, settings, guest mode

A full pass over how Elliot looks and moves, plus a real Settings hub, an account manager, and a no-login guest mode.

## 1. Visual remake

- Refresh the surface language: deeper black base, warmer ember accents, softer elevation, cleaner type rhythm in the header, message list, composer and sidebar.
- Message bubbles get quieter borders and better spacing; the composer becomes one cohesive card with clear icon affordances.
- Everything stays on the existing red/black tokens, tuned for contrast on both phone and desktop.

## 2. Animations

- **Sidebar open/close**: spring slide with a backdrop that blurs in and out (blur ramps up as it opens, fades as it closes), plus staggered fade-in of the chat list rows.
- **Model switching**: the header model label cross-fades and slides to the new name, the picker items animate in with stagger, and the selected item gets an ember highlight that glides between rows.
- **Long-press a model** in the picker to reveal that tier's underlying AI engine name in a small popover (also available on desktop via hover/right-click).
- All motion respects reduced-motion settings.

## 3. Settings (from the sidebar)

New Settings panel replacing the standalone Instructions button. Contains:

- **Liquid glass**: toggle for a translucent frosted UI. Detects Android and uses a lighter blur + fallback tint there so it stays smooth; iOS/desktop get the full effect. Preference saved per device.
- **Custom instructions**: moved here from the sidebar, same save behavior.
- **Account manager**:
  - Profile picture — pick from gallery/photos, upload, shown in sidebar and settings.
  - Nickname — what Elliot calls you; injected into Elliot's prompt.
  - Log out.
  - Switch accounts — lists remembered accounts on this device and offers a "Log in / create account" prompt to add another.

## 4. Guest mode

- Login screen gets a "Continue as guest" option; guests chat immediately, with the conversation kept on the device only.
- Guests can use **Elliot 1.0 only**. Tiers 1.2 / 2.2 / 2.3 appear locked with a "Log in or create an account to use this model" label.
- Photo attachments and mic input are locked for guests, with the same sign-in prompt.
- None of these limits apply to signed-in users.
- Prompts to sign up appear where a guest hits a limit, never as a blocking wall over normal chatting.

## 5. Credits

- Small, low-key "Credits" line at the bottom of the sidebar opening a compact card: Elliot's core engine, creator (Charlie Nathaniel P. Sagun), and a short summary of Elliot's lore.

## Technical notes

- New `profiles` table (user_id, nickname, avatar_url) with RLS + grants, and a public-read `avatars` storage bucket for profile pictures.
- Nickname and custom instructions both feed the system prompt in `src/routes/api/chat.ts`.
- Guest chat uses a new public server route under `src/routes/api/public/` that is hard-limited to the 1.0 model, ignores any other tier, rejects image input, and is rate limited; guest history lives in localStorage, not the database.
- Sidebar/settings/model picker animations use the existing framer-motion setup; the model picker stays portaled so it can't overlap the header.
- Liquid glass is a class on the app root driving token-level background/blur values, with an Android-specific reduced-blur variant.
- Switch-accounts stores only non-sensitive account labels locally; switching signs out and routes to login prefilled.
