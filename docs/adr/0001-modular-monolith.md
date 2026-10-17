# ADR 0001: One full-stack modular monolith

- Status: Accepted by G1
- Date: 2026-10-15

## Decision

CommerceOS is one Next.js App Router application under `apps/commerceos`. PromiseGuard and MarginLeak are internal feature modules, not separate applications or services. RescueCart is disabled and has no implementation path in G2.

Shared generic contracts and inference infrastructure live in workspace packages. No database, queue, background worker, OAuth system, or commerce-platform connector is introduced in the foundation.

## Consequences

The architecture minimizes deployment and integration cost for the hackathon. Product modules must consume shared boundaries and cannot independently fork contracts or inference behavior.
