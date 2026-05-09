# Private-repo compensating controls

`mehyar-us/mehyarmedia` stays private for Phase 1. GitHub native branch protection and required code-owner review are not available on the current private-repo plan, so the controls below reduce main-branch and production risk until the paid-plan upgrade trigger is reached.

## Active controls

- Repository visibility remains private.
- Production ownership is documented in `.github/CODEOWNERS` for app, database, workflow, deployment, rollback, hardening, and operational-documentation paths.
- Pull requests use `.github/pull_request_template.md`, requiring:
  - CI/local test confirmation.
  - Live-health awareness before/after production-impacting changes.
  - Secret-safety check.
  - No production deploy outside GitHub Actions.
  - Compliance gate acknowledgement for suppression, segmentation, audit logs, and no campaign blasting.
- Production deploy is defined in `.github/workflows/deploy-hostinger.yml` and runs the test job before SSH activation and public health verification.
- Deploy credentials are referenced by GitHub Actions secret names only; secret values and private-key material must never be committed or printed.

## Verified production path

Current production deployment path is GitHub Actions workflow `.github/workflows/deploy-hostinger.yml`:

1. `push` to `main` or approved `workflow_dispatch` starts the workflow.
2. The `test` job installs dependencies, runs `npm test`, creates a release artifact, and uploads it.
3. The `deploy` job downloads the artifact, uses GitHub Actions secrets for Hostinger SSH/env custody, activates the release on the VPS, and checks `https://mehyarmedia.mehyar.us/crm-health`.

No alternate production deployment workflow is documented in this repository. Operator scripts under `ops/hostinger/` are retained for bootstrap, activation, rollback, and emergency operations but should not bypass GitHub Actions for routine production deploys.

## Residual policy-only controls until upgrade

These controls are documented but not technically enforceable by GitHub while the repo remains private on the current plan:

- Required PR review before `main` changes.
- Required code-owner approval.
- Required status check before merge.
- Force-push and branch-deletion prevention on `main`.
- Conversation resolution before merge.

Upgrade the GitHub plan before external collaborators, shared production merge responsibility, or any failure of PR-only owner discipline.
