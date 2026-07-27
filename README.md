# Marketa Marketplace

Peer-to-peer C2C marketplace with biometric National ID verification.

## Local Development

```bash
# 1. Link the project to your Vercel account (one-time)
npm run vercel:link

# 2. Start the dev server (frontend + API serverless functions)
npm run dev
```

This runs `vercel dev`, which:
- Starts the Vite dev server (with HMR) on an internal port
- Emulates the `/api/*` serverless functions (e.g., `/api/extract-id`)
- Serves everything on **http://localhost:3000**
- Reads `IDANALYZER_API_KEY` from `.env.local` for serverless functions

**Note:** `npm run dev:vite` runs Vite standalone (no API functions available — only use for UI-only work).

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anonymous key |
| `IDANALYZER_API_KEY` | Yes | ID Analyzer Core API v2 key (server-side only) |

## Build

```bash
npm run build
```

## Deploy

Push to GitHub — Vercel auto-deploys from the `master` branch.

Powered by Vite, React 19, TypeScript & Supabase.
