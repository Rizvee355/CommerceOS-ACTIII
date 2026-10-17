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
