# Hostinger Deployment Runbook (MEHAA-4)

Owner: Noah Brooks (primary), Owen Brooks (secondary)

## Purpose
Define the end-to-end Hostinger deployment path and evidence for:
- VPS bootstrap
- SSH hardening
- CI/CD workflow activation
- HTTPS + domain enablement
- Rollback and health verification

## 1) Bootstrap (operator-controlled)

From local machine:

```bash
cd /home/mehya/paperclip-work/mehyarmedia
export HOSTINGER_VPS_SERVER_IP="<ip>"
export HOSTINGER_VPS_SERVER_USERNAME="<user>"
export HOSTINGER_SSH_PRIVATE_KEY_PATH="~/.ssh/hostinger_deploy"
./ops/hostinger/bootstrap-vps.sh
```

`bootstrap-vps.sh` provisions:
- apt packages: `nginx`, `certbot`, `ufw`, `fail2ban`, etc.
- directory layout: `/opt/mehyarmedia-crm/{releases,shared,backups,logs}`
- base app user `${APP_NAME}`
- base firewall: OpenSSH + 80 + 443
- HTTP reverse-proxy placeholder for `mehyarmedia.mehyar.us`

## 2) SSH hardening

After bootstrap and before production deployment:

```bash
ssh -i "$HOSTINGER_SSH_PRIVATE_KEY_PATH" "$HOSTINGER_VPS_SERVER_USERNAME@$HOSTINGER_VPS_SERVER_IP" \
  'sudo bash -s' < ./ops/hostinger/ssh-hardening.sh
```

Baseline items enabled:
- disable root password login
- disable password auth
- limit auth attempts
- drop weak interactive channels
- start `fail2ban` jail for SSH

## 3) HTTPS on mehyarmedia.mehyar.us

From CI/CD or directly on VPS:

```bash
export CRM_DOMAIN="mehyarmedia.mehyar.us"
export LETSENCRYPT_EMAIL="admin@mehyarmedia.mehyar.us"
export APP_NAME="mehyarmedia-crm"
export PORT="3000"

ssh -i "$HOSTINGER_SSH_PRIVATE_KEY_PATH" "$HOSTINGER_VPS_SERVER_USERNAME@$HOSTINGER_VPS_SERVER_IP" \
  "APP_NAME='$APP_NAME' CRM_DOMAIN='$CRM_DOMAIN' LETSENCRYPT_EMAIL='$LETSENCRYPT_EMAIL' PORT='$PORT' bash -s" < ops/hostinger/configure-nginx-https.sh
```

Script expectation: `curl -fsS https://$DOMAIN/health` returns healthy response.

## 4) CI/CD path

GitHub Actions workflow lives at:
- `.github/workflows/deploy-hostinger.yml`

It builds, uploads artifact, copies to `/tmp/mehyarmedia-crm-<sha>.tgz`, activates via `ops/hostinger/activate-release.sh`, and checks public health.

## 5) Rollback path

On VPS or operator machine:

```bash
ssh -i "$HOSTINGER_SSH_PRIVATE_KEY_PATH" "$HOSTINGER_VPS_SERVER_USERNAME@$HOSTINGER_VPS_SERVER_IP" \
  "APP_NAME=mehyarmedia-crm DEPLOY_PATH=/opt/mehyarmedia-crm bash -s" < ops/hostinger/rollback.sh <release_sha>
```

## 6) Health checks

- App local target (during activation): `http://127.0.0.1:3000/health`
- Public target: `https://mehyarmedia.mehyar.us/health`

Accept criteria:
- return status 200
- response contains `ok` keyword

## 7) Secrets hygiene (non-negotiable)

- No secrets in command logs, commit messages, scripts, comments, screenshots.
- Secrets only in CI platform secret store or operator local vault.
- Temporary bootstrap secrets should be rotated after first dry-run access.
