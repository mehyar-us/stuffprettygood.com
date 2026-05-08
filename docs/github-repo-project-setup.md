# GitHub Repository + Project Setup

## Repository

- Repository: `mehyar-us/mehyarmedia`
- Visibility: private
- Deploy branch: `main`
- Issues: enabled
- Actions workflow: `.github/workflows/deploy-hostinger.yml`

## Branch protection baseline

Target policy for production/deploy branch `main`:

- Required pull request review before merge
- Dismiss stale approvals on new commits
- Conversation resolution before merge
- Required status check: `Build and test deployment artifact`
- Strict status check branch freshness
- Force pushes disabled
- Branch deletion disabled

Emergency administration remains possible for owners so Week-1 setup can recover quickly if a required check name changes.

Current limitation: GitHub returned HTTP 403 for both classic branch protection and repository rulesets on this private organization repository: `Upgrade to GitHub Pro or make this repository public to enable this feature.` Until the organization plan/repo visibility supports protection, treat `main` as operationally protected by owner discipline: merge via PR only, require passing Actions, and do not force-push or delete the branch.

## GitHub Project mapping

GitHub Project: `Mehyar CRM Command Center`

Workstreams are mapped as GitHub issues and added to the project board:

1. Infrastructure: Hostinger VPS, HTTPS, CI/CD, rollback
2. Product: CRM command center admin UX
3. Compliance: suppression, segmentation, audit gates
4. Data: PostgreSQL schema, migrations, backup restore proof
5. Integrations: provider registry, no-send connectors
6. Security: secrets isolation, deploy access, audit review
7. Monitoring: health checks, backups, rollback drills

No campaign send/blast work is enabled by this setup.

## Actions secrets required

Configured/expected secret names only; values must never be committed or printed:

- `HOSTINGER_DEPLOY_SSH_PRIVATE_KEY` (preferred) or `HOSTINGER_SSH_PRIVATE_KEY`
- `HOSTINGER_HOST` (preferred) or `HOSTINGER_VPS_SERVER_IP`
- `HOSTINGER_USER` (preferred) or `HOSTINGER_VPS_SERVER_USERNAME`
- `HOSTINGER_PORT` (defaults to `22` when absent)
- `PRODUCTION_ENV_B64`

`PRODUCTION_ENV_B64` should be a base64-encoded production `.env` payload containing runtime app settings only. Keep deploy credentials in separate GitHub Actions secrets.

## Rollback notes

Rollback path is documented in `docs/hostinger-deployment-runbook.md` and implemented by `ops/hostinger/rollback.sh`:

1. Identify prior release under `/opt/mehyarmedia-crm/releases`.
2. Repoint `/opt/mehyarmedia-crm/current` to the prior release.
3. Restart `mehyarmedia-crm.service`.
4. Verify local health: `http://127.0.0.1:3000/health`.
5. Verify public health: `https://mehyarmedia.mehyar.us/health`.

Rollback preserves release artifacts and does not run destructive database queries.
