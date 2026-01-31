/**
 * Cloudflare Pages Function for /l/:slug
 * 
 * Intercepts requests to list pages and returns OG meta tags for bots/crawlers.
 * Regular users get the normal SPA response.
 */

/// <reference types="@cloudflare/workers-types" />

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

// Type for Cloudflare Pages Function context
interface PagesFunctionContext<Env = unknown> {
  request: Request;
  env: Env;
  params: Record<string, string | undefined>;
  next: () => Promise<Response>;
  waitUntil: (promise: Promise<unknown>) => void;
  data: unknown;
}

// Known bot/crawler user agents
const BOT_USER_AGENTS = [
  'facebookexternalhit',
  'Facebot',
  'Twitterbot',
  'Slackbot',
  'Slack',
  'Discordbot',
  'LinkedInBot',
  'WhatsApp',
  'TelegramBot',
  'Applebot',
  'Googlebot',
  'Bingbot',
  'YandexBot',
  'DuckDuckBot',
  'Baiduspider',
  'Sogou',
  'Exabot',
  'ia_archiver',
  'SkypeUriPreview',
];

function isBot(userAgent: string | null): boolean {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return BOT_USER_AGENTS.some(bot => ua.includes(bot.toLowerCase()));
}

interface ListData {
  name: string;
  description: string | null;
  slug: string;
  visibility: string;
  updated_at: string;
}

async function fetchListData(slug: string, env: Env): Promise<ListData | null> {
  try {
    const response = await fetch(
      `${env.SUPABASE_URL}/rest/v1/lists?slug=eq.${encodeURIComponent(slug)}&select=name,description,slug,visibility,updated_at&limit=1`,
      {
        headers: {
          'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.error(`Supabase error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    if (!data || data.length === 0) {
      return null;
    }

    const list = data[0] as ListData;
    
    // Only return data for public lists
    if (list.visibility !== 'public') {
      return null;
    }

    return list;
  } catch (error) {
    console.error('Error fetching list data:', error);
    return null;
  }
}

function generateOGHTML(listData: ListData | null, slug: string, baseUrl: string): string {
  // If list doesn't exist or is private, use generic Foodly Map OG tags
  if (!listData) {
    const url = `${baseUrl}/l/${slug}`;
    const ogImage = `${baseUrl}/foodly-map-og.png`;
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Foodly Map</title>
  <meta name="description" content="A personal, social-first food map." />
  
  <!-- Canonical URL -->
  <link rel="canonical" href="${escapeHtml(url)}" />
  
  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${escapeHtml(url)}" />
  <meta property="og:title" content="Foodly Map" />
  <meta property="og:description" content="A personal, social-first food map." />
  <meta property="og:image" content="${escapeHtml(ogImage)}" />
  <meta property="og:image:alt" content="Foodly Map - A personal, social-first food map" />
  <meta property="og:site_name" content="Foodly Map" />
  
  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Foodly Map" />
  <meta name="twitter:description" content="A personal, social-first food map." />
  <meta name="twitter:image" content="${escapeHtml(ogImage)}" />
  <meta name="twitter:image:alt" content="Foodly Map - A personal, social-first food map" />
  
  <!-- Redirect to SPA -->
  <meta http-equiv="refresh" content="0; url=${escapeHtml(url)}" />
  <script>window.location.href = "${escapeHtml(url)}";</script>
</head>
<body>
  <p>Redirecting to <a href="${escapeHtml(url)}">Foodly Map</a>...</p>
</body>
</html>`;
  }

  // List exists and is public - use list-specific OG tags
  const title = listData.name;
  const description = listData.description || 'A Foodly Map list';
  const ogImage = `${baseUrl}/foodly-map-og.png`; // Use existing OG image for now
  const url = `${baseUrl}/l/${slug}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  
  <!-- Canonical URL -->
  <link rel="canonical" href="${escapeHtml(url)}" />
  
  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${escapeHtml(url)}" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:image" content="${escapeHtml(ogImage)}" />
  <meta property="og:image:alt" content="${escapeHtml(title)} - A Foodly Map list" />
  <meta property="og:site_name" content="Foodly Map" />
  
  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${escapeHtml(ogImage)}" />
  <meta name="twitter:image:alt" content="${escapeHtml(title)} - A Foodly Map list" />
  
  <!-- Redirect to SPA for non-bots -->
  <meta http-equiv="refresh" content="0; url=${escapeHtml(url)}" />
  <script>window.location.href = "${escapeHtml(url)}";</script>
</head>
<body>
  <p>Redirecting to <a href="${escapeHtml(url)}">${escapeHtml(title)}</a>...</p>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

export const onRequest = async (context: PagesFunctionContext<Env>) => {
  const { request, env, params } = context;
  const slug = params.slug as string;

  if (!slug) {
    // No slug, pass through to SPA
    return context.next();
  }

  // Check if this is a bot/crawler request
  const userAgent = request.headers.get('user-agent');
  const isBotRequest = isBot(userAgent);

  if (!isBotRequest) {
    // Not a bot - pass through to SPA
    return context.next();
  }

  // Bot request - fetch list data and return OG HTML
  const listData = await fetchListData(slug, env);

  // Determine base URL from request
  const url = new URL(request.url);
  const baseUrl = `${url.protocol}//${url.host}`;

  const html = generateOGHTML(listData, slug, baseUrl);

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600', // Cache for 1 hour
    },
  });
};
