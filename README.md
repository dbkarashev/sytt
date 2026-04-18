# sytt

An interactive 3D globe of anonymous stories from people going through hard times.

[![Live](https://img.shields.io/badge/🌐_Live-sytt.vercel.app-0969da?style=for-the-badge)](https://sytt.vercel.app)

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

[![Next.js](https://img.shields.io/badge/Next.js-000000?logo=nextdotjs&logoColor=white&style=flat-square)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-61dafb?logo=react&logoColor=black&style=flat-square)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178c6?logo=typescript&logoColor=white&style=flat-square)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06b6d4?logo=tailwindcss&logoColor=white&style=flat-square)](https://tailwindcss.com)
[![Three.js](https://img.shields.io/badge/Three.js-000000?logo=threedotjs&logoColor=white&style=flat-square)](https://threejs.org)
[![Supabase](https://img.shields.io/badge/Supabase-3fcf8e?logo=supabase&logoColor=white&style=flat-square)](https://supabase.com)
[![Upstash](https://img.shields.io/badge/Upstash-00e9a3?logo=upstash&logoColor=white&style=flat-square)](https://upstash.com)
[![Groq](https://img.shields.io/badge/Groq-f55036?logo=groq&logoColor=white&style=flat-square)](https://groq.com)
[![Vercel](https://img.shields.io/badge/Vercel-000000?logo=vercel&logoColor=white&style=flat-square)](https://vercel.com)

**Rendering** — Next.js 16.2.3 (App Router, Turbopack), React 19.2.4, TypeScript 5, Tailwind CSS 4. The globe is `react-globe.gl` 2.37 on top of `three` + `h3-js` 4.4.

**Data** — Supabase stores stories (PostgreSQL + REST, no SDK). Upstash Redis handles rate limiting via the Vercel integration (`@upstash/ratelimit` 2.0 sliding window, 3/h per IP hash). Groq's Llama 3.3 70B moderates content with a crisis-aware prompt that allows crisis-related content and blocks attacks, threats and spam.

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
