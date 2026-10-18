import {
  promiseGuardAiMitigationOutputSchema,
  promiseGuardEvaluationResponseSchema,
  type PromiseGuardAiMitigationOutput,
} from "@commerceos/contracts";
import {
  DeterministicMockProvider,
  type InferenceProvider,
  type InferenceRequest,
  type InferenceResult,
} from "@commerceos/inference";
import type { ZodType } from "zod";
import { describe, expect, it } from "vitest";

import { evaluatePromiseGuard } from "../domain/evaluate";
import { createPromiseGuardPreset } from "../domain/presets";
import { analyzePromiseGuard } from "./analyze";

const receivedAt = new Date("2026-10-15T09:00:00.000Z");

const dependencies = (provider: InferenceProvider | null) => ({
  inferenceProvider: provider,
  now: () => new Date(receivedAt),
  randomUUID: (() => {
    const ids = [
      "52dd0dc8-dcd2-4131-85ec-c14a9af75e88",
      "90c3d1ef-97ee-454d-92ce-5e16609ae170",
    ];
    return () => ids.shift() ?? "be558114-c9ee-4aac-a1c9-6e4f0a35623b";
  })(),
});

describe("PromiseGuard analysis orchestration", () => {
  it("preserves a deterministic assessment when inference is disabled", async () => {
    const request = createPromiseGuardPreset("supported", receivedAt);
    const response = await analyzePromiseGuard(request, dependencies(null));

    expect(response).toMatchObject({
      analysisStatus: "limited",
      deterministic: { data: { assessment: "supported" } },
      inference: { status: "unavailable", reasonCode: "configuration" },
      humanReview: { required: false },
    });
    expect(response).not.toHaveProperty("aiRecommendation");
    expect(
      promiseGuardEvaluationResponseSchema.safeParse(response).success,
    ).toBe(true);
  });

  it("adds validated prioritized mitigations without changing the assessment", async () => {
    const request = createPromiseGuardPreset("at_risk", receivedAt);
    const deterministic = evaluatePromiseGuard(request, receivedAt);
    const response = await analyzePromiseGuard(
      request,
      dependencies(new DeterministicMockProvider()),
    );

    expect(response.analysisStatus).toBe("needs_review");
    expect(response.deterministic).toEqual(deterministic.deterministic);
    expect(response.inference).toMatchObject({
      status: "available",
      providerId: "deterministic-mock",
      provenance: "synthetic_mock",
    });
    expect(
      response.aiRecommendation?.data.actions.map(
        ({ actionCode }) => actionCode,
      ),
    ).toEqual([
      "resolve_identified_blocker",
      "verify_inventory_allocation",
      "reassess_customer_facing_commitment",
      "escalate_to_fulfillment_lead",
    ]);
  });

  it("limits live advisory input to deterministic action and evidence candidates", async () => {
    let capturedInput: Readonly<Record<string, unknown>> | undefined;
    class CapturingProvider extends DeterministicMockProvider {
      override async generateStructured<T>(
        request: InferenceRequest,
        outputSchema: ZodType<T>,
      ): Promise<InferenceResult<T>> {
        capturedInput = request.input;
        return super.generateStructured(request, outputSchema);
      }
    }

    await analyzePromiseGuard(
      createPromiseGuardPreset("at_risk", receivedAt),
      dependencies(new CapturingProvider()),
    );

    expect(capturedInput).toMatchObject({
      assessment: "at_risk",
      allowedActions: expect.arrayContaining([
        {
          actionCode: "resolve_identified_blocker",
          evidenceIds: ["ev-blocker-002", "ev-fulfillment-002"],
        },
        {
          actionCode: "verify_inventory_allocation",
          evidenceIds: ["ev-inventory-002"],
        },
        {
          actionCode: "obtain_current_readiness_estimate",
          evidenceIds: ["ev-fulfillment-002", "ev-estimate-002"],
        },
      ]),
    });
  });

  it("assigns respondedAt after inference finishes", async () => {
    let providerFinished = false;
    class CompletionAwareProvider extends DeterministicMockProvider {
      override async generateStructured<T>(
        request: InferenceRequest,
        outputSchema: ZodType<T>,
      ): Promise<InferenceResult<T>> {
        const result = await super.generateStructured(request, outputSchema);
        providerFinished = true;
        return result;
      }
    }

    const response = await analyzePromiseGuard(
      createPromiseGuardPreset("supported", receivedAt),
      {
        inferenceProvider: new CompletionAwareProvider(),
        now: () =>
          new Date(
            providerFinished
              ? "2026-10-15T09:00:01.000Z"
              : "2026-10-15T09:00:00.000Z",
          ),
        randomUUID: dependencies(null).randomUUID,
      },
    );

    expect(response.metadata.respondedAt).toBe("2026-10-15T09:00:01.000Z");
  });

  it.each([
    ["timeout", "timeout"],
    ["unavailable", "provider_unavailable"],
    ["pg-malformed-ai", "malformed_output"],
  ] as const)(
    "normalizes %s inference failure without falling back or losing deterministic output",
    async (scenarioId, reasonCode) => {
      const request = createPromiseGuardPreset("supported", receivedAt);
      request.scenario.scenarioId = scenarioId;
      const response = await analyzePromiseGuard(
        request,
        dependencies(new DeterministicMockProvider()),
      );

      expect(response.analysisStatus).toBe("limited");
      expect(response.deterministic.data.assessment).toBe("supported");
      expect(response.inference).toMatchObject({
        status: "unavailable",
        reasonCode,
      });
      expect(response).not.toHaveProperty("aiRecommendation");
    },
  );

  it("rejects a schema-valid mitigation that is incompatible with deterministic findings", async () => {
    class IncompatibleProvider implements InferenceProvider {
      readonly providerId = "test-incompatible";

      async generateStructured<T>(
        _request: InferenceRequest,
        outputSchema: ZodType<T>,
      ): Promise<InferenceResult<T>> {
        const output: PromiseGuardAiMitigationOutput = {
          data: {
            operationalSummary: "Resolve a blocker that does not exist.",
            actions: [
              {
                actionCode: "resolve_identified_blocker",
                priority: 1,
                explanation: "Resolve the blocker.",
                evidenceIds: ["ev-blocker-001"],
              },
            ],
          },
          reasoningSummary:
            "This recommendation is intentionally incompatible.",
          evidenceRefs: ["ev-blocker-001"],
        };
        return {
          output: outputSchema.parse(output),
          metadata: {
            status: "available",
            providerId: this.providerId,
            modelId: "test-model",
            adapterVersion: "1.0.0",
            generatedAt: receivedAt.toISOString(),
            durationMs: 0,
            provenance: "live",
          },
        };
      }
    }

    const request = createPromiseGuardPreset("supported", receivedAt);
    const response = await analyzePromiseGuard(
      request,
      dependencies(new IncompatibleProvider()),
    );

    expect(response.analysisStatus).toBe("limited");
    expect(response.inference).toMatchObject({
      status: "unavailable",
      reasonCode: "malformed_output",
    });
    expect(response).not.toHaveProperty("aiRecommendation");
  });

  it("fails closed when a registered mock scenario no longer matches edited facts", async () => {
    const request = createPromiseGuardPreset("supported", receivedAt);
    request.operationalEvidence.inventoryAllocation.status = "not_secured";

    const response = await analyzePromiseGuard(
      request,
      dependencies(new DeterministicMockProvider()),
    );

    expect(response.deterministic.data.assessment).toBe("at_risk");
    expect(response.analysisStatus).toBe("limited");
    expect(response.inference).toMatchObject({
      status: "unavailable",
      reasonCode: "malformed_output",
    });
    expect(response).not.toHaveProperty("aiRecommendation");
  });

  it("fails closed when edited facts retain the fixture assessment but change its factual basis", async () => {
    const request = createPromiseGuardPreset("supported", receivedAt);
    request.operationalEvidence.fulfillmentState.state = "ready";

    const response = await analyzePromiseGuard(
      request,
      dependencies(new DeterministicMockProvider()),
    );

    expect(response.deterministic.data.assessment).toBe("supported");
    expect(response.analysisStatus).toBe("limited");
    expect(response.inference).toMatchObject({
      status: "unavailable",
      reasonCode: "malformed_output",
    });
    expect(response).not.toHaveProperty("aiRecommendation");
  });

  it("normalizes response-level AI evidence validation instead of escaping", async () => {
    const request = createPromiseGuardPreset("supported", receivedAt);
    request.operationalEvidence.inventoryAllocation.evidenceId =
      "ev-inventory-renamed";

    const response = await analyzePromiseGuard(
      request,
      dependencies(new DeterministicMockProvider()),
    );

    expect(response.analysisStatus).toBe("limited");
    expect(response.inference).toMatchObject({
      status: "unavailable",
      reasonCode: "malformed_output",
    });
    expect(response).not.toHaveProperty("aiRecommendation");
  });

  it("rejects action evidence that exists but is unrelated to that mitigation", async () => {
    class MisattributedEvidenceProvider implements InferenceProvider {
      readonly providerId = "test-misattributed-evidence";

      async generateStructured<T>(
        _request: InferenceRequest,
        outputSchema: ZodType<T>,
      ): Promise<InferenceResult<T>> {
        return {
          output: outputSchema.parse({
            data: {
              operationalSummary: "A blocker requires resolution.",
              actions: [
                {
                  actionCode: "resolve_identified_blocker",
                  priority: 1,
                  explanation: "Resolve the current blocker.",
                  evidenceIds: ["ev-inventory-002"],
                },
              ],
            },
            reasoningSummary: "The blocker finding requires action.",
            evidenceRefs: ["ev-inventory-002"],
          }),
          metadata: {
            status: "available",
            providerId: this.providerId,
            modelId: "test-model",
            adapterVersion: "1.0.0",
            generatedAt: receivedAt.toISOString(),
            durationMs: 0,
            provenance: "live",
          },
        };
      }
    }

    const response = await analyzePromiseGuard(
      createPromiseGuardPreset("at_risk", receivedAt),
      dependencies(new MisattributedEvidenceProvider()),
    );

    expect(response.analysisStatus).toBe("limited");
    expect(response.inference).toMatchObject({
      status: "unavailable",
      reasonCode: "malformed_output",
    });
    expect(response).not.toHaveProperty("aiRecommendation");
  });

  it("uses the exact approved AI output contract", () => {
    expect(
      promiseGuardAiMitigationOutputSchema.safeParse({
        data: {
          operationalSummary: "Unsupported action.",
          actions: [
            {
              actionCode: "guarantee_dispatch",
              priority: 1,
              explanation: "Do not allow this.",
              evidenceIds: ["ev-commitment-001"],
            },
          ],
        },
        reasoningSummary: "Invalid fixture.",
        evidenceRefs: ["ev-commitment-001"],
      }).success,
    ).toBe(false);
  });
});
