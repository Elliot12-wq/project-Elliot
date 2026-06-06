## Pride logo + dynamic greeting

### 1. Swap Elliot's logo (Pride edition)
- Upload the attached image as a Lovable Asset (`src/assets/elliot-logo-pride.png.asset.json`) via the `lovable-assets` CLI.
- Update the logo import in `src/components/ChatView.tsx` (used both in the header and the empty state) to point at the new Pride asset. Keep the old `elliot-logo.png` in place so it's easy to revert after June.

### 2. Dynamic greeting in the empty state
Replace the static "Hello, I'm Elliot." headline + subtitle with a context-aware greeting computed on the client from the user's local `Date`.

Logic (in `EmptyState`):
- **Time of day** (from `getHours()`):
  - 5–11 → "Good morning"
  - 12–16 → "Good afternoon"
  - 17–20 → "Good evening"
  - 21–4 → "It's night"
- **Day of week** (from `getDay()`), used to flavor a follow-up line, rotating between a couple variants per day so it doesn't feel canned:
  - Mon → "You got any questions on Monday?"
  - Tue → "Nice Tuesday, innit?"
  - Wed → "Midweek already — what's on your mind?"
  - Thu → "Thursday treating you well?"
  - Fri → "Happy Friday — what are we tackling?"
  - Sat → "Lazy Saturday questions?"
  - Sun → "Sunday calm — ask away."
- **New month acknowledgement**: if `getDate() <= 3`, prepend a small badge line like "Happy {MonthName}!" above the greeting.

Compose into two lines:
- Headline: `{Time-of-day greeting}.` (e.g. "Good evening.")
- Subtitle: `{Day-of-week line}` replacing the current "Ask me anything…" copy.
- Optional small chip above headline when in the first 3 days of a month: "Happy July ✦".

Implementation notes:
- Pure presentational change inside `EmptyState` in `ChatView.tsx`. No backend, no AI call needed — Elliot "generates" it client-side from `Date`, which keeps it free and instant.
- Compute once with `useMemo` so it's stable for the render.
- Keep existing suggestion buttons and the breathing logo animation untouched.

### Files touched
- `src/assets/elliot-logo-pride.png.asset.json` (new, via lovable-assets CLI)
- `src/components/ChatView.tsx` (logo import + `EmptyState` greeting logic)

No DB, RLS, or server changes.
