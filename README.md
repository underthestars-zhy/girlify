# girlify

Text a number a few selfies. Get back what you actually look like. 😈

Bun monorepo:
- `apps/web` — Next.js 16 landing page. Collects a phone number via Server Action, registers a Spectrum shared user, redirects into Messages.
- `apps/server` — [spectrum-ts](https://docs.photon.codes/spectrum-ts/getting-started) iMessage listener. Buffers incoming selfies per-conversation, runs Gemini 3 Pro Image via OpenRouter with a "undo the beauty filter" prompt, replies with the generated image.

## Setup

```bash
bun install
cp .env.example apps/server/.env           # fill PROJECT_ID, PROJECT_SECRET, OPENROUTER_API_KEY
cp .env.example apps/web/.env.local        # fill PROJECT_ID, PROJECT_SECRET
```

- Photon credentials: [app.photon.codes](https://app.photon.codes/)
- OpenRouter key: [openrouter.ai/keys](https://openrouter.ai/keys)

## Scripts

```bash
bun dev          # web + server concurrently
bun dev:web      # web only (http://localhost:3000)
bun dev:server   # server only
bun typecheck    # both workspaces
bun build        # production build of both
```

## How it works

1. Visit the site on a phone, punch in your number, hit submit.
2. The Server Action creates a shared user via Photon's API and redirects to `/users/{userId}/redirect` — Photon 302s to an `sms:` deep link, Messages opens.
3. Send 2–3 selfies to the bot.
4. Send any text ("go", "pls", whatever) — the server flushes the photo buffer, calls `google/gemini-3-pro-image-preview` via OpenRouter, and replies with the unfiltered-looking result.
