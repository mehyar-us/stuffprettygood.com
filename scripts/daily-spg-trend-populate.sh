#!/usr/bin/env bash
set -euo pipefail
set +x

export PATH="/home/mehya/.local/bin:/home/mehya/.local/node/bin:${PATH}"
cd /home/mehya/work/mehyarmedia

if [[ -f /home/mehya/.hermes/.env ]]; then
  set -a
  # shellcheck disable=SC1091
  source /home/mehya/.hermes/.env
  set +a
fi

NODE_BIN="${NODE_BIN:-/home/mehya/.local/bin/node}"
SSH_KEY="${HOSTINGER_SSH_PRIVATE_KEY_PATH:-/home/mehya/.ssh/oraclestreet_vps}"
DEPLOY_PATH="${SPG_HOSTINGER_PATH:-/var/www/oraclestreet}"
mkdir -p .ops-logs
log_file=".ops-logs/spg-daily-$(date -u +%Y%m%dT%H%M%SZ).log"

run_daily() {
  "$NODE_BIN" scripts/fetch-google-trends.mjs data/google-trends-snapshot.json
  "$NODE_BIN" scripts/update-trend-offers.mjs data/google-trends-snapshot.json src/spg/trending-offers.js
  "$NODE_BIN" scripts/fetch-spg-rss.mjs data/spg-rss-source-registry.json data/spg-rss-snapshot.json
  "$NODE_BIN" scripts/update-spg-rss-candidates.mjs data/spg-rss-snapshot.json data/spg-rss-candidates.json
  "$NODE_BIN" scripts/build-spg-trend-pages.mjs
  "$NODE_BIN" --test
}

if ! run_daily >"${log_file}" 2>&1; then
  echo "SPG daily offer/media refresh failed. Review log ${PWD}/${log_file}. No deploy attempted."
  exit 1
fi

if git diff --quiet -- data/google-trends-snapshot.json data/spg-rss-snapshot.json data/spg-rss-candidates.json src/spg/trending-offers.js public/index.html public/today.html public/daily.html public/trends.html public/trends public/offers public/go public/assets public/robots.txt public/sitemap.xml src/spg/trend-components.js scripts/build-spg-trend-pages.mjs; then
  echo "SPG daily offer/media refresh checked: no content changes. Tests passed. No deploy attempted. Log: ${PWD}/${log_file}"
  exit 0
fi

if [[ -z "${HOSTINGER_VPS_SERVER_USERNAME:-}" || -z "${HOSTINGER_VPS_SERVER_IP:-}" || ! -f "${SSH_KEY}" ]]; then
  echo "SPG daily offer/media refresh updated pages/data and tests passed, but deploy prerequisites are missing. Log: ${PWD}/${log_file}"
  exit 0
fi

TARGET="${HOSTINGER_VPS_SERVER_USERNAME}@${HOSTINGER_VPS_SERVER_IP}"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
ssh -i "${SSH_KEY}" -o BatchMode=yes -o StrictHostKeyChecking=accept-new "${TARGET}" "mkdir -p /var/backups/mehyarmedia && if [ -d '${DEPLOY_PATH}' ]; then tar -C /var/www -czf /var/backups/mehyarmedia/oraclestreet-before-spg-daily-${TS}.tgz oraclestreet; fi && mkdir -p '${DEPLOY_PATH}'" >>"${log_file}" 2>&1
rsync -az --delete -e "ssh -i ${SSH_KEY} -o BatchMode=yes -o StrictHostKeyChecking=accept-new" public/ "${TARGET}:${DEPLOY_PATH}/" >>"${log_file}" 2>&1
ssh -i "${SSH_KEY}" -o BatchMode=yes -o StrictHostKeyChecking=accept-new "${TARGET}" "chown -R www-data:www-data '${DEPLOY_PATH}' || true; nginx -t && systemctl reload nginx" >>"${log_file}" 2>&1

echo "SPG daily offer/media refresh updated pages/data, tests passed, and deployed. Log: ${PWD}/${log_file}"
