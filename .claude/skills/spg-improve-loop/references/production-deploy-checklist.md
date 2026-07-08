# Production Deploy Checklist

The exact sequence to ship to `https://stuffprettygood.com` without the preview-URL trap. This file is the deploy runbook; the main SKILL.md links here for the why.

## The trap, restated

`wrangler pages deploy` deploys to the branch you specify. If you pass `--branch <preview>`, it deploys to `<preview>.<project>.pages.dev` — a preview URL. The custom domain `stuffprettygood.com` only serves the `production` branch. A preview deploy does NOT update the custom domain. The 3 stuck kanban cards all did this.

The fix is mechanical: always pass `--branch production`. Verify with `curl` against the custom domain. Repeat.

## Exact deploy sequence

```bash
# 1. Verify the working tree
cd ~/OneDrive/Documents/GitHub/stuffprettygood.com
git status
git branch                                          # must be deploy/legal-expansion-and-signup-modal
git log --oneline -3

# 2. Validate before deploying
node scripts/validate.mjs                           # must exit 0
# Capture the output — paste the exit code in the Telegram report

# 3. Build
node scripts/build.mjs                              # regenerates dist/
ls -la dist/ | head -5                              # confirm dist/ has new content
du -sh dist/                                        # size sanity check

# 4. Deploy to PRODUCTION
wrangler pages deploy dist \
  --project-name stuffprettygood \
  --branch production \
  --commit-dirty=true \
  2>&1 | tee /tmp/spg-deploy.log
```

Capture the deployment ID from the wrangler output. The shape is:
```
Uploaded stuffprettygood (1.2 sec)
Published stuffprettygood (5.0 sec)
  <deployment-id>  https://stuffprettygood.com
```

The deployment ID is the long hex string before the URL. Save it; it goes in the Telegram report.

## Edge propagation

Cloudflare Pages deploys are usually live at the edge in 10-30 seconds. The custom domain, however, has additional propagation:
- DNS: usually instant (the domain is already on Cloudflare)
- Page cache: 10-30 seconds for `?cb=` URLs (cache-busted)
- Page cache: up to 5 minutes for cache-respecting URLs (no cache-buster, no `Cache-Control: no-store`)

The skill adds `?cb=$(date +%s)` to verification curls to bypass cache. Real users with no cache-buster may see the old version for up to 5 minutes — that's expected, not a deploy failure.

## Custom domain DNS gotchas

The custom domain `stuffprettygood.com` is a Cloudflare-managed zone. As of this session:
- Account ID: `621600637337cc1c9ecb7095508bc732`
- 8 zones on the account
- Custom domain is wired to the `production` branch of the `stuffprettygood` Pages project

**If `curl https://stuffprettygood.com` returns 404 or 522 after a deploy:**

1. `wrangler pages deployment list --project-name stuffprettygood` — find the most recent deployment, confirm it succeeded
2. `curl -sI https://stuffprettygood.com` — check the `cf-cache-status`, `cf-ray`, and `server` headers
3. If `cf-cache-status: HIT` and the content is stale, the edge hasn't re-fetched — wait 5 minutes
4. If `cf-cache-status: MISS` and the content is wrong, the deployment didn't actually reach the custom domain — re-run with `--branch production` and verify
5. If 404, the custom domain binding is broken — check Cloudflare dashboard → Pages → stuffprettygood → Custom domains

## The env-var that's a misnomer

`CLOUDFLARE_API_TOKEN` in `~/.hermes/.env` is actually a 37-character Global API Key, not a Bearer token. Wrangler accepts it either way, but the auth scope is what matters. If deploys start returning 403:

```bash
curl -sS "https://api.cloudflare.com/client/v4/user" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" | head -20
# Should return {"success":true,...} with the user's email
# If it returns {"success":false,"errors":[{"code":10000,...}]}, the key is bad
```

## The build artifact lifecycle

```
src/                          page templates + data
  └── scripts/build.mjs  ──▶  dist/   (regenerated every build)
                                ▲
                                │
                          wrangler uploads this dir
```

**Never** edit files in `dist/` directly. The build will overwrite them on the next `node scripts/build.mjs`. If you need a one-off change to a single page (e.g. adding a JSON-LD block to `/gift-finder/`), edit the template inside `scripts/build.mjs` that generates that page. The exception is the homepage's inline `<script>` blocks (the AI catalog, the AI bubble handler) — those are in `dist/index.html` and are *not* regenerated, they're hand-edited. The build script doesn't touch `dist/index.html`'s inline scripts; check `scripts/build.mjs` to confirm what is and isn't regenerated.

## What "deployed to production" actually means

A production deploy is successful if **all** of these are true:

1. `wrangler pages deploy` returned a deployment ID (the long hex string)
2. `wrangler pages deployment list --project-name stuffprettygood` shows the new ID as the most recent
3. `curl -sS "https://stuffprettygood.com/?cb=$(date +%s)"` returns HTML that contains a string from the *new* build (not the old)
4. The `git push` of the source commit completed (`git log origin/deploy/legal-expansion-and-signup-modal --oneline -1` shows the new SHA)
5. No `git status` shows uncommitted changes

If any of those 5 fails, the deploy is not done. Re-run from step 4 of the deploy sequence.

## Rollback

If a production deploy breaks something and the user needs it reverted fast:

```bash
# Find the previous deployment
wrangler pages deployment list --project-name stuffprettygood

# Roll back via the dashboard — the CLI doesn't have a direct rollback command
# Cloudflare Dashboard → Pages → stuffprettygood → Deployments → click previous → "Rollback to this deploy"
```

Or, the faster path: `git revert HEAD && git push && node scripts/build.mjs && wrangler pages deploy dist --project-name stuffprettygood --branch production`. Slower because it goes through the full pipeline, but scriptable and audit-friendly.

## Pitfalls

1. **Deploying to a preview branch "to test" then forgetting to redeploy to production.** If you ever do this, the production site stays on the *old* version. Always re-deploy to production after any preview check.
2. **Trusting `wrangler pages deployment list` without also curling the custom domain.** The deployment list confirms the upload succeeded; only the curl confirms the custom domain serves it. Two different things.
3. **Skipping `node scripts/validate.mjs` "because it's just a CSS change."** CSS changes can break responsive layout, can introduce color-contrast failures, can break the form symmetry that t_08efaa44 is about. Run the validator. Always.
4. **Leaving a `dist/` that's out of sync with `src/`.** The `node scripts/build.mjs` is idempotent but not transactional. If the build is interrupted, `dist/` may be half-old, half-new. `rm -rf dist && node scripts/build.mjs` to force a clean rebuild.
5. **Committing the `dist/` directory on a branch that doesn't have it as a build artifact.** This repo commits `dist/` (it's a Cloudflare Pages setup, the Pages pipeline doesn't run a build — it serves the committed `dist/`). If you switch branches and one has `dist/` and the other doesn't, the Pages deploy will serve a stale or empty site. Always check `git status` before deploying.
