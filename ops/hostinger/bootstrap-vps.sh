#!/usr/bin/env bash
set -euo pipefail

# Bootstrap helper for fresh Hostinger Ubuntu VPS.
# Executes a controlled set of baseline provisioning commands via SSH.
# All secrets must be provided via env vars and never echoed.

: "${HOSTINGER_VPS_SERVER_IP:?missing HOSTINGER_VPS_SERVER_IP}"
: "${HOSTINGER_VPS_SERVER_USERNAME:?missing HOSTINGER_VPS_SERVER_USERNAME}"
: "${HOSTINGER_SSH_PRIVATE_KEY_PATH:=~/.ssh/hostinger_deploy}"
: "${APP_NAME:=mehyarmedia-crm}"
: "${DEPLOY_PATH:=/opt/mehyarmedia-crm}"
: "${APP_PORT:=3000}"

SSH_KEY="$HOSTINGER_SSH_PRIVATE_KEY_PATH"
TARGET="${HOSTINGER_VPS_SERVER_USERNAME}@${HOSTINGER_VPS_SERVER_IP}"

if [ ! -f "$SSH_KEY" ]; then
  echo "SSH key file not found: $SSH_KEY" >&2
  exit 1
fi

ssh -i "$SSH_KEY" -o BatchMode=yes -o StrictHostKeyChecking=accept-new "$TARGET" <<REMOTE
set -euo pipefail

APP_NAME='${APP_NAME}'
DEPLOY_PATH='${DEPLOY_PATH}'
APP_PORT='${APP_PORT}'
APP_USER="$APP_NAME"

if command -v apt-get >/dev/null 2>&1; then
  export DEBIAN_FRONTEND=noninteractive
  sudo apt-get update
  sudo apt-get install -y curl rsync jq ufw nginx certbot python3-certbot-nginx ca-certificates logrotate fail2ban
else
  echo "Unsupported package manager on target host" >&2
  exit 1
fi

# Runtime dirs
sudo mkdir -p "$DEPLOY_PATH" "$DEPLOY_PATH/releases" "$DEPLOY_PATH/shared" "$DEPLOY_PATH/backups" "$DEPLOY_PATH/logs"

# Minimal app user
if ! id "$APP_USER" >/dev/null 2>&1; then
  sudo useradd --system --create-home --home-dir "$DEPLOY_PATH" --shell /usr/sbin/nologin "$APP_USER"
fi
sudo chown -R "$APP_USER:$APP_USER" "$DEPLOY_PATH"

# Firewall
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable

# SSH hardening baseline (deferred to ops/hostinger/ssh-hardening.sh execution)
cat > /tmp/hostinger-ssh-hardening-notes.txt <<EOF
- Apply ops/hostinger/ssh-hardening.sh after validating SSH connectivity.
- Rotate any temporary bootstrap key before moving to production.
EOF

# Nginx placeholder config (HTTP-only while cert bootstraps).
if [ ! -f "/etc/nginx/sites-available/$APP_NAME" ]; then
  sudo mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled
  sudo tee "/etc/nginx/sites-available/$APP_NAME" >/dev/null <<NGINX
server {
  listen 80;
  server_name mehyarmedia.mehyar.us;

  location / {
    proxy_pass http://127.0.0.1:$APP_PORT;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
  }
}
NGINX
  sudo ln -sfn "/etc/nginx/sites-available/$APP_NAME" "/etc/nginx/sites-enabled/$APP_NAME"
  sudo nginx -t
  sudo systemctl reload nginx
fi

echo "Bootstrap complete for $APP_NAME at $DEPLOY_PATH"
echo "Next steps: run ssh-hardening.sh and configure-nginx-https.sh from ops/hostinger."
REMOTE