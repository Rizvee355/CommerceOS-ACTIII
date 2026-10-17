import { describe, expect, it } from "vitest";

import { createArtifacts } from "./generate-artifacts";

describe("contract artifact generation", () => {
  it("generates OpenAPI 3.1 with the approved analysis routes", () => {
    const artifacts = createArtifacts();
    const openapi = artifacts.get("openapi/openapi.json") as {
      openapi: string;
      paths: Record<string, unknown>;
    };

    expect(openapi.openapi).toBe("3.1.0");
    expect(Object.keys(openapi.paths).sort()).toEqual([
      "/api/v1/capabilities",
      "/api/v1/health",
      "/api/v1/marginleak/analyze",
      "/api/v1/promiseguard/analyze",
    ]);
  });

  it("publishes canonical PromiseGuard request and response schemas", () => {
    const artifacts = createArtifacts();

    expect(
      artifacts.has("json-schema/promiseguard-evaluation-request.schema.json"),
    ).toBe(true);
    expect(
      artifacts.has("json-schema/promiseguard-evaluation-response.schema.json"),
    ).toBe(true);
  });

  it("publishes canonical MarginLeak request and response schemas", () => {
    const artifacts = createArtifacts();

    expect(
      artifacts.has("json-schema/marginleak-evaluation-request.schema.json"),
    ).toBe(true);
    expect(
      artifacts.has("json-schema/marginleak-evaluation-response.schema.json"),
    ).toBe(true);
  });

  it("documents production-denied MarginLeak preview access", () => {
    const artifacts = createArtifacts();
    const openapi = artifacts.get("openapi/openapi.json") as {
      paths: {
        "/api/v1/marginleak/analyze": {
          post: {
            description: string;
            responses: Record<string, unknown>;
          };
        };
      };
    };
    const operation = openapi.paths["/api/v1/marginleak/analyze"].post;

    expect(operation.description).toContain("development and test");
    expect(operation.responses).toHaveProperty("403");
  });

  it("derives integer money and ISO currency constraints from Zod", () => {
    const artifacts = createArtifacts();
    const money = artifacts.get("json-schema/money.schema.json") as {
      properties: {
        amountMinor: { type: string };
        currency: { enum: string[] };
      };
    };

    expect(money.properties.amountMinor.type).toBe("integer");
    expect(money.properties.currency.enum).toContain("USD");
    expect(money.properties.currency.enum).not.toContain("ZZZ");
  });
});
