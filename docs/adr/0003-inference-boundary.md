# ADR 0003: Replaceable server-only inference boundary

- Status: Accepted by G1
- Date: 2026-10-15

## Decision

Application code depends on an internal `InferenceProvider` interface. G2 supplies a deterministic fixture provider and reserves, but does not speculate about, an AMD Token Factory adapter.

Provider selection is explicit. Live-to-mock fallback is forbidden. Production refuses mock mode unless a later Control Room decision authorizes a public demo mode.

The supported runtime states are `disabled`, `mock`, and
`amd-token-factory`. Production may run the foundation shell only with
inference explicitly `disabled`; `mock` is limited to development and test.
The Next.js server startup hook validates runtime configuration, while the
production build does not evaluate runtime-only provider selection.

Endpoint, model, headers, authentication, versioning, and payload format remain unresolved until account-issued AMD documentation and authenticated proof are available.

## Mission 018 amendment — 2026-10-18

The organizer-issued Token Factory guide and credential resolved the live-provider boundary. Authenticated proof succeeded against `https://developer.amd.com.cn/radeon/api/v1` using bearer authentication and the catalog-advertised `DeepSeek-V4-Flash` model. CommerceOS now has a server-only `amd-token-factory` adapter for PromiseGuard advisory explanations.

The deterministic evaluator still owns the assessment, findings, and human-review policy. The model receives only validated synthetic findings and pre-authorized action/evidence candidates; its structured response is schema-validated and reconciled before use. There is no live-to-mock fallback.

Public production activation remains denied. `NODE_ENV=production` with `INFERENCE_PROVIDER=amd-token-factory` fails startup until a separate access-control and deployment decision is approved. The public Vercel deployment therefore continues to use `INFERENCE_PROVIDER=disabled`.
