# Contributing to CommerceOS

## Branches

- `main` is the stable integration branch; never commit directly to it.
- Foundation work uses `codex/*`; PromiseGuard and MarginLeak later use their separately approved agent branches.
- Branch from the latest approved `main` SHA and record that SHA in the pull request.

## Ownership

During G2, Codex owns root configuration, `packages/contracts/`, `packages/inference/`, and application-foundation paths. Product agents must not independently change these shared paths. Propose shared changes through the Control Room and a focused foundation PR.

## Local verification

```powershell
pnpm install --frozen-lockfile
pnpm check
pnpm test:e2e
pnpm security:deps
```

Pull requests must state scope, gate authorization, tests, security impact, contract impact, and confirmation that no product behavior was introduced.
