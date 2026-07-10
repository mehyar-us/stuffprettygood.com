/**
 * functions/api/track-click.js
 * Cloudflare Pages Function — receives spg-affiliate-click CustomEvents from
 * the client-side click tracker (backToTop() IIFE in build.mjs, tick 67).
 *
 * POST /api/track-click
 * Body: { id: string, source: string, ts: number }
 *
 * Currently a no-op server-side sink. Wire up to your analytics provider
 * (e.g. PostHog, Segment, or a D1 insert) by replacing the `logClick` stub.
 *
 * Falls back to 204 No Content so client errors never surface.
 *
 * NOTE: env vars in Cloudflare Pages Functions are passed via context.env
 * inside the handler — NOT as a module-scope global. We read them per-request.
 */

/**
 * @param {{ id: string, source: string, ts: number }} click
 * @param {string} writeKey  env.ANALYTICS_WRITE_KEY (passed in from handler)
 */
async function logClick(click, writeKey) {
  // TODO: replace with your analytics provider SDK call, e.g.:
  //
  // PostHog:
  //   const { PostHog } = await import('/assets/postHogClient.js');
  //   PostHog.capture('affiliate_click', { ...click });
  //
  // Segment (via proxy):
  //   await fetch('https://your-proxy.workers.dev/track', {
  //     method: 'POST',
  //     headers: { 'Content-Type': 'application/json' },
  //     body: JSON.stringify({ event: 'Affiliate Click', ...click }),
  //   });
  //
  // D1 insert:
  //   const DB = context.env.SPG_DB;
  //   await DB.prepare(
  //     'INSERT INTO affiliate_clicks (product_id, source, clicked_at) VALUES (?, ?, ?)'
  //   ).bind(click.id, click.source, new Date(click.ts).toISOString()).run();
  //
  // For now: log to console (visible in Cloudflare Tail logs)
  console.log('[track-click]', JSON.stringify(click), writeKey ? `(writeKey=${writeKey.slice(0, 6)}...)` : '(no write key)');
}

export async function onRequestPost(context) {
  const { request } = context;

  let click = null;
  try {
    click = await request.json();
  } catch (_) {
    return new Response(null, { status: 204 });
  }

  if (!click || !click.id || !click.source) {
    return new Response(null, { status: 204 });
  }

  const writeKey = (context && context.env && context.env.ANALYTICS_WRITE_KEY) || '';

  await logClick(click, writeKey).catch((err) => {
    console.error('[track-click] log error:', err);
  });

  return new Response(null, { status: 204 });
}
