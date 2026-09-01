# Fix Google sign-in and configure Elliot AI on Vercel

## 1. Configure Google sign-in correctly

- Keep the existing Google button and Lovable authentication broker, which already supports both the Lovable preview and external domains.
- Enable Google as an authentication provider if it is not already enabled.
- Use the **first pasted value** (ending in `9pfmq.apps.googleusercontent.com`) as the Google **Web application client ID**.
- Configure its matching **client secret through the secure authentication settings**, never in source code, chat, or a public environment variable.
- Do not use the second ID for the web flow unless it belongs to another required Google platform client.
- Add the exact backend callback URL to the Google Cloud Web client’s authorized redirect URIs and add the deployed Vercel domain to the allowed JavaScript origins/domains.
- Verify the OAuth return lands on the public site origin and the app waits for the authenticated session before entering Elliot.

## 2. Make the Vercel server build explicit

- Pin the external production build to Nitro’s Vercel preset while preserving Lovable’s own hosted build behavior.
- Keep the full TanStack server runtime so `/api/chat` and `/api/public/guest-chat` deploy as server handlers rather than as static SPA files.
- Confirm both signed-in and guest chat routes are included in the Vercel output.

## 3. Configure Groq securely on Vercel

- Keep `GROQ_API_KEY` server-only; never prefix it with `VITE_`, return it to the browser, or commit it.
- In Vercel, add `GROQ_API_KEY` to Production (and Preview if preview deployments should chat), then redeploy. Lovable’s secret store does not synchronize to Vercel.
- Also configure the public backend connection values required by the signed-in chat handler: `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` as server variables, plus their existing `VITE_` counterparts for browser authentication.
- Ensure Vercel selects Groq/Llama when `GROQ_API_KEY` exists and returns a clear configuration error when it does not.

## 4. Add deployment-safe diagnostics and verify

- Add a non-sensitive AI readiness check that reports only whether a provider is configured and which provider is selected—never key contents.
- Improve server logs/error responses enough to distinguish missing environment variables, rejected Groq credentials, unavailable models, and upstream failures.
- Verify locally that the project builds, then test the deployed health check, guest chat, authenticated chat, and Google sign-in on the Vercel domain.

## Required user setup

- Provide the matching secret for the first Google Web client through the secure authentication settings when prompted.
- In Vercel Project Settings → Environment Variables, add the server-only `GROQ_API_KEY` and the backend URL/publishable-key variables, then redeploy.
