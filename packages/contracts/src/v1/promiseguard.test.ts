import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  analysisResponseEnvelopeSchema,
  promiseGuardAiMitigationOutputSchema,
  promiseGuardEvaluationRequestSchema,
  promiseGuardEvaluationResponseSchema,
} from "./index";

const fixture = (name: string): unknown =>
  JSON.parse(
    readFileSync(
      fileURLToPath(
        new URL(
          `../../fixtures/v1/promiseguard/valid/${name}.json`,
          import.meta.url,
        ),
      ),
      "utf8",
    ),
  );

const supported = (): Record<string, unknown> =>
  structuredClone(fixture("supported")) as Record<string, unknown>;

describe("PromiseGuard request contract", () => {
  it.each(["supported", "at-risk", "indeterminate"])(
    "accepts the approved synthetic %s fixture",
    (name) => {
      expect(
        promiseGuardEvaluationRequestSchema.safeParse(fixture(name)).success,
      ).toBe(true);
    },
  );

  it("rejects non-synthetic requests", () => {
    const candidate = supported();
    candidate.scenario = { scenarioId: "real-order", synthetic: false };
    expect(
      promiseGuardEvaluationRequestSchema.safeParse(candidate).success,
    ).toBe(false);
  });

  it("rejects unknown and PII-shaped request fields", () => {
    expect(
      promiseGuardEvaluationRequestSchema.safeParse({
        ...supported(),
        customerEmail: "person@example.invalid",
      }).success,
    ).toBe(false);
  });

  it("rejects duplicate evidence identifiers", () => {
    const candidate = supported();
    const evidence = candidate.operationalEvidence as Record<string, unknown>;
    evidence.inventoryAllocation = {
      ...(evidence.inventoryAllocation as object),
      evidenceId: "ev-commitment-001",
    };
    expect(
      promiseGuardEvaluationRequestSchema.safeParse(candidate).success,
    ).toBe(false);
  });

  it("rejects non-UTC timestamps and impossible validity intervals", () => {
    const offset = supported();
    const offsetEvidence = offset.operationalEvidence as Record<
      string,
      unknown
    >;
    offsetEvidence.inventoryAllocation = {
      ...(offsetEvidence.inventoryAllocation as object),
      observedAt: "2026-10-15T14:30:00+06:00",
    };
    expect(promiseGuardEvaluationRequestSchema.safeParse(offset).success).toBe(
      false,
    );

    const impossible = supported();
    const impossibleEvidence = impossible.operationalEvidence as Record<
      string,
      unknown
    >;
    impossibleEvidence.inventoryAllocation = {
      ...(impossibleEvidence.inventoryAllocation as object),
      observedAt: "2026-10-15T10:00:00.000Z",
      validUntil: "2026-10-15T09:59:59.999Z",
    };
    expect(
      promiseGuardEvaluationRequestSchema.safeParse(impossible).success,
    ).toBe(false);
  });

  it("allows blocker codes if and only if the blocker is active", () => {
    const inactiveWithCode = supported();
    const evidence = inactiveWithCode.operationalEvidence as Record<
      string,
      unknown
    >;
    evidence.blockingState = {
      ...(evidence.blockingState as object),
      codes: ["inventory_shortage"],
    };
    expect(
      promiseGuardEvaluationRequestSchema.safeParse(inactiveWithCode).success,
    ).toBe(false);

    const activeWithoutCode = supported();
    const activeEvidence = activeWithoutCode.operationalEvidence as Record<
      string,
      unknown
    >;
    activeEvidence.blockingState = {
      ...(activeEvidence.blockingState as object),
      status: "active",
      codes: [],
    };
    expect(
      promiseGuardEvaluationRequestSchema.safeParse(activeWithoutCode).success,
    ).toBe(false);
  });
});

