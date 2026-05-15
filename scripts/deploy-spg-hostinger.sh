#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PUBLIC_DIR="${SPG_PUBLIC_DIR:-$ROOT_DIR/public}"
SSH_TARGET="${SPG_DEPLOY_SSH_TARGET:-oraclestreet-vps}"
REMOTE_ROOT="${SPG_REMOTE_ROOT:-/var/www/oraclestreet}"
REMOTE_BACKUP_DIR="${SPG_REMOTE_BACKUP_DIR:-/var/backups/spg-static}"
LIVE_BASE_URL="${SPG_LIVE_BASE_URL:-https://stuffprettygood.com}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"

cd "$ROOT_DIR"

echo "[spg-deploy] root=$ROOT_DIR"
echo "[spg-deploy] target=$SSH_TARGET remote_root=$REMOTE_ROOT live=$LIVE_BASE_URL"

echo "[spg-deploy] running local deploy gate"
npm run spg:deploy:gate

echo "[spg-deploy] creating remote backup"
ssh "$SSH_TARGET" "set -euo pipefail; mkdir -p '$REMOTE_BACKUP_DIR'; if [ -d '$REMOTE_ROOT' ]; then tar -C '$(dirname "$REMOTE_ROOT")' -czf '$REMOTE_BACKUP_DIR/oraclestreet-$STAMP.tgz' '$(basename "$REMOTE_ROOT")'; fi; ls -lh '$REMOTE_BACKUP_DIR/oraclestreet-$STAMP.tgz' 2>/dev/null || true"

echo "[spg-deploy] rsync public bundle"
rsync -az --checksum --human-readable --itemize-changes \
  --exclude='.DS_Store' \
  --exclude='*.map' \
  "$PUBLIC_DIR/" "$SSH_TARGET:$REMOTE_ROOT/"

echo "[spg-deploy] fixing permissions and checking nginx"
ssh "$SSH_TARGET" "set -euo pipefail; chown -R www-data:www-data '$REMOTE_ROOT'; find '$REMOTE_ROOT' -type d -exec chmod 755 {} +; find '$REMOTE_ROOT' -type f -exec chmod 644 {} +; nginx -t"

echo "[spg-deploy] running strict live smoke"
SPG_LIVE_BASE_URL="$LIVE_BASE_URL" node scripts/strict-live-spg-smoke.mjs --base-url="$LIVE_BASE_URL"

echo "[spg-deploy] deployed_ok stamp=$STAMP backup=$REMOTE_BACKUP_DIR/oraclestreet-$STAMP.tgz"
