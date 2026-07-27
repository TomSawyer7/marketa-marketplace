# Marketa Marketplace

Peer-to-peer C2C marketplace with biometric National ID verification.

## Local Development

This project uses Vercel serverless functions (e.g., `/api/extract-id` for ID verification OCR). You have two development modes:

### Option A: Full functionality (recommended for OCR / ID verification work)

```bash
# 1. Link the project to your Vercel account (one-time)
npm run vercel:link

# 2. Start Vercel dev (serves frontend + API functions + HMR)
vercel dev
```

This serves everything on **http://localhost:3000** and reads `IDANALYZER_API_KEY` from `.env.local` for serverless functions.

### Option B: Faster frontend iteration (Vite only, API forwarded to Vercel)

Requires **two terminals**:

```bash
# Terminal 1: Start Vercel dev to serve /api/* functions
vercel dev
```

```bash
# Terminal 2: Start Vite dev server with HMR
npm run dev
```

Vite proxies any `/api/*` request to the `vercel dev` instance running on port 3000. Access the app on the Vite port (printed in the terminal, typically http://localhost:5173).

**`npm run dev` alone without `vercel dev` running will 404 on any `/api/*` call** — the OCR feature will fail.

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
