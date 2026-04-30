#!/usr/bin/env bash
set -euo pipefail

APP_NAME="${APP_NAME:-mehyarmedia-crm}"
DEPLOY_PATH="${DEPLOY_PATH:-/opt/mehyarmedia-crm}"
RELEASES_DIR="$DEPLOY_PATH/releases"
CURRENT_LINK="$DEPLOY_PATH/current"
SERVICE_NAME="$APP_NAME.service"

TARGET_RELEASE="${1:-}"
if [ -z "$TARGET_RELEASE" ]; then
  TARGET_RELEASE="$(find "$RELEASES_DIR" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %f\n' | sort -rn | awk 'NR==2 {print $2}')"
fi

if [ -z "$TARGET_RELEASE" ] || [ ! -d "$RELEASES_DIR/$TARGET_RELEASE" ]; then
  echo "Usage: $0 <release_sha>" >&2
  echo "Available releases:" >&2
  find "$RELEASES_DIR" -mindepth 1 -maxdepth 1 -type d -printf '  %f\n' | sort >&2
  exit 1
fi

sudo ln -sfn "$RELEASES_DIR/$TARGET_RELEASE" "$CURRENT_LINK"
sudo systemctl restart "$SERVICE_NAME"

PORT="$(grep -E '^PORT=' "$DEPLOY_PATH/shared/.env" | tail -1 | cut -d= -f2 || true)"
PORT="${PORT:-3000}"
curl -fsS "http://127.0.0.1:$PORT/health"
echo "Rolled back $APP_NAME to $TARGET_RELEASE"
