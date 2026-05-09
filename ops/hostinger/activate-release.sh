#!/usr/bin/env bash
set -euo pipefail

: "${GITHUB_SHA:?missing GITHUB_SHA}"
: "${APP_NAME:=mehyarmedia-crm}"
: "${DEPLOY_PATH:=/opt/mehyarmedia-crm}"

ARTIFACT="/tmp/${APP_NAME}-${GITHUB_SHA}.tgz"
RELEASES_DIR="$DEPLOY_PATH/releases"
CURRENT_LINK="$DEPLOY_PATH/current"
SHARED_DIR="$DEPLOY_PATH/shared"
RELEASE_DIR="$RELEASES_DIR/$GITHUB_SHA"
SERVICE_NAME="$APP_NAME.service"
APP_USER="$APP_NAME"
APP_PORT="${PORT:-3000}"

run_sudo() {
  sudo -n "$@"
}

if [ ! -f "$ARTIFACT" ]; then
  echo "Artifact not found: $ARTIFACT" >&2
  exit 1
fi

if ! id "$APP_USER" >/dev/null 2>&1; then
  run_sudo useradd --system --home "$DEPLOY_PATH" --shell /usr/sbin/nologin "$APP_USER"
fi

run_sudo mkdir -p "$RELEASES_DIR" "$SHARED_DIR" "$DEPLOY_PATH/backups" "$DEPLOY_PATH/logs"
run_sudo chown -R "$APP_USER:deploy" "$DEPLOY_PATH"
run_sudo chmod -R g+rwX "$DEPLOY_PATH"

run_sudo mkdir -p "$RELEASE_DIR"
run_sudo tar --no-same-owner --no-same-permissions --delay-directory-restore -xzf "$ARTIFACT" -C "$RELEASE_DIR"
run_sudo chown -R "$APP_USER:deploy" "$RELEASE_DIR"
run_sudo chmod -R g+rwX "$RELEASE_DIR"

if [ -n "${DEPLOY_ENV_B64:-}" ]; then
  ENV_TMP="$(mktemp)"
  printf '%s' "$DEPLOY_ENV_B64" | base64 -d > "$ENV_TMP"
  run_sudo install -m 600 -o "$APP_USER" -g "$APP_USER" "$ENV_TMP" "$SHARED_DIR/.env"
  rm -f "$ENV_TMP"
elif [ ! -f "$SHARED_DIR/.env" ]; then
  ENV_TMP="$(mktemp)"
  cat > "$ENV_TMP" <<ENV
NODE_ENV=production
PORT=$APP_PORT
CRM_DOMAIN=mehyarmedia.mehyar.us
FIRST_BRAND_DOMAIN=stuffprettygood.com
ENV
  run_sudo install -m 600 -o "$APP_USER" -g "$APP_USER" "$ENV_TMP" "$SHARED_DIR/.env"
  rm -f "$ENV_TMP"
fi

ln -sfn "$SHARED_DIR/.env" "$RELEASE_DIR/.env"

cd "$RELEASE_DIR"
if [ -f package-lock.json ]; then
  npm ci --omit=dev
else
  npm install --omit=dev --package-lock=false
fi
npm test

run_sudo ln -sfn "$RELEASE_DIR" "$CURRENT_LINK"
run_sudo chown -h "$APP_USER:$APP_USER" "$CURRENT_LINK"

UNIT_TMP="$(mktemp)"
cat > "$UNIT_TMP" <<UNIT
[Unit]
Description=Mehyar Media CRM Command Center
After=network.target

[Service]
Type=simple
User=$APP_USER
Group=$APP_USER
WorkingDirectory=$CURRENT_LINK
EnvironmentFile=$SHARED_DIR/.env
ExecStart=/usr/bin/node src/server.js
Restart=always
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ReadWritePaths=$DEPLOY_PATH

[Install]
WantedBy=multi-user.target
UNIT
run_sudo install -m 644 -o root -g root "$UNIT_TMP" "/etc/systemd/system/$SERVICE_NAME"
rm -f "$UNIT_TMP"

run_sudo systemctl daemon-reload
run_sudo systemctl enable "$SERVICE_NAME"
run_sudo systemctl restart "$SERVICE_NAME"

for attempt in 1 2 3 4 5 6; do
  if curl -fsS --max-time 5 "http://127.0.0.1:$APP_PORT/health" | grep -Eqi 'ok|healthy'; then
    echo "Local health check passed"
    break
  fi
  if [ "$attempt" = "6" ]; then
    run_sudo journalctl -u "$SERVICE_NAME" -n 80 --no-pager
    exit 1
  fi
  sleep 5
done

find "$RELEASES_DIR" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' | sort -rn | awk 'NR>5 {print $2}' | xargs -r rm -rf
rm -f "$ARTIFACT"
