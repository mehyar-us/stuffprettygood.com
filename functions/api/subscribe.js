/**
 * functions/api/subscribe.js
 * Cloudflare Pages Function — handles all newsletter / exit-intent signups.
 *
 * POST /api/subscribe
 *   source=exit-intent   → Resend: add to spg_welcome_drip_v1 audience,
 *                           tag with source=exit-intent, trigger 3-email drip
 *   source=homepage      → Resend: add to pretty-good-finds audience (general list)
 *   source=<any>         → same as homepage path
 *
 * Falls back to HTML success page if Resend is unconfigured or errors.
 * Errors are logged but never surface to the client (CAN-SPAM safe).
 */

const RESEND_API_KEY    = env.RESEND_API_KEY    ?? '';
const RESEND_FROM       = env.RESEND_FROM        ?? ' Stuff Pretty Good <hello@stuffprettygood.com>';
const DRIP_AUDIENCE_ID  = env.RESEND_AUDIENCE_DRIP ?? 'f61e01c1-ebbb-4cab-b2fe-05a7e3f4f7e8';
const GENERAL_AUDIENCE_ID = env.RESEND_AUDIENCE_GENERAL ?? '7a8c3d2e-5f6b-4a9e-b1c4-d3e2f1a0b9d6';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function htmlSuccess(email) {
  const safe = String(email)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  const body = `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<title>Stuff Pretty Good</title>` +
    `<style>body{font-family:system-ui;margin:40px;line-height:1.5;max-width:780px;background:#f8fafc;color:#111827}a{color:#111827}.ok{padding:22px;border:1px solid #e5e7eb;border-radius:22px;background:#fff;box-shadow:0 18px 60px rgba(15,23,42,.10)}.btn{display:inline-block;background:#111827;color:white!important;padding:12px 16px;border-radius:999px;text-decoration:none;font-weight:800}</style>` +
    `</head><body><div class="ok">` +
    `<h1>You're signed up.</h1>` +
    `<p>We saved ${safe} for Stuff Pretty Good finds.</p>` +
    `<p><a href="https://stuffprettygood.com/preferences/">Set preferences</a> · <a href="https://stuffprettygood.com/">Back to site</a></p>` +
    `</div></body></html>`;
  return new Response(body, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

// ---------------------------------------------------------------------------
// Resend helpers
// ---------------------------------------------------------------------------

/**
 * Add (or update) a contact in a Resend audience and apply tags.
 * @param {string} audienceId  Resend audience UUID
 * @param {string} email
 * @param {Array<{key:string, value:string}>} tags
 * @returns {Promise<{ok:boolean, contactId?:string, error?:string}>}
 */
async function resendAddContact(audienceId, email, tags = []) {
  if (!RESEND_API_KEY || !audienceId) return { ok: true, skipped: true };

  const upsertRes = await fetch(
    `https://api.resend.com/audiences/${audienceId}/contacts`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, unsubscribed: false }),
    }
  );

  if (!upsertRes.ok) {
    const err = await upsertRes.text();
    console.error('[resend] upsert error:', err);
    return { ok: false, error: err };
  }

  const contact = await upsertRes.json();

  // Apply each tag (sequentially to respect rate limits)
  for (const tag of tags) {
    const tagRes = await fetch(
      `https://api.resend.com/audiences/${audienceId}/contacts/${contact.id}/tags`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(tag),
      }
    );
    if (!tagRes.ok) {
      console.error('[resend] tag error:', await tagRes.text());
    }
  }

  return { ok: true, contactId: contact.id };
}

/**
 * Trigger a Resend email sequence (drip) for a contact.
 * The sequence must be created and active in the Resend dashboard.
 * The 1d and 3d emails in the drip are fired automatically by Resend's
 * sequence scheduler; we only trigger the immediate first email here.
 *
 * @param {string} email
 * @param {string} sequenceId  from env.RESEND_SEQUENCE_EXIT_IMMEDIATE
 */
async function resendTriggerDrip(email, sequenceId) {
  if (!RESEND_API_KEY || !sequenceId) return { ok: true, skipped: true };

  const res = await fetch(
    `https://api.resend.com/audiences/${DRIP_AUDIENCE_ID}/contacts/${encodeURIComponent(email)}/sequences/${sequenceId}/trigger`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!res.ok) {
    const err = await res.text();
    console.error('[resend] drip trigger error:', err);
    return { ok: false, error: err };
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export async function onRequestPost(context) {
  const { request } = context;
  const formData = await request.formData();

  const email     = (formData.get('email')      ?? '').toString().trim().toLowerCase();
  const firstName = (formData.get('first_name')  ?? '').toString().trim();
  const lastName  = (formData.get('last_name')   ?? '').toString().trim();
  const source    = (formData.get('source')      ?? 'homepage').toString().trim();
  const list      = (formData.get('list')       ?? 'pretty-good-finds').toString().trim();

  // Validate email — graceful fallback on bad input (no error shown to user)
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return htmlSuccess(email || 'unknown@example.com');
  }

  // Shared tags for all sources
  const baseTags = [
    { key: 'source', value: source },
    { key: 'list',   value: list },
  ];

  // ---- Exit-intent path: add to drip audience, trigger welcome sequence ----
  if (source === 'exit-intent') {
    const exitTags = [...baseTags, { key: ' signup_type', value: 'exit_intent' }];

    const added = await resendAddContact(DRIP_AUDIENCE_ID, email, exitTags);
    console.log(`[subscribe] exit-intent: ${email}, resend_added=${added.ok}`);

    // Trigger the drip (immediate welcome fires now; 1d + 3d handled by Resend)
    const seqId = env.RESEND_SEQUENCE_EXIT_IMMEDIATE ?? '';
    if (seqId) {
      await resendTriggerDrip(email, seqId);
      console.log(`[subscribe] drip triggered for ${email}`);
    }
  }

  // ---- General path: add to the main pretty-good-finds audience ----
  // (exit-intent signups also get added here for complete segmentation)
  const addedGeneral = await resendAddContact(GENERAL_AUDIENCE_ID, email, baseTags);
  console.log(`[subscribe] general: ${email}, added=${addedGeneral.ok}`);

  return htmlSuccess(email);
}

// Catch-all: redirect anything else to homepage
export async function onRequest(context) {
  return Response.redirect('https://stuffprettygood.com/', 301);
}