const supportedResponse = {
  schemaVersion: "1.0",
  moduleId: "promiseguard",
  analysisStatus: "complete",
  metadata: {
    requestId: "52dd0dc8-dcd2-4131-85ec-c14a9af75e88",
    traceId: "90c3d1ef-97ee-454d-92ce-5e16609ae170",
    receivedAt: "2026-10-15T09:00:00.000Z",
    respondedAt: "2026-10-15T09:00:00.010Z",
  },
  scenario: { scenarioId: "pg-supported", synthetic: true },
  deterministic: {
    data: {
      assessment: "supported",
      decisionScope: "dispatch_readiness_not_delivery_guarantee",
      evidenceCompleteness: "complete",
      findings: [
        {
          code: "INVENTORY_SECURED",
          impact: "supporting",
          trace: { kind: "evidence", evidenceIds: ["ev-inventory-001"] },
        },
      ],
      derived: { deadlineState: "open", readyByDeadline: true },
    },
    rulesetVersion: "promiseguard-dispatch-1.0.0",
    evidenceRefs: [
      {
        evidenceId: "ev-inventory-001",
        factPath: "/operationalEvidence/inventoryAllocation",
        sourceKind: "synthetic_fixture",
      },
    ],
  },
  aiRecommendation: {
    data: {
      operationalSummary: "Current evidence supports dispatch readiness.",
      actions: [],
    },
    reasoningSummary: "No mitigation is currently required.",
    evidenceRefs: ["ev-inventory-001"],
  },
  humanReview: {
    required: false,
    reasonCodes: [],
    decidedBy: "deterministic_policy",
    policyVersion: "promiseguard-review-1.0.0",
  },
  inference: {
    status: "available",
    providerId: "deterministic-mock",
    modelId: "fixture-v1",
    adapterVersion: "1.0.0",
    generatedAt: "2026-10-15T09:00:00.005Z",
    durationMs: 0,
    provenance: "synthetic_mock",
  },
} as const;

describe("PromiseGuard response and AI contracts", () => {
  it("is compatible with the approved generic response envelope", () => {
    expect(
      promiseGuardEvaluationResponseSchema.parse(supportedResponse),
    ).toEqual(supportedResponse);
    expect(
      analysisResponseEnvelopeSchema.safeParse(supportedResponse).success,
    ).toBe(true);
  });

  it("rejects AI actions with duplicate or unordered priorities", () => {
    expect(
      promiseGuardAiMitigationOutputSchema.safeParse({
        ...supportedResponse.aiRecommendation,
        data: {
          operationalSummary: "Resolve current issues.",
          actions: [
            {
              actionCode: "verify_inventory_allocation",
              priority: 2,
              explanation: "Verify allocation.",
              evidenceIds: ["ev-inventory-001"],
            },
            {
              actionCode: "escalate_to_fulfillment_lead",
              priority: 1,
              explanation: "Escalate the exception.",
              evidenceIds: ["ev-inventory-001"],
            },
          ],
        },
      }).success,
    ).toBe(false);
  });

  it("rejects nested AI evidence references absent from deterministic evidence", () => {
    const invalid = structuredClone(supportedResponse) as Record<
      string,
      unknown
    >;
    invalid.aiRecommendation = {
      ...supportedResponse.aiRecommendation,
      data: {
        operationalSummary: "Verify the supplied evidence.",
        actions: [
          {
            actionCode: "verify_inventory_allocation",
            priority: 1,
            explanation: "Verify allocation.",
            evidenceIds: ["missing-evidence"],
          },
        ],
      },
      evidenceRefs: ["ev-inventory-001"],
    };
    expect(
      promiseGuardEvaluationResponseSchema.safeParse(invalid).success,
    ).toBe(false);
  });

  it("requires deterministic review metadata to match the business assessment", () => {
    expect(
      promiseGuardEvaluationResponseSchema.safeParse({
        ...supportedResponse,
        deterministic: {
          ...supportedResponse.deterministic,
          data: {
            ...supportedResponse.deterministic.data,
            assessment: "at_risk",
          },
        },
      }).success,
    ).toBe(false);
  });
});
