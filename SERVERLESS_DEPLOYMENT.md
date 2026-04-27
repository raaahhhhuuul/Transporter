# Serverless Deployment Guide

This project already uses a serverless-friendly stack and keeps the current file structure intact:

- Routing/UI: `src/routes`, `src/components`
- Client data/hooks: `src/hooks`
- Serverless functions: `src/lib/auth.ts`, `src/lib/admin-console.ts` via `createServerFn`
- Worker runtime config: `wrangler.jsonc`
- Generated worker bundle/config after build: `dist/server/index.js`, `dist/server/wrangler.json`

## What Makes This Fully Serverless

- No Express/Node server process is required.
- Backend logic runs through TanStack Start `createServerFn` in Cloudflare Workers.
- Frontend assets are served as static assets by Worker deployment.
- Persistent data/auth are managed by Supabase (managed serverless backend).

## Required Environment Variables

Set these for runtime (Cloudflare Worker):

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Set these for build/client:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## Local Serverless Run (Wrangler)

1. Install dependencies:

```bash
bun install
```

2. Copy `.dev.vars.example` to `.dev.vars` and fill values.

3. Run serverless local worker:

```bash
bun run dev:serverless
```

## Deploy to Cloudflare Workers

1. Set Cloudflare secrets/vars:

```bash
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put SUPABASE_URL
```

2. Deploy:

```bash
bun run deploy:serverless
```

## Notes

- `bun run build:serverless` generates `dist/server/wrangler.json` and `dist/client`.
- Deployment uses that generated worker config directly.
- Existing route/component structure remains unchanged.
