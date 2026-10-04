# BlindSpot

Static page (`index.html`) + one serverless function (`api/claude.js`) that calls the Anthropic API.
Decisions are saved in the visitor's browser (localStorage).

## Deploy on Vercel
1. Push this folder to a GitHub repo.
2. Vercel → Add New Project → import the repo (no build settings needed).
3. Project Settings → Environment Variables, add:
   - `ANTHROPIC_API_KEY` (from console.anthropic.com)
   - optional: `ANTHROPIC_MODEL`, `RATE_LIMIT_PER_HOUR`, `ALLOWED_ORIGIN`
4. Deploy. Your site is live at `https://<project>.vercel.app`; add a custom domain under Settings → Domains.

## Run locally
```
npm i -g vercel
cp .env.example .env     # add your key
vercel dev
```

## Before sharing widely
- Set a monthly spend limit in the Anthropic console.
- The built-in rate limit is per server instance and best-effort. For a hard limit, use a shared store (e.g. Upstash Redis).
- Set `ALLOWED_ORIGIN` to your site's URL.
