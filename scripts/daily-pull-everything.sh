#!/usr/bin/env bash
set -euo pipefail
set +x

REPO="${MEHYARMEDIA_REPO:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
ENV_FILE="${MEHYARMEDIA_ENV_FILE:-$REPO/.env}"
SSH_KEY="${HOSTINGER_SSH_PRIVATE_KEY_PATH:-/home/mehya/.ssh/oraclestreet_vps}"
REMOTE_ROOT="${SPG_HOSTINGER_PATH:-/var/www/oraclestreet}"
NODE_BIN="${NODE_BIN:-node}"

export PATH="/home/mehya/.local/bin:/home/mehya/.local/node/bin:${PATH}"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

cd "$REPO"
mkdir -p .ops-logs data/daily-pull
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
log_file="$REPO/.ops-logs/daily-pull-everything-${stamp}.log"
lock_file="$REPO/.ops-logs/daily-pull-everything.lock"

exec 9>"$lock_file"
if ! flock -n 9; then
  echo "Mehyar Media daily pull already running; skipping duplicate tick."
  exit 0
fi

run_step() {
  local label="$1"
  shift
  echo "=== ${label} ===" >>"$log_file"
  "$@" >>"$log_file" 2>&1
}

status="ok"
error_step=""

{
  echo "Mehyar Media daily pull started ${stamp}"
  echo "Repo: ${REPO}"
} >"$log_file"

if ! run_step "SPG trend/RSS/durable ingest + page build + offer QA + tests" npm run spg:daily; then
  status="failed"
  error_step="spg_daily"
fi

if [[ "$status" == "ok" ]]; then
  if ! run_step "Opportunity Finder collect: SAM.gov, USAspending, Grants.gov, RSS, postings, affiliate/source signals" npm run opportunities:collect; then
    status="failed"
    error_step="opportunities_collect"
  fi
fi

if [[ "$status" == "ok" ]]; then
  run_step "Daily pull summary artifact" "$NODE_BIN" --input-type=module <<'NODE'
