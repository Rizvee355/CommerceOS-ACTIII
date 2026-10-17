# Security policy

## Reporting

Do not open a public issue for suspected credential exposure or exploitable vulnerabilities. Contact the repository owner privately through the authenticated project channel.

## Secrets

- Never commit API keys, cookies, authorization headers, account identifiers, or raw provider responses.
- Keep inference variables server-only. Never prefix them with `NEXT_PUBLIC_`.
- Load credentials only through an approved local or deployment secret store, and clear temporary shell values after verification.
- Rotate a credential immediately if it appears in Git history, logs, screenshots, CI output, or chat.

## Provider safety

- Mock inference is deterministic, synthetic, and never identified as AMD.
- Production refuses mock inference by default.
- Live AMD inference remains disabled until authenticated proof and adapter approval.
- Provider failures return sanitized normalized errors; no silent fallback is allowed.

## Public-release gate

The published release must pass the full quality suite, complete-history secret scan, dependency audit, identity review, and asset-license review before source or deployment updates are promoted.
