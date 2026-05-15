#!/usr/bin/env bash
set -euo pipefail
set +x

export PATH="/home/mehya/.local/node/bin:${PATH}"
cd /home/mehya/work/mehyarmedia

if [[ -f /home/mehya/.hermes/.env ]]; then
  set -a
  # shellcheck disable=SC1091
  source /home/mehya/.hermes/.env
  set +a
fi

mkdir -p .ops-logs
log_file=".ops-logs/spg-daily-$(date -u +%Y%m%dT%H%M%SZ).log"

if ! npm run spg:daily >"${log_file}" 2>&1; then
  echo "SPG daily offer/media refresh failed: npm run spg:daily exited non-zero. Review log ${PWD}/${log_file}. No deploy attempted."
  exit 1
fi

if git diff --quiet -- data/google-trends-snapshot.json data/spg-rss-snapshot.json data/spg-rss-candidates.json src/spg/trending-offers.js public/index.html public/today.html public/daily.html public/trends.html public/trends public/go public/robots.txt public/sitemap.xml package.json src/spg/trend-components.js scripts/fetch-spg-rss.mjs scripts/update-spg-rss-candidates.mjs scripts/build-spg-trend-pages.mjs; then
  echo "SPG daily offer/media refresh checked: no content changes. Tests passed. No deploy attempted. Log: ${PWD}/${log_file}"
else
  echo "SPG daily offer/media refresh updated pages/data and tests passed. Review git diff, then deploy only when release gate is open. Log: ${PWD}/${log_file}"
fi
