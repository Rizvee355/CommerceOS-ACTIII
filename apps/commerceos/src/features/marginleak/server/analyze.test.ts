import {
  marginLeakEvaluationRequestSchema,
  marginLeakEvaluationResponseSchema,
  type MarginLeakEvaluationRequest,
} from "@commerceos/contracts";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { analyzeMarginLeak } from "./analyze";

const fixture = (): MarginLeakEvaluationRequest =>
  marginLeakEvaluationRequestSchema.parse(
    JSON.parse(
      readFileSync(
        fileURLToPath(
          new URL(
            "../../../../../../packages/contracts/fixtures/v1/marginleak/valid/no-leak-request.json",
            import.meta.url,
          ),
        ),
        "utf8",
      ),
    ),
  );

const dependencies = () => {
  const dates = [
    new Date("2026-10-17T00:02:00.000Z"),
    new Date("2026-10-17T00:02:00.010Z"),
  ];
  const ids = [
    "52dd0dc8-dcd2-4131-85ec-c14a9af75e88",
    "90c3d1ef-97ee-454d-92ce-5e16609ae170",
  ];
  return {
    now: () => dates.shift() ?? new Date("2026-10-17T00:02:00.010Z"),
    randomUUID: () => ids.shift() ?? "be558114-c9ee-4aac-a1c9-6e4f0a35623b",
  };
};

describe("MarginLeak analysis orchestration", () => {
  it("returns a canonical final no-leak response with request-scoped metadata", () => {
    const response = analyzeMarginLeak(fixture(), dependencies());

    expect(response).toMatchObject({
      schemaVersion: "1.0",
      moduleId: "marginleak",
      analysisStatus: "complete",
      metadata: {
        requestId: "52dd0dc8-dcd2-4131-85ec-c14a9af75e88",
        traceId: "90c3d1ef-97ee-454d-92ce-5e16609ae170",
        receivedAt: "2026-10-17T00:02:00.000Z",
        respondedAt: "2026-10-17T00:02:00.010Z",
      },
      deterministic: {
        data: {
          assessment: "no_leak_detected",
          evidenceCompleteness: "complete",
          totals: {
            expectedContributionMargin: {
              amountMinor: 4_900,
              currency: "USD",
            },
            observedContributionMargin: {
              amountMinor: 5_200,
              currency: "USD",
            },
            netContributionVariance: {
              amountMinor: -300,
              currency: "USD",
            },
            leakAmount: { amountMinor: 0, currency: "USD" },
          },
        },
      },
      humanReview: { required: false, reasonCodes: [] },
    });
    expect(response).not.toHaveProperty("inference");
    expect(response).not.toHaveProperty("aiRecommendation");
    expect(marginLeakEvaluationResponseSchema.safeParse(response).success).toBe(
      true,
    );
  });

  it("confirms adverse final variance without treating negative margin as the trigger", () => {
    const request = fixture();
    request.financials.grossItemRevenue!.observed!.amountMinor = 9_000;

    const response = analyzeMarginLeak(request, dependencies());

    expect(response).toMatchObject({
      analysisStatus: "needs_review",
      deterministic: {
        data: {
          assessment: "leak_detected",
          totals: {
            expectedContributionMargin: {
              amountMinor: 4_900,
              currency: "USD",
            },
            observedContributionMargin: {
              amountMinor: 4_300,
              currency: "USD",
            },
            netContributionVariance: {
              amountMinor: 600,
              currency: "USD",
            },
            leakAmount: { amountMinor: 600, currency: "USD" },
          },
        },
      },
      humanReview: {
        required: true,
        reasonCodes: ["MARGINLEAK_LEAK_DETECTED"],
      },
    });
  });

  it("keeps every aggregate total null when financial evidence is incomplete", () => {
    const request = fixture();
    delete request.financials.cogs!.observed;

    const response = analyzeMarginLeak(request, dependencies());

    expect(response).toMatchObject({
      analysisStatus: "needs_review",
      deterministic: {
        data: {
          assessment: "indeterminate",
          evidenceCompleteness: "incomplete",
          totals: {
            expectedContributionMargin: null,
            observedContributionMargin: null,
            netContributionVariance: null,
            leakAmount: null,
          },
          missingEvidencePaths: ["/financials/cogs/observed"],
        },
      },
      humanReview: {
        required: true,
        reasonCodes: ["MARGINLEAK_EVIDENCE_INCOMPLETE"],
      },
    });
  });

  it("retains provisional margins and signed variance without confirmed leakage", () => {
    const request = fixture();
    request.observationState = "provisional";

    const response = analyzeMarginLeak(request, dependencies());

    expect(response).toMatchObject({
      analysisStatus: "needs_review",
      deterministic: {
        data: {
          assessment: "indeterminate",
          evidenceCompleteness: "complete",
          observationState: "provisional",
          totals: {
            expectedContributionMargin: {
              amountMinor: 4_900,
              currency: "USD",
            },
            observedContributionMargin: {
              amountMinor: 5_200,
              currency: "USD",
            },
            netContributionVariance: {
              amountMinor: -300,
              currency: "USD",
            },
            leakAmount: null,
          },
        },
      },
      humanReview: {
        required: true,
        reasonCodes: ["MARGINLEAK_PROVISIONAL_INPUTS"],
      },
    });
  });

  it("references every supplied observation and never invents missing evidence", () => {
    const request = fixture();
    const missingEvidenceId = request.financials.cogs!.observed!.evidenceId;
    delete request.financials.cogs!.observed;

    const response = analyzeMarginLeak(request, dependencies());
    const evidenceRefs = response.deterministic.evidenceRefs;

    expect(evidenceRefs).toHaveLength(15);
    expect(evidenceRefs).toContainEqual({
      evidenceId: "nl-cogs-expected",
      factPath: "/financials/cogs/expected",
      sourceKind: "synthetic_fixture",
    });
    expect(evidenceRefs.map(({ evidenceId }) => evidenceId)).not.toContain(
      missingEvidenceId,
    );
  });
});
