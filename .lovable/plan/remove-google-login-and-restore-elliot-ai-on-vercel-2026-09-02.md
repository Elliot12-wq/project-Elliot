# Remove Google login and restore Elliot AI on Vercel

## 1. Remove Google sign-in

- Remove the Google OAuth import, handler, icon, divider, and button from the login screen.
- Update account-related error copy so it no longer recommends Google sign-in.
- Disable the Google authentication provider in the backend while keeping email/password and guest access unchanged.

## 2. Keep Groq credentials secure and Vercel-compatible

- Keep Elliot’s Groq key server-only as `GROQ_API_KEY`; never add a `VITE_` prefix, embed it in source, or send it to the browser.
- Preserve Groq/Llama as Elliot’s primary provider and the built-in Lovable provider only as a hosted-preview fallback.
- Normalize runtime environment reads and distinguish these states in API responses and server logs: missing key, rejected key, rate limit, exhausted credits, and upstream outage.
- Keep the public AI readiness endpoint non-sensitive: it may report readiness/provider/model, but never credential contents.

## 3. Verify both chat paths

- Check the Vercel-targeted server build still includes the authenticated and guest chat handlers.
- Test the readiness endpoint, guest chat, and authenticated chat against a deployment where `GROQ_API_KEY` is present.
- Confirm the login screen contains only email/password and guest access.

## Required Vercel setup

- Create a fresh Groq API key because the previously shared key was exposed and previously failed validation.
- Add it in Vercel as the server-only environment variable `GROQ_API_KEY` for Production (and Preview if needed), then redeploy.
- Do not name it `VITE_GROQ_API_KEY`; that would expose it to browser code.

Code cannot securely supply a missing Vercel secret from the repository or from Lovable’s separate secret store. The deployment will continue to report “AI is not configured” until Vercel has `GROQ_API_KEY` and is redeployed.
