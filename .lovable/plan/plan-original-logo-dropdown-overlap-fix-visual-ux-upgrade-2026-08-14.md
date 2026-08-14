# Plan: Original logo, dropdown overlap fix, visual/UX upgrade

## 1. Bring back the original logo

Swap the pride asset back to `src/assets/elliot-logo.png` everywhere in `ChatView.tsx` (header + empty state). The pride pointer file stays in the repo, unused, so it can be re-enabled next June.

## 2. Fix the model-picker overlap

Cause: the header uses `backdrop-blur-xl`, which creates its own stacking context, so the dropdown's `z-50` is trapped inside the header and the big empty-state logo below paints over it.

Fix: give the header a real stacking layer (`relative z-40`) and render the dropdown in a fixed-position portal anchored to the trigger button, so it always floats above page content. Also add a click-outside + Escape close, a scroll/resize reposition, and a mobile treatment where the list becomes a bottom sheet under `sm` so it never runs off-screen.

## 3. Cross-device compatibility (PC / tablet / mobile / iOS / Android)

- Header rebuilt with the grid pattern: `grid-cols-[auto_minmax(0,1fr)_auto]` on mobile, flex at `sm:`, `min-w-0` on the text block, `shrink-0` on logo and picker — no more clipping of "Woven from memory".
- Composer + messages get responsive max-widths and safe-area padding (`env(safe-area-inset-bottom)`) so the iOS home bar doesn't cover the send button.
- Tap targets raised to 44px minimum, `touch-action` and `-webkit-tap-highlight-color` cleaned up, inputs at 16px font so iOS Safari stops zooming on focus.
- Empty-state logo scales `h-24` → `h-32` → `h-40` across breakpoints.

## 4. Upgraded visuals and animations

- **Ambient layer**: slower dual-gradient drift plus a faint film-grain and a subtle vignette, all GPU-transform based.
- **Header**: thin animated ember gradient hairline under the bar.
- **Model picker**: spring scale + fade in, staggered row entrance, glowing ring on the active tier.
- **Messages**: refined spring entrance, assistant bubbles get a soft ember edge-glow on arrival; user bubbles keep the high-contrast primary pair.
- **Composer**: focus ring blooms into a soft ember glow; send button gets a press-spring and a ripple on tap.
- **Suggestion cards**: hover lift with a moving sheen, translated to a tap-press state on touch devices.
- All new motion respects `prefers-reduced-motion` (reduced to opacity-only fades).

## Files touched

- `src/components/ChatView.tsx` — logo swap, header rebuild, portaled/bottom-sheet model picker, animation polish
- `src/components/AmbientBackground.tsx` — grain + vignette + slower drift
- `src/components/ConversationSidebar.tsx` — touch targets, safe-area, transition polish
- `src/styles.css` — new keyframes, reduced-motion block, safe-area utilities

## Out of scope

- No changes to chat logic, models, memory, instructions, or the creator credit.
