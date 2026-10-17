# Shared contracts

This package contains the approved CommerceOS v1 foundation contracts, the synthetic-only PromiseGuard G3B contracts, and the additive MarginLeak G4B contract candidate. Zod schemas under `src/v1/` are canonical; OpenAPI 3.1 and JSON Schema files under `generated/` are generated artifacts.

Deterministic product rules and all live-provider protocols remain outside this package. Contract schemas validate inputs and response invariants; application feature boundaries perform the evaluations.

```powershell
pnpm --filter @commerceos/contracts generate
pnpm --filter @commerceos/contracts generate:check
pnpm --filter @commerceos/contracts test
```
