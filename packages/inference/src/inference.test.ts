import { promiseGuardAiMitigationOutputSchema } from "@commerceos/contracts";
import { z } from "zod";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createInferenceProvider,
  DeterministicMockProvider,
  initializeInferenceFromEnvironment,
  InferenceProviderError,
} from "./index";

const outputSchema = z.strictObject({
  fixture: z.literal("synthetic-foundation-output"),
});

const request = {
  requestId: "52dd0dc8-dcd2-4131-85ec-c14a9af75e88",
  traceId: "90c3d1ef-97ee-454d-92ce-5e16609ae170",
  scenario: { scenarioId: "success", synthetic: true as const },
  input: { purpose: "foundation-contract-test" },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("DeterministicMockProvider", () => {
  it("returns repeatable validated synthetic output and honest provenance", async () => {
    const provider = new DeterministicMockProvider();

    const first = await provider.generateStructured(request, outputSchema);
    const second = await provider.generateStructured(request, outputSchema);

    expect(first).toEqual(second);
    expect(first.output).toEqual({ fixture: "synthetic-foundation-output" });
    expect(first.metadata).toMatchObject({
      providerId: "deterministic-mock",
      modelId: "fixture-v1",
      provenance: "synthetic_mock",
      status: "available",
    });
  });

  it.each([
    ["timeout", "TIMEOUT", true],
    ["rate-limited", "RATE_LIMITED", true],
    ["unavailable", "PROVIDER_UNAVAILABLE", true],
    ["malformed-output", "MALFORMED_OUTPUT", false],
  ])(
    "normalizes the %s scenario",
    async (scenarioId, expectedCode, retryable) => {
      const provider = new DeterministicMockProvider();
      const promise = provider.generateStructured(
        { ...request, scenario: { scenarioId, synthetic: true } },
        outputSchema,
      );

      await expect(promise).rejects.toMatchObject({
        code: expectedCode,
        retryable,
      });
    },
  );

  it("refuses a scenario that is not visibly synthetic", async () => {
    const provider = new DeterministicMockProvider();
    await expect(
      provider.generateStructured(
        { ...request, scenario: { scenarioId: "success", synthetic: false } },
        outputSchema,
      ),
    ).rejects.toMatchObject({ code: "INVALID_MOCK_SCENARIO" });
  });

  it("returns a PromiseGuard mitigation fixture without any network request", async () => {
    const network = vi.fn(() => {
      throw new Error("The deterministic mock must not use the network.");
    });
    vi.stubGlobal("fetch", network);
    const provider = new DeterministicMockProvider();

    const result = await provider.generateStructured(
      {
        ...request,
        scenario: { scenarioId: "pg-at-risk", synthetic: true },
        input: {
          assessment: "at_risk",
          findingCodes: [
            "ACTIVE_BLOCKER_REPORTED",
            "DISPATCH_DEADLINE_OPEN",
            "FULFILLMENT_BLOCKED",
            "INVENTORY_NOT_SECURED",
            "READY_ESTIMATE_AFTER_DEADLINE",
          ],
        },
      },
      promiseGuardAiMitigationOutputSchema,
    );

    expect(result.output.data.actions[0]?.actionCode).toBe(
      "resolve_identified_blocker",
    );
    expect(result.metadata.provenance).toBe("synthetic_mock");
    expect(network).not.toHaveBeenCalled();
  });
});

describe("runtime provider configuration", () => {
  it("accepts explicit disabled mode in production", () => {
    expect(
      initializeInferenceFromEnvironment({
        INFERENCE_PROVIDER: "disabled",
        NODE_ENV: "production",
      }),
    ).toBeNull();
  });

  it.each(["development", "test"] as const)(
    "accepts explicit mock mode in %s",
    (environment) => {
      expect(
        initializeInferenceFromEnvironment({
          INFERENCE_PROVIDER: "mock",
          NODE_ENV: environment,
        }),
      ).toBeInstanceOf(DeterministicMockProvider);
    },
  );

  it("rejects explicit mock mode in production", () => {
    expect(() =>
      initializeInferenceFromEnvironment({
        INFERENCE_PROVIDER: "mock",
        NODE_ENV: "production",
      }),
    ).toThrowError(
      expect.objectContaining({ code: "MOCK_FORBIDDEN_IN_PRODUCTION" }),
    );
  });

  it("rejects unactivated AMD without falling back to mock", () => {
    expect(() =>
      initializeInferenceFromEnvironment({
        INFERENCE_PROVIDER: "amd-token-factory",
        NODE_ENV: "development",
      }),
    ).toThrowError(
      expect.objectContaining({ code: "LIVE_PROVIDER_NOT_ACTIVATED" }),
    );
  });

  it.each([undefined, "unexpected-provider"])(
    "rejects invalid provider configuration %s",
    (provider) => {
      expect(() =>
        initializeInferenceFromEnvironment({
          INFERENCE_PROVIDER: provider,
          NODE_ENV: "development",
        }),
      ).toThrowError(
        expect.objectContaining({ code: "INVALID_PROVIDER_CONFIGURATION" }),
      );
    },
  );

  it("keeps the typed factory fail-closed for production mock", () => {
    expect(() =>
      createInferenceProvider({ provider: "mock", environment: "production" }),
    ).toThrowError(
      expect.objectContaining({ code: "MOCK_FORBIDDEN_IN_PRODUCTION" }),
    );
  });

  it("exposes only sanitized normalized provider errors", () => {
    const error = new InferenceProviderError(
      "PROVIDER_UNAVAILABLE",
      "Inference is temporarily unavailable.",
      true,
    );

    expect(error.toJSON()).toEqual({
      code: "PROVIDER_UNAVAILABLE",
      message: "Inference is temporarily unavailable.",
      retryable: true,
    });
    expect(error.toJSON()).not.toHaveProperty("stack");
  });
});
