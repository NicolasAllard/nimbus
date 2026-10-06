# NimbusStack Knowledge Assistant

An internal RAG chatbot over the NimbusStack product markdown docs in [`data/`](data), built with
Next.js App Router and the Vercel AI SDK.

## Requirements

- Node.js 20+
- An [OpenAI API key](https://platform.openai.com/api-keys) and/or a
  [Google Gemini API key](https://aistudio.google.com/apikey) -- at least one is required for the
  app to answer; both is required to see the cross-provider fallback in action.

## Setup

```bash
npm install
cp .env.local.example .env.local   # paste your key(s) into OPENAI_API_KEY / GOOGLE_GENERATIVE_AI_API_KEY
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). If neither key is set, the app still starts
but every question returns a plain-text "providers are unavailable" error instead of an answer --
that's the intended E9 behavior, not a crash.

## Try it

The empty-state screen has four clickable example questions. A few others worth trying by hand:

- `Does Vault support SAML 2.0 on the Pro plan?` -- the docs disagree on this; the bot should call
  out the conflict and cite both files instead of picking one.
- `A client is getting a 403 on the API. What should they check first?` -- ambiguous across
  products; the bot should give separate steps for Pulse and Relay.
- Switch the model dropdown to **Gemini 3.1 Pro (Preview)** and ask anything -- that model is
  intentionally left pointed at a zero-quota Gemini tier so you can see the automatic fallback
  (and the "X was unavailable, so Y answered instead" banner) fire for real, not staged.

## How it works

- [`data/`](data) holds the source markdown files. [`lib/knowledge-base.ts`](lib/knowledge-base.ts)
  parses them into in-memory chunks once per server process and ranks them with `fuse.js` --
  no vector database.
- [`models.config.ts`](models.config.ts) is the single source of truth for every available model
  (id, pricing, context window, fallback chain). The app never hard-codes a model id.
- [`app/api/chat/route.ts`](app/api/chat/route.ts) retrieves the relevant passages for the recent
  conversation, builds the system prompt, and calls `streamText`. If a provider fails, it
  automatically retries the next model in that model's fallback chain; if every model fails it
  returns a plain-text, user-friendly error instead of crashing.
- The frontend ([`app/page.tsx`](app/page.tsx)) uses `useChat` for streaming, a model picker, a
  "New conversation" button, and per-message/session token + cost + source metrics.

## Known limitations

- no vector DB (fuzzy search only)
- no Claude provider wired up
- no R4 context-window warning
- all deliberate scope decisions given the time box, not oversights.

## Deploying

This is a standard Next.js app (e.g. deployable to Vercel) -- set `OPENAI_API_KEY` and
`GOOGLE_GENERATIVE_AI_API_KEY` as environment variables on the host; nothing else is required.

## Live deployment link

https://nimbus-nine-bice.vercel.app/
