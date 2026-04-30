#!/usr/bin/env bash
set -euo pipefail

: "${APP_NAME:=mehyarmedia-crm}"
: "${APP_USER:=$APP_NAME}"

if command -v sshd >/dev/null 2>&1; then
  :
else
  echo "OpenSSH server not present yet. Run bootstrap first." >&2
  exit 1
fi

sudo mkdir -p /etc/ssh/sshd_config.d
sudo tee /etc/ssh/sshd_config.d/99-mehyarmedia.conf >/dev/null <<EOF
# Baseline hardening for operator-managed production box
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
ChallengeResponseAuthentication no
KbdInteractiveAuthentication no
UsePAM yes
X11Forwarding no
AllowTcpForwarding no
ClientAliveInterval 120
ClientAliveCountMax 2
MaxAuthTries 3
AllowUsers ${APP_USER}
EOF

if ! command -v fail2ban-server >/dev/null 2>&1; then
  echo "fail2ban not installed; skipping jail enable."
  exit 0
fi

cat >/tmp/jail.local.tmp <<EOF
[sshd]
enabled = true
EOF
sudo tee /etc/fail2ban/jail.d/10-sshd.conf >/dev/null < /tmp/jail.local.tmp

sudo systemctl restart sshd || sudo systemctl restart ssh
sudo systemctl enable fail2ban || true
sudo systemctl restart fail2ban || true
