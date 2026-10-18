# AMD ACT III Token Factory verification protocol

1. Team registration is complete per participant confirmation; confirm Token Factory team assignment in the official account dashboard.
2. Obtain the account-issued ACT III Token Factory API key through the organizer-approved channel.
3. Read the **account-issued** endpoint, API version, model identifier and request format from the official dashboard/manual. Do not substitute Radeon Cloud endpoints or guess URLs.
4. Set `AMD_TOKEN_FACTORY_API_KEY` privately through an approved local secret-management method. Never commit it, place it in a tracked file, or expose it to browser code.
5. Send a minimal authenticated inference request with a unique verification prompt.
6. Preserve **redacted** evidence: timestamp, sanitized endpoint host/path, model identifier, HTTP status, request ID if supplied, generated-content snippet, redacted response metadata.
7. Redact API key, Authorization header, cookies, account IDs and sensitive URLs before storing evidence.
8. Mark authenticated inference G0 PASS only when an authorized request succeeds and yields actual model-generated content.

## Verified evidence

Current status (2026-10-18): **G0 PASS for controlled synthetic development use.**

- Authenticated catalog: `GET https://developer.amd.com.cn/radeon/api/v1/models` returned HTTP `200` with 16 models.
- Standalone inference: `POST https://developer.amd.com.cn/radeon/api/v1/chat/completions` returned HTTP `200`.
- Requested model: `DeepSeek-V4-Flash`; response model: `self-dploy/DeepSeek-V4-Flash`.
- Standalone usage: 18 prompt tokens, 41 completion tokens, 59 total tokens.
- CommerceOS integration proof: the PromiseGuard `at_risk` synthetic preset retained its deterministic `at_risk` assessment and required human review while accepting a schema-valid AMD advisory.
- Actual HTTP proof: loopback `POST /api/v1/promiseguard/analyze` returned HTTP `200` with live `amd-token-factory` provenance.

No API key, authorization header, organizer account identifier, cookie, or raw provider body is retained. Production/public activation remains blocked pending an approved access-control design; the deployed Vercel application continues to run with inference disabled.
