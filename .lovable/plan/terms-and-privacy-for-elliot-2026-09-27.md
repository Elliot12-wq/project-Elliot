# Terms and Privacy for Elliot

## What you'll get
- Two public, readable pages: **Terms of Service** and **Privacy Policy**, styled to fit Elliot's restrained dark-and-red chat workspace on phones and desktop.
- Small, easy-to-find links from the sign-in screen and chat sidebar, so guests and signed-in users can reach either page without changing chat or sign-in behavior.
- Contact address **elliptmal@gmail.com** for policy questions and privacy requests. The Terms will reference United States law without inventing a particular state or court.

## Content
- Terms: who may use Elliot, responsible use, AI output limitations, availability/changes, account responsibilities, content ownership/licensing needed to provide chat, disclaimers, liability language, and contacting the creator. Keep language readable rather than pretending it is a negotiated contract.
- Privacy: explain account email and profile picture/nickname, saved conversations, auto-extracted memories and custom instructions, uploaded chat images, local guest chats/preferences, voice input, and processing by AI providers. Describe account-vs-guest differences and how to delete a chat or ask for data help; don't promise automatic account deletion, precise retention periods, or privacy controls the app does not provide.
- Include effective/update dates and note that this is a practical draft for the owner to review before treating it as legal advice.

## Technical details
- Add public TanStack pages at `/terms` and `/privacy` with unique page metadata, self-referencing canonical and social URLs on `https://elliotgpt.lovable.app`.
- Add navigation using the existing design tokens and links; no new account, storage, or AI behavior.
- Check both pages and navigation at desktop and mobile sizes and confirm the preview has no errors.
