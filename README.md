# sytt

An interactive 3D globe of anonymous stories from people going through hard times.

[![Live](https://img.shields.io/badge/🌐_Live-sytt.vercel.app-0969da?style=for-the-badge)](https://sytt.vercel.app)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white&style=for-the-badge)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white&style=for-the-badge)](https://www.typescriptlang.org)

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in values
npm run dev
```

Dev works with any subset of env vars. Behaviour when each is missing:

- `SUPABASE_SECRET_KEY` — falls back to an in-memory store seeded with twelve sample stories.
- `GROQ_API_KEY` — moderation skips the LLM layer in dev. Production fails closed.
- `KV_REST_API_URL` / `KV_REST_API_TOKEN` — rate limit uses an in-memory map in dev. Production fails closed (429).

## Stack

**Rendering** — Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind CSS 4. The globe itself is `react-globe.gl` on top of `three` + `h3-js`.

**Data** — Supabase stores stories (PostgreSQL + REST, no SDK). Upstash Redis handles rate limiting via the Vercel integration. Groq's Llama 3.3 70B moderates content with a crisis-aware prompt that allows crisis-related content and blocks attacks, threats and spam.

## Deploy

`main` auto-deploys to production on Vercel. `dev` and any other branch get preview deploys on push. Branch protection on `main` requires a pull request; linear history is enforced.

```bash
# from dev, after pushes
gh pr create --base main --head dev --fill
gh pr merge --rebase
git reset --hard origin/main && git push --force-with-lease  # keep dev aligned
```

## Architecture

Module layout, data flow, moderation prompt design, globe internals, rate-limit semantics and every non-obvious decision are in [SPEC.md](SPEC.md). Read that before making structural changes.
