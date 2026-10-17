# Foundation security baseline

- Validate all external input with strict schemas.
- Generate request IDs, trace IDs, and timestamps on the server.
- Keep inference credentials and provider configuration server-only.
- Redact provider errors and never expose raw exceptions.
- Do not silently replace absent financial values with zero.
- Do not use floating-point arithmetic for money.
- Mark synthetic fixtures and mock provenance explicitly.
- Require explicit `disabled` inference mode for the G2 production shell and refuse mock mode in production.
- Run secret and dependency checks before merge.

## Dependency audit scope

`pnpm security:deps` is an enforceable production-dependency audit. The full
development tree currently reports `GHSA-vfj7-8cjw-p6xm` through
`eslint-config-next > fast-glob > micromatch > braces`. The advisory has no
patched `braces` release as of October 15, 2026 and affects a local linting
toolchain, not the deployed application. Re-evaluate it on dependency updates;
do not suppress production advisories.
