# Mehyar Media CRM Command Center

Internal CRM foundation for lifecycle marketing operations.

Phase 1 priority: build the control room before any sending capability.

Current implemented workstream:

- Suppression/compliance gates and operating rules.
- Campaign state guard that prevents any campaign from moving beyond `draft` unless suppression and compliance approvals are both present.
- Suppression reason taxonomy covering global unsubscribe, brand unsubscribe, SMS STOP, complaints, bounces, legal suppression, and manual suppression.

No mass-sending function is implemented in this repository.

## Commands

```bash
npm test
```

## Compliance invariant

A campaign may remain in `draft` with incomplete checks, but any transition to `review`, `approved`, `scheduled`, `active`, or `sent` must pass:

1. suppression approval state is `approved`
2. compliance approval state is `approved`
3. all required suppression categories have been evaluated
4. no blocking suppression/compliance findings remain
5. approver identity and timestamp are present for both approval tracks

See `docs/compliance-operating-rules.md` and `src/compliance/gates.js`.
