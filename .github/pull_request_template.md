## Control checklist

- [ ] CI passed for this branch/PR (`npm test` locally and GitHub Actions green or explicitly documented if unavailable).
- [ ] Live health impact reviewed: production health endpoint is known before merge and will be checked after any production deploy.
- [ ] Secret-safety check completed: no secrets, private keys, `.env` files, tokens, or raw credentials are committed, logged, screenshotted, or placed in frontend code.
- [ ] Deployment path respected: no direct production deploy outside `.github/workflows/deploy-hostinger.yml` / GitHub Actions.
- [ ] Change scope reviewed against compliance gates: no mass sending, no blasting, no destructive legacy DB queries, and no campaign-scale action without suppression/segmentation/audit controls.

## Summary

-

## Verification

-

## Production / rollback notes

-
