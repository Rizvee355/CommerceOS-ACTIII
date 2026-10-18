import { promiseGuardAiMitigationOutputSchema } from "@commerceos/contracts";
import { z } from "zod";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AmdTokenFactoryProvider,
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

const syntheticAmdKey = ["rc", "A".repeat(48)].join("-");

const amdRequest = {
  ...request,
  scenario: { scenarioId: "pg-at-risk", synthetic: true as const },
  input: {
    assessment: "at_risk",
    findingCodes: ["ACTIVE_BLOCKER_REPORTED"],
    findings: [
      {
        code: "ACTIVE_BLOCKER_REPORTED",
        impact: "adverse",
        trace: {
          kind: "evidence",
          evidenceIds: ["ev-blocker-002"],
        },
      },
    ],
    allowedActions: [
      {
        actionCode: "resolve_identified_blocker",
        evidenceIds: ["ev-blocker-002"],
      },
    ],
  },
};

const amdOutput = {
  data: {
    operationalSummary:
      "An active fulfillment blocker requires prompt operational review.",
    actions: [
      {
        actionCode: "resolve_identified_blocker",
        priority: 1,
        explanation: "Resolve the identified blocker before dispatch.",
        evidenceIds: ["ev-blocker-002"],
      },
    ],
  },
  reasoningSummary: "The deterministic evaluation reports an active blocker.",
  evidenceRefs: ["ev-blocker-002"],
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
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

describe("AmdTokenFactoryProvider", () => {
  it("sends sanitized synthetic evidence only to the documented AMD endpoint", async () => {
    const network = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        expect(String(input)).toBe(
          "https://developer.amd.com.cn/radeon/api/v1/chat/completions",
        );
        expect(init?.method).toBe("POST");
        expect(new Headers(init?.headers).get("authorization")).toBe(
          `Bearer ${syntheticAmdKey}`,
        );
        const body = JSON.parse(String(init?.body)) as {
          messages: { role: string; content: string }[];
          model: string;
          stream: boolean;
        };
        expect(body.model).toBe("DeepSeek-V4-Flash");
        expect(body.stream).toBe(false);
        expect(body.messages).toHaveLength(2);
        expect(body.messages[1]?.content).toContain("ACTIVE_BLOCKER_REPORTED");
        expect(body.messages[1]?.content).not.toContain(request.requestId);
        expect(body.messages[1]?.content).not.toContain(request.traceId);

        return Response.json({
          id: "amd-response-001",
          model: "self-dploy/DeepSeek-V4-Flash",
          choices: [
            {
              finish_reason: "stop",
              message: {
                role: "assistant",
                content: JSON.stringify(amdOutput),
              },
            },
          ],
          usage: { prompt_tokens: 50, completion_tokens: 40, total_tokens: 90 },
        });
      },
    );
    const provider = new AmdTokenFactoryProvider({
      apiKey: syntheticAmdKey,
      fetch: network,
      now: () => new Date("2026-10-18T09:57:21.000Z"),
      monotonicNow: () => 100,
    });

    const result = await provider.generateStructured(
      amdRequest,
      promiseGuardAiMitigationOutputSchema,
    );

    expect(result.output).toEqual(amdOutput);
    expect(result.metadata).toEqual({
      status: "available",
      providerId: "amd-token-factory",
      modelId: "self-dploy/DeepSeek-V4-Flash",
      adapterVersion: "1.0.0",
      generatedAt: "2026-10-18T09:57:21.000Z",
      durationMs: 0,
      provenance: "live",
    });
    expect(network).toHaveBeenCalledTimes(1);
  });

  it("rejects non-synthetic scenarios before any network request", async () => {
    const network = vi.fn();
    const provider = new AmdTokenFactoryProvider({
      apiKey: syntheticAmdKey,
      fetch: network,
    });

    await expect(
      provider.generateStructured(
        {
          ...amdRequest,
          scenario: { scenarioId: "real-order", synthetic: false },
        },
        promiseGuardAiMitigationOutputSchema,
      ),
    ).rejects.toMatchObject({
      code: "INVALID_PROVIDER_CONFIGURATION",
      retryable: false,
    });
    expect(network).not.toHaveBeenCalled();
  });

  it("does not spend provider quota for a request already cancelled by the caller", async () => {
    const network = vi.fn();
    const provider = new AmdTokenFactoryProvider({
      apiKey: syntheticAmdKey,
      fetch: network,
    });
    const controller = new AbortController();
    controller.abort();

    await expect(
      provider.generateStructured(
        amdRequest,
        promiseGuardAiMitigationOutputSchema,
        controller.signal,
      ),
    ).rejects.toMatchObject({ code: "TIMEOUT", retryable: true });
    expect(network).not.toHaveBeenCalled();
  });

  it("normalizes rate limits without leaking credentials or provider bodies", async () => {
    const provider = new AmdTokenFactoryProvider({
      apiKey: syntheticAmdKey,
      fetch: async () =>
        new Response(`upstream diagnostic ${syntheticAmdKey}`, {
          status: 429,
          headers: { "retry-after": "4" },
        }),
    });

    const operation = provider.generateStructured(
      amdRequest,
      promiseGuardAiMitigationOutputSchema,
    );

    await expect(operation).rejects.toMatchObject({
      code: "RATE_LIMITED",
      message: "AMD Token Factory rate limit was reached.",
      retryable: true,
    });
    await expect(operation).rejects.not.toThrow(syntheticAmdKey);
    await expect(operation).rejects.not.toThrow("upstream diagnostic");
  });

  it.each([400, 401, 403])(
    "treats HTTP %s as non-retryable provider configuration without leaking details",
    async (status) => {
      const provider = new AmdTokenFactoryProvider({
        apiKey: syntheticAmdKey,
        fetch: async () =>
          new Response(`credential rejected ${syntheticAmdKey}`, { status }),
      });

      const operation = provider.generateStructured(
        amdRequest,
        promiseGuardAiMitigationOutputSchema,
      );

      await expect(operation).rejects.toMatchObject({
        code: "INVALID_PROVIDER_CONFIGURATION",
        message: "AMD Token Factory rejected the provider configuration.",
        retryable: false,
      });
      await expect(operation).rejects.not.toThrow(syntheticAmdKey);
      await expect(operation).rejects.not.toThrow("credential rejected");
    },
  );

  it("fails closed when the model returns malformed structured output", async () => {
    const provider = new AmdTokenFactoryProvider({
      apiKey: syntheticAmdKey,
      fetch: async () =>
        Response.json({
          id: "amd-response-002",
          model: "self-dploy/DeepSeek-V4-Flash",
          choices: [
            {
              finish_reason: "stop",
              message: { role: "assistant", content: "not-json" },
            },
          ],
        }),
    });

    await expect(
      provider.generateStructured(
        amdRequest,
        promiseGuardAiMitigationOutputSchema,
      ),
    ).rejects.toMatchObject({
      code: "MALFORMED_OUTPUT",
      retryable: false,
    });
  });

  it("allows the documented model enough time while retaining a bounded timeout", async () => {
    vi.useFakeTimers();
    const provider = new AmdTokenFactoryProvider({
      apiKey: syntheticAmdKey,
      fetch: async (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            "abort",
            () => reject(new DOMException("Aborted", "AbortError")),
            { once: true },
          );
        }),
    });
    let state: "pending" | "resolved" | "rejected" = "pending";
    const operation = provider
      .generateStructured(amdRequest, promiseGuardAiMitigationOutputSchema)
      .then(
        (result) => {
          state = "resolved";
          return result;
        },
        (error: unknown) => {
          state = "rejected";
          throw error;
        },
      );
    const rejection = expect(operation).rejects.toMatchObject({
      code: "TIMEOUT",
      retryable: true,
    });

    await vi.advanceTimersByTimeAsync(20_000);
    expect(state).toBe("pending");
    await vi.advanceTimersByTimeAsync(40_000);
    await rejection;
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

  it("initializes AMD for a controlled local demonstration", () => {
    expect(
      initializeInferenceFromEnvironment({
        AMD_TOKEN_FACTORY_API_KEY: syntheticAmdKey,
        INFERENCE_PROVIDER: "amd-token-factory",
        NODE_ENV: "development",
      }),
    ).toBeInstanceOf(AmdTokenFactoryProvider);
  });

  it("rejects a missing AMD credential without falling back to mock", () => {
    expect(() =>
      initializeInferenceFromEnvironment({
        INFERENCE_PROVIDER: "amd-token-factory",
        NODE_ENV: "development",
      }),
    ).toThrowError(
      expect.objectContaining({ code: "LIVE_PROVIDER_NOT_ACTIVATED" }),
    );
  });

  it("keeps AMD denied in production pending public access control approval", () => {
    expect(() =>
      initializeInferenceFromEnvironment({
        AMD_TOKEN_FACTORY_API_KEY: syntheticAmdKey,
        INFERENCE_PROVIDER: "amd-token-factory",
        NODE_ENV: "production",
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
