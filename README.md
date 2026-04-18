# sytt

Interactive 3D globe of anonymous stories from people going through hard times.

Source of truth for architecture and decisions: **[SPEC.md](SPEC.md)**.

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in values
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Supabase setup

Run [supabase-setup.sql](supabase-setup.sql) once in the Supabase SQL Editor — table, indexes, RLS, 12 seed stories (idempotent).
