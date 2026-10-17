# ADR 0002: Zod is the contract authority

- Status: Accepted by G1
- Date: 2026-10-15

## Decision

Zod schemas under `packages/contracts/src/v1` are canonical. TypeScript types are inferred from those schemas. OpenAPI 3.1 and JSON Schema are generated and checked for drift in CI.

The v1 foundation defines generic metadata and envelopes only. Product-specific inputs, evaluation rules, recommendations, and endpoints require later Control Room approval.

## Compatibility

Additive optional output fields may remain in v1. Removing, renaming, changing meaning, or making an optional field required needs a new contract version. External request schemas are strict.
