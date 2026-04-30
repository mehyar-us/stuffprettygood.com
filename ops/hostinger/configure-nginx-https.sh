#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${CRM_DOMAIN:-mehyarmedia.mehyar.us}"
APP_PORT="${PORT:-3000}"
EMAIL="${LETSENCRYPT_EMAIL:-admin@mehyarmedia.mehyar.us}"
APP_NAME="${APP_NAME:-mehyarmedia-crm}"

sudo apt-get update
sudo apt-get install -y nginx certbot python3-certbot-nginx ufw curl

sudo tee "/etc/nginx/sites-available/$APP_NAME" >/dev/null <<NGINX
server {
  listen 80;
  server_name $DOMAIN;

  location / {
    proxy_pass http://127.0.0.1:$APP_PORT;
    proxy_http_version 1.1;
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

sudo ufw allow OpenSSH || true
sudo ufw allow 'Nginx Full' || true

sudo certbot --nginx --non-interactive --agree-tos --redirect -m "$EMAIL" -d "$DOMAIN"
curl -fsS "https://$DOMAIN/health"
