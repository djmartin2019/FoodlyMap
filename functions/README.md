# Cloudflare Pages Functions

This directory contains Cloudflare Pages Functions for server-side rendering of Open Graph meta tags.

## Setup

### 1. Environment Variables

Configure these environment variables in your Cloudflare Pages project settings:

- `SUPABASE_URL`: Your Supabase project URL (e.g., `https://xxxxx.supabase.co`)
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key (NOT the anon key)

**Important:** The service role key bypasses RLS, so it should NEVER be exposed to the client. Only use it in server-side functions.

### 2. Function Structure

- `functions/l/[slug].ts` - Handles `/l/:slug` routes
  - Detects bot/crawler user agents
  - Fetches list metadata from Supabase
  - Returns HTML with OG meta tags for bots
  - Passes through to SPA for regular users

### 3. Testing

To test locally with Wrangler:

```bash
npx wrangler pages dev dist --compatibility-date=2024-01-01
```

Or test bot detection by setting a custom user-agent:

```bash
curl -H "User-Agent: Twitterbot" https://your-site.com/l/your-slug
```

### 4. Deployment

The functions are automatically deployed with Cloudflare Pages. Make sure:
- Environment variables are set in Cloudflare Pages dashboard
- The `functions` directory is included in your deployment
- The function file structure matches Cloudflare's expected format

## Bot Detection

The function detects the following crawlers:
- Facebook (facebookexternalhit, Facebot)
- Twitter (Twitterbot)
- Slack (Slackbot, Slack)
- Discord (Discordbot)
- LinkedIn (LinkedInBot)
- WhatsApp
- Telegram (TelegramBot)
- Apple (Applebot)
- Google (Googlebot)
- Bing (Bingbot)
- And others...

## Security

- Service role key is only used server-side
- Only public lists are exposed in OG tags
- Private lists return null (no OG tags generated)
- All user input is HTML-escaped to prevent XSS
