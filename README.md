# sytt

Interactive 3D globe of anonymous stories from people going through hard times. Breathing rhythm 4-1-6. You don't have to win — you just have to get through this.

Source of truth for architecture and decisions: **[SPEC.md](SPEC.md)**.

## Stack

- Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4
- `react-globe.gl` + `three` + `h3-js` for the dotted globe with a fire core
- Supabase (PostgreSQL + REST) for story storage
- Groq (Llama 3.3 70B) with a crisis-aware prompt for moderation

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in values
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Without `SUPABASE_SECRET_KEY` the app falls back to an in-memory store seeded with 12 sample stories. Without `GROQ_API_KEY` moderation in dev skips the LLM layer; in production it fails closed.

## Supabase setup

Run [supabase-setup.sql](supabase-setup.sql) in the Supabase SQL Editor once. It creates the `stories` table, indexes, RLS policy, and seeds 12 initial stories (idempotent).

## Environment variables

See [.env.example](.env.example). You need:
- `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SECRET_KEY` — storage
- `GROQ_API_KEY` — moderation
- `IP_SALT` — any random string used to hash IPs for rate limiting

## Deploy

Tested target is Vercel. Push to GitHub, import the repo in Vercel, copy env vars from `.env.local` into Vercel → Settings → Environment Variables, deploy.