import fs from 'node:fs';
const read = (p, fallback) => fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : fallback;
const opp = read('data/opportunity-desk/opportunities.json', { opportunities: [] });
const runs = read('data/opportunity-desk/opportunity-source-runs.json', { latest_runs: [] });
const rss = read('data/spg-rss-candidates.json', { candidates: [] });
const trends = read('data/google-trends-snapshot.json', {});
const durable = read('data/spg-durable-store.json', { offers: [], offer_candidates: [], source_items: [], page_placements: [] });
const health = {};
for (const r of runs.latest_runs || []) health[r.status || 'unknown'] = (health[r.status || 'unknown'] || 0) + 1;
const trendSeedCount = Array.isArray(trends.seeds) ? trends.seeds.length : 0;
const trendRelatedCount = Array.isArray(trends.seeds) ? trends.seeds.reduce((n, seed) => n + ((seed.related || []).length), 0) : 0;
const summary = {
  generated_at: new Date().toISOString(),
  status: 'ok',
  source_families: ['google_trends','spg_rss','spg_durable_offers','sam_gov','usaspending','grants_gov','postings','affiliate_source_signals'],
  counts: {
    opportunities: (opp.opportunities || []).length,
    opportunity_source_runs: (runs.latest_runs || []).length,
    spg_rss_candidates: (rss.candidates || []).length,
    spg_offer_records: (durable.offers || []).length,
    spg_offer_candidates: (durable.offer_candidates || []).length,
    spg_source_items: (durable.source_items || []).length,
    spg_page_placements: (durable.page_placements || []).length,
    google_trend_seeds: trendSeedCount,
    google_trend_related_queries: trendRelatedCount
  },
  opportunity_source_health: health,
  guardrails: [
    'internal collection only',
    'no bids/applications/outreach/spend/account KYC/provider push/email/SMS from this job',
    'no raw secrets or PII in logs/docs/Kanban/frontend',
    'SPG offer QA must pass before deploy'
  ]
};
fs.writeFileSync('data/daily-pull/latest.json', JSON.stringify(summary, null, 2));
fs.writeFileSync(`data/daily-pull/${summary.generated_at.replace(/[:.]/g,'-')}.json`, JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
NODE
fi

if [[ "$status" == "ok" ]]; then
  changed_paths=(
    data/google-trends-snapshot.json
    data/spg-rss-snapshot.json
    data/spg-rss-candidates.json
    data/daily-pull/latest.json
    data/opportunity-desk/opportunities.json
    data/opportunity-desk/opportunity-source-runs.json
    src/spg/trending-offers.js
    public/index.html public/today.html public/daily.html public/trends.html
    public/trends public/offers public/go public/assets public/robots.txt public/sitemap.xml
    src/spg/trend-components.js scripts/build-spg-trend-pages.mjs
  )
  if command -v git >/dev/null 2>&1 && git rev-parse --is-inside-work-tree >/dev/null 2>&1 && git diff --quiet -- "${changed_paths[@]}"; then
    deploy_status="no_changes"
  elif [[ -n "${HOSTINGER_VPS_SERVER_USERNAME:-}" && -n "${HOSTINGER_VPS_SERVER_IP:-}" && -f "$SSH_KEY" ]]; then
    deploy_status="deployed"
    REMOTE="${HOSTINGER_VPS_SERVER_USERNAME}@${HOSTINGER_VPS_SERVER_IP}"
    ssh_opts=(-i "$SSH_KEY" -o BatchMode=yes -o StrictHostKeyChecking=accept-new)
    run_step "Hostinger backup" ssh "${ssh_opts[@]}" "$REMOTE" "mkdir -p /var/backups/mehyarmedia && if [ -d '${REMOTE_ROOT}' ]; then tar -C /var/www -czf /var/backups/mehyarmedia/oraclestreet-before-daily-all-${stamp}.tgz oraclestreet; fi && mkdir -p '${REMOTE_ROOT}'"
    run_step "Hostinger rsync public" rsync -az --delete -e "ssh -i $SSH_KEY -o BatchMode=yes -o StrictHostKeyChecking=accept-new" public/ "$REMOTE:${REMOTE_ROOT}/"
    run_step "Hostinger nginx reload" ssh "${ssh_opts[@]}" "$REMOTE" "chown -R www-data:www-data '${REMOTE_ROOT}' || true; nginx -t && systemctl reload nginx"
    run_step "Live SPG smoke" npm run spg:smoke
  else
    deploy_status="changed_no_deploy_prereqs"
  fi
  "$NODE_BIN" --input-type=module <<NODE >>"$log_file" 2>&1
import fs from 'node:fs';
const p='data/daily-pull/latest.json';
const s=JSON.parse(fs.readFileSync(p,'utf8'));
s.deploy_status='${deploy_status}';
s.log_file='${log_file}';
fs.writeFileSync(p, JSON.stringify(s,null,2));
NODE
  echo "✅ Mehyar Media daily pull everything: ok; deploy_status=${deploy_status}; log=${log_file}"
  "$NODE_BIN" --input-type=module <<'NODE'
import fs from 'node:fs';
const s=JSON.parse(fs.readFileSync('data/daily-pull/latest.json','utf8'));
console.log(`Counts: opportunities=${s.counts.opportunities}, opportunity_source_runs=${s.counts.opportunity_source_runs}, rss_candidates=${s.counts.spg_rss_candidates}, offer_records=${s.counts.spg_offer_records}, offer_candidates=${s.counts.spg_offer_candidates}, source_items=${s.counts.spg_source_items}, trend_seeds=${s.counts.google_trend_seeds}, trend_queries=${s.counts.google_trend_related_queries}`);
console.log(`Source health: ${Object.entries(s.opportunity_source_health).map(([k,v])=>`${k}=${v}`).join(', ') || 'none'}`);
console.log('Guardrail: internal collection only; no outreach/bid/application/spend/provider push/email/SMS.');
NODE
  exit 0
fi

echo "⚠️ Mehyar Media daily pull everything failed at ${error_step}. Review log: ${log_file}"
exit 1
