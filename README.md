# sytt

An interactive 3D globe of anonymous stories from people going through hard times.

Live: https://sytt.vercel.app

## Stack

Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind CSS 4. Rendering uses `react-globe.gl` + `three` + `h3-js` — hex-dotted continents, a custom polar-cap layer that works around h3's pole limitation, a procedural shader fire inside the sphere, and sprite-based sparks with custom raycasting.

Stories live in Supabase (PostgreSQL + REST, no SDK). Rate limiting uses Upstash Redis via the Vercel integration. Content moderation goes through Groq's Llama 3.3 70B with a crisis-aware prompt that allows expressions of pain and blocks attacks, threats and spam.

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in values
npm run dev
```

What breaks without what:

- No `SUPABASE_SECRET_KEY` — falls back to an in-memory store seeded with twelve sample stories. Fine for UI work.
- No `GROQ_API_KEY` — moderation skips the LLM layer in dev; in production it fails closed (rejects).
- No `KV_REST_API_URL` / `KV_REST_API_TOKEN` — rate limit uses an in-memory map in dev; in production it fails closed (returns 429).

## Deploy

`main` auto-deploys to production on Vercel. `dev` and any other branch get preview deploys on push. Branch protection on `main` requires a pull request; the workflow is:

```bash
git checkout dev
# ...edit, commit...
git push
gh pr create --base main --head dev --fill
gh pr merge --rebase    # linear history is enforced
```

## Architecture

Module layout, data flow, moderation prompt design, globe internals, rate-limit semantics and every non-obvious decision live in [SPEC.md](SPEC.md). Read that before making structural changes.
