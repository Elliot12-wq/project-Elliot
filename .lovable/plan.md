# Elliot: auth, Vercel AI, and iOS-style glass

Four fixes: email sign-up errors, your own Google login, the AI failing on Vercel, and a true iOS 26 glass material on Android.

## 1. Email sign-up says "user already registered"

Right now the sign-up form treats every failure as a raw error toast, so a fresh email that hits any conflict (for example an address that already exists from a Google sign-in, or a duplicate submit while the first request is still running) reads as "account already exists".

Changes on the sign-in page:
- Debounce/guard double submits so the same address can't be registered twice in one click.
- When sign-up returns an "already registered" error, automatically try signing in with the same password. If that succeeds the user just gets in; if the password is wrong, show "This email already has an account — try signing in" and flip the form to sign-in mode with the email kept.
- If the address exists only as a Google account, show "This email is registered with Google — use Continue with Google."
- Clear, friendly copy for the other common errors (weak password, invalid email, rate limit).

I'll also verify the current auth settings (auto-confirm on, no anonymous sign-ups) so a new address really does land straight in the app.

## 2. Google sign-in with your own credentials

Your client ID and secret get stored as backend secrets — never written into the code or committed anywhere — and the Google provider is switched from Lovable's managed app to yours. After that the Google consent screen shows your project instead of Lovable's.

You'll need to add the callback URL shown in the auth settings to your Google Cloud "Authorized redirect URIs", plus your Vercel domain under authorized domains. I'll give you the exact URL to paste.

The sign-in button keeps using the same broker call, so it stays working inside the Lovable preview as well as on your live domain.

## 3. AI not working on Vercel

The chat backend currently depends on two things that only exist inside Lovable's own hosting: the AI gateway key and the database service key. On Vercel neither is present, so every request fails with "couldn't reach Elliot".

Fix:
- Rework the chat endpoint so it authenticates the user with the public key + the caller's own token instead of the service key. That removes the Lovable-only database dependency entirely.
- Add a Groq (Llama) path: if `GROQ_API_KEY` is set the backend streams from Groq; otherwise it uses the Lovable gateway as it does today. Same for the small helper calls (chat titles, memory extraction) and for the guest endpoint.
- Map the model picker tiers onto Groq Llama models when running on Groq. Note: Llama on Groq is text-only, so image understanding stays available only on the Lovable-hosted deployment; I'll surface a clear message instead of a silent failure when an image is sent to a text-only model.
- Add a Vercel adapter to the build so the app deploys correctly there.

Keys stay server-side only: `GROQ_API_KEY` is read inside the request handler, never exposed to the browser, never checked into the repo. You'll paste it once into Vercel's Environment Variables (I'll list every variable you need there).

## 4. iOS 26 liquid glass on Android

The current glass leans on `backdrop-filter` blur that Android Chrome renders much weaker than Safari. I'll rebuild the material so it reads the same on both:

- Layered material instead of one blur: a saturated blur base, a soft light-refraction gradient, a bright specular edge along the top and left, and a dark inner rim at the bottom for thickness.
- Explicit `-webkit-backdrop-filter` with a higher blur+saturate on Android, and a painted translucent tint fallback so panels never look flat when blur is throttled.
- Subtle animated highlight sweep on open/press, matching the iOS 26 "liquid" feel, with GPU-friendly transforms only.
- Kept on `will-change`/`transform: translateZ(0)` layers so scrolling stays smooth; the reduced-motion and low-power `glass-lite` fallback stays.

Applies to the sidebar, header, model picker, settings dialog and composer.

## Technical notes

- `src/routes/login.tsx`: submit-handler error mapping + in-flight guard.
- `supabase--configure_social_auth` with your Google client ID/secret stored via the secrets tool.
- `src/routes/api/chat.ts` and `src/routes/api/public/guest-chat.ts`: replace `supabaseAdmin` with a token-scoped publishable client (RLS-respecting), add a provider switch (`GROQ_API_KEY` → Groq, else Lovable gateway), keep streaming and post-stream persistence in-request.
- `vite.config.ts`: Vercel build preset.
- `src/styles.css`: rewritten `.liquid-glass` / `.glass-lite` layers.
