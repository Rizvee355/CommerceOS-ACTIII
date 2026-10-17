import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  analysisResponseEnvelopeSchema,
  marginLeakEvaluationRequestSchema,
  marginLeakEvaluationResponseSchema,
} from "./index";

const categories = [
  "grossItemRevenue",
  "shippingRevenue",
  "discounts",
  "cogs",
  "shippingCost",
  "fulfillmentCost",
  "paymentCost",
  "platformCost",
] as const;

const contributionRole = {
  grossItemRevenue: "revenue",
  shippingRevenue: "revenue",
  discounts: "deduction",
  cogs: "deduction",
  shippingCost: "deduction",
  fulfillmentCost: "deduction",
  paymentCost: "deduction",
  platformCost: "deduction",
} as const;

type TestCategory = (typeof categories)[number];

type TestObservation = {
  amountMinor: number;
  currency: string;
  evidenceId: string;
  source: { kind: string; label: string; recordedAt: string };
};

type TestRequest = {
  schemaVersion: string;
  moduleId: string;
  scenario: { scenarioId: string; synthetic: boolean };
  orderRef: string;
  currency: string;
  observationState: string;
  financials: Record<
    TestCategory,
    { expected?: TestObservation; observed?: TestObservation }
  >;
};

type TestMoney = { amountMinor: number; currency: string };

type TestResponse = {
  schemaVersion: string;
  moduleId: string;
  analysisStatus: string;
  metadata: {
    requestId: string;
    traceId: string;
    receivedAt: string;
    respondedAt: string;
  };
  scenario: { scenarioId: string; synthetic: boolean };
  deterministic: {
    data: {
      assessment: string;
      evidenceCompleteness: string;
      observationState: string;
      orderRef: string;
      currency: string;
      totals: {
        expectedContributionMargin: TestMoney | null;
        observedContributionMargin: TestMoney | null;
        netContributionVariance: TestMoney | null;
        leakAmount: TestMoney | null;
      };
      categoryComparisons: Array<Record<string, unknown>>;
      findings: Array<Record<string, unknown>>;
      missingEvidencePaths: string[];
    };
    rulesetVersion: string;
    evidenceRefs: Array<{
      evidenceId: string;
      factPath: string;
      sourceKind: string;
    }>;
  };
  humanReview: {
    required: boolean;
    reasonCodes: string[];
    decidedBy: string;
    policyVersion: string;
  };
};

const completeRequest = (): TestRequest => ({
  schemaVersion: "1.0",
  moduleId: "marginleak",
  scenario: { scenarioId: "ml-contract-healthy", synthetic: true },
  orderRef: "ORDER-SYN-G4B-001",
  currency: "USD",
  observationState: "final",
  financials: Object.fromEntries(
    categories.map((category) => [
      category,
      {
        expected: {
          amountMinor: 100,
          currency: "USD",
          evidenceId: `ev-${category}-expected`,
          source: {
            kind: "synthetic_fixture",
            label: `Expected ${category}`,
            recordedAt: "2026-10-17T00:00:00.000Z",
          },
        },
        observed: {
          amountMinor: 100,
          currency: "USD",
          evidenceId: `ev-${category}-observed`,
          source: {
            kind: "synthetic_fixture",
            label: `Observed ${category}`,
            recordedAt: "2026-10-17T00:01:00.000Z",
          },
        },
      },
    ]),
  ) as TestRequest["financials"],
});

const completeResponse = (): TestResponse => ({
  schemaVersion: "1.0",
  moduleId: "marginleak",
  analysisStatus: "complete",
  metadata: {
    requestId: "52dd0dc8-dcd2-4131-85ec-c14a9af75e88",
    traceId: "90c3d1ef-97ee-454d-92ce-5e16609ae170",
    receivedAt: "2026-10-17T00:02:00.000Z",
    respondedAt: "2026-10-17T00:02:00.010Z",
  },
  scenario: { scenarioId: "ml-contract-healthy", synthetic: true },
  deterministic: {
    data: {
      assessment: "no_leak_detected",
      evidenceCompleteness: "complete",
      observationState: "final",
      orderRef: "ORDER-SYN-G4B-001",
      currency: "USD",
      totals: {
        expectedContributionMargin: { amountMinor: -400, currency: "USD" },
        observedContributionMargin: { amountMinor: -400, currency: "USD" },
        netContributionVariance: { amountMinor: 0, currency: "USD" },
        leakAmount: { amountMinor: 0, currency: "USD" },
      },
      categoryComparisons: categories.map((category) => ({
        category,
        role: contributionRole[category],
        expected: { amountMinor: 100, currency: "USD" },
        observed: { amountMinor: 100, currency: "USD" },
        direction: "neutral",
        varianceAmount: { amountMinor: 0, currency: "USD" },
        expectedEvidenceId: `ev-${category}-expected`,
        observedEvidenceId: `ev-${category}-observed`,
      })),
      findings: [],
      missingEvidencePaths: [],
    },
    rulesetVersion: "marginleak-contribution-g4a.1",
    evidenceRefs: categories.flatMap((category) => [
      {
        evidenceId: `ev-${category}-expected`,
        factPath: `/financials/${category}/expected`,
        sourceKind: "synthetic_fixture",
      },
      {
        evidenceId: `ev-${category}-observed`,
        factPath: `/financials/${category}/observed`,
        sourceKind: "synthetic_fixture",
      },
    ]),
  },
  humanReview: {
    required: false,
    reasonCodes: [],
    decidedBy: "deterministic_policy",
    policyVersion: "marginleak-review-g4a.1",
  },
});

const fixture = (name: string): unknown =>
  JSON.parse(
    readFileSync(
      fileURLToPath(
        new URL(
          `../../fixtures/v1/marginleak/valid/${name}.json`,
          import.meta.url,
        ),
      ),
      "utf8",
    ),
  );

describe("MarginLeak v1 request contract", () => {
  it("accepts the canonical no-leak fixture", () => {
    expect(
      marginLeakEvaluationRequestSchema.safeParse(fixture("no-leak-request"))
        .success,
    ).toBe(true);
  });

  it("accepts a complete synthetic single-currency request", () => {
    expect(marginLeakEvaluationRequestSchema.parse(completeRequest())).toEqual(
      completeRequest(),
    );
  });

  it("allows omitted observations to remain domain-indeterminate", () => {
    const request = completeRequest();
    request.financials.platformCost = {};

    expect(marginLeakEvaluationRequestSchema.safeParse(request).success).toBe(
      true,
    );
  });

  it("allows complete provisional evidence for deterministic variance", () => {
    const request = completeRequest();
    request.observationState = "provisional";

    expect(marginLeakEvaluationRequestSchema.safeParse(request).success).toBe(
      true,
    );
  });

  it("rejects non-synthetic requests and unknown fields", () => {
    const real = completeRequest();
    real.scenario = { scenarioId: "real-order", synthetic: false };
    expect(marginLeakEvaluationRequestSchema.safeParse(real).success).toBe(
      false,
    );

    expect(
      marginLeakEvaluationRequestSchema.safeParse({
        ...completeRequest(),
        customerEmail: "person@example.invalid",
      }).success,
    ).toBe(false);
  });

  it("rejects version mismatches", () => {
    expect(
      marginLeakEvaluationRequestSchema.safeParse({
        ...completeRequest(),
        schemaVersion: "2.0",
      }).success,
    ).toBe(false);
  });

  it("rejects invalid currencies and currency mismatches", () => {
    const invalidCurrency = completeRequest();
    invalidCurrency.currency = "ZZZ";
    expect(
      marginLeakEvaluationRequestSchema.safeParse(invalidCurrency).success,
    ).toBe(false);

    const mismatch = completeRequest();
    mismatch.financials.paymentCost.observed!.currency = "EUR";
    const parsed = marginLeakEvaluationRequestSchema.safeParse(mismatch);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ["financials", "paymentCost", "observed", "currency"],
          }),
        ]),
      );
    }
  });

  it("rejects duplicate evidence identifiers", () => {
    const request = completeRequest();
    request.financials.cogs.observed!.evidenceId =
      request.financials.grossItemRevenue.expected!.evidenceId;

    expect(marginLeakEvaluationRequestSchema.safeParse(request).success).toBe(
      false,
    );
  });

  it("rejects malformed or non-UTC evidence timestamps", () => {
    const request = completeRequest();
    request.financials.shippingCost.observed!.source.recordedAt =
      "2026-10-17T06:01:00+06:00";

    expect(marginLeakEvaluationRequestSchema.safeParse(request).success).toBe(
      false,
    );
  });

  it.each([-1, 0.5, 562_949_953_421_312])(
    "rejects invalid component amount %s",
    (amountMinor) => {
      const request = completeRequest();
      request.financials.fulfillmentCost.expected!.amountMinor = amountMinor;

      expect(marginLeakEvaluationRequestSchema.safeParse(request).success).toBe(
        false,
      );
    },
  );

  it("accepts the exact safe component boundary", () => {
    const request = completeRequest();
    request.financials.fulfillmentCost.expected!.amountMinor = 562_949_953_421_311;

    expect(marginLeakEvaluationRequestSchema.safeParse(request).success).toBe(
      true,
    );
  });
});

describe("MarginLeak v1 response contract", () => {
  it("accepts a complete final response compatible with the generic envelope", () => {
    const response = completeResponse();

    expect(marginLeakEvaluationResponseSchema.parse(response)).toEqual(
      response,
    );
    expect(analysisResponseEnvelopeSchema.safeParse(response).success).toBe(
      true,
    );
  });

  it("accepts incomplete evidence only with null aggregate totals", () => {
    const response = completeResponse();
    response.analysisStatus = "needs_review";
    response.humanReview = {
      required: true,
      reasonCodes: ["MARGINLEAK_EVIDENCE_INCOMPLETE"],
      decidedBy: "deterministic_policy",
      policyVersion: "marginleak-review-g4a.1",
    };
    const data = response.deterministic.data;
    data.assessment = "indeterminate";
    data.evidenceCompleteness = "incomplete";
    data.totals = {
      expectedContributionMargin: null,
      observedContributionMargin: null,
      netContributionVariance: null,
      leakAmount: null,
    };
    data.categoryComparisons = data.categoryComparisons.filter(
      ({ category }) => category !== "cogs",
    );
    data.findings = [
      {
        code: "MISSING_FINANCIAL_INPUT",
        impact: "uncertain",
        fieldPath: "/financials/cogs/observed",
      },
    ];
    data.missingEvidencePaths = ["/financials/cogs/observed"];
    response.deterministic.evidenceRefs =
      response.deterministic.evidenceRefs.filter(
        ({ factPath }) => factPath !== "/financials/cogs/observed",
      );

    expect(marginLeakEvaluationResponseSchema.safeParse(response).success).toBe(
      true,
    );
  });

  it("accepts provisional margins and variance only when confirmed leak is null", () => {
    const response = completeResponse();
    response.analysisStatus = "needs_review";
    response.humanReview = {
      required: true,
      reasonCodes: ["MARGINLEAK_PROVISIONAL_INPUTS"],
      decidedBy: "deterministic_policy",
      policyVersion: "marginleak-review-g4a.1",
    };
    const data = response.deterministic.data;
    data.assessment = "indeterminate";
    data.observationState = "provisional";
    data.totals = {
      expectedContributionMargin: { amountMinor: -399, currency: "USD" },
      observedContributionMargin: { amountMinor: -400, currency: "USD" },
      netContributionVariance: { amountMinor: 1, currency: "USD" },
      leakAmount: null,
    };
    data.categoryComparisons[0]!.expected = {
      amountMinor: 101,
      currency: "USD",
    };
    data.categoryComparisons[0]!.direction = "adverse";
    data.categoryComparisons[0]!.varianceAmount = {
      amountMinor: 1,
      currency: "USD",
    };
    data.findings = [
      {
        code: "ADVERSE_COMPONENT_VARIANCE",
        impact: "adverse",
        category: "grossItemRevenue",
        amount: { amountMinor: 1, currency: "USD" },
        evidenceIds: [
          "ev-grossItemRevenue-expected",
          "ev-grossItemRevenue-observed",
        ],
      },
      {
        code: "PROVISIONAL_FINANCIAL_INPUTS",
        impact: "uncertain",
        fieldPath: "/observationState",
      },
    ];

    expect(marginLeakEvaluationResponseSchema.safeParse(response).success).toBe(
      true,
    );

    data.totals.leakAmount = { amountMinor: 1, currency: "USD" };
    expect(marginLeakEvaluationResponseSchema.safeParse(response).success).toBe(
      false,
    );
  });

  it("rejects incomplete totals, final leak mismatch, and unknown response fields", () => {
    const incomplete = completeResponse();
    const incompleteData = incomplete.deterministic.data;
    incompleteData.evidenceCompleteness = "incomplete";
    incompleteData.assessment = "indeterminate";
    expect(
      marginLeakEvaluationResponseSchema.safeParse(incomplete).success,
    ).toBe(false);

    const wrongLeak = completeResponse();
    const wrongLeakData = wrongLeak.deterministic.data;
    wrongLeakData.totals.netContributionVariance!.amountMinor = 1;
    wrongLeakData.totals.leakAmount!.amountMinor = 0;
    wrongLeakData.assessment = "leak_detected";
    wrongLeak.analysisStatus = "needs_review";
    wrongLeak.humanReview = {
      required: true,
      reasonCodes: ["MARGINLEAK_LEAK_DETECTED"],
      decidedBy: "deterministic_policy",
      policyVersion: "marginleak-review-g4a.1",
    };
    expect(
      marginLeakEvaluationResponseSchema.safeParse(wrongLeak).success,
    ).toBe(false);

    expect(
      marginLeakEvaluationResponseSchema.safeParse({
        ...completeResponse(),
        auditStored: true,
      }).success,
    ).toBe(false);
  });

  it("rejects assessment, status, and human-review contradictions", () => {
    const wrongAssessment = completeResponse();
    const data = wrongAssessment.deterministic.data;
    data.assessment = "leak_detected";
    expect(
      marginLeakEvaluationResponseSchema.safeParse(wrongAssessment).success,
    ).toBe(false);

    const wrongStatus = completeResponse();
    wrongStatus.analysisStatus = "needs_review";
    expect(
      marginLeakEvaluationResponseSchema.safeParse(wrongStatus).success,
    ).toBe(false);

    const wrongReview = completeResponse();
    wrongReview.humanReview = {
      required: true,
      reasonCodes: [],
      decidedBy: "deterministic_policy",
      policyVersion: "marginleak-review-g4a.1",
    };
    expect(
      marginLeakEvaluationResponseSchema.safeParse(wrongReview).success,
    ).toBe(false);
  });

  it("rejects contradictory aggregate and category arithmetic", () => {
    const wrongTotal = completeResponse();
    wrongTotal.deterministic.data.totals.expectedContributionMargin!.amountMinor =
      -399;
    expect(
      marginLeakEvaluationResponseSchema.safeParse(wrongTotal).success,
    ).toBe(false);

    const wrongRole = completeResponse();
    wrongRole.deterministic.data.categoryComparisons[0]!.role = "deduction";
    expect(
      marginLeakEvaluationResponseSchema.safeParse(wrongRole).success,
    ).toBe(false);

    const wrongVariance = completeResponse();
    wrongVariance.deterministic.data.categoryComparisons[0]!.direction =
      "adverse";
    wrongVariance.deterministic.data.categoryComparisons[0]!.varianceAmount = {
      amountMinor: 1,
      currency: "USD",
    };
    expect(
      marginLeakEvaluationResponseSchema.safeParse(wrongVariance).success,
    ).toBe(false);
  });

  it("requires one correctly sourced comparison per category for complete evidence", () => {
    const missingCategory = completeResponse();
    missingCategory.deterministic.data.categoryComparisons.pop();
    expect(
      marginLeakEvaluationResponseSchema.safeParse(missingCategory).success,
    ).toBe(false);

    const duplicateCategory = completeResponse();
    duplicateCategory.deterministic.data.categoryComparisons[7] = {
      ...duplicateCategory.deterministic.data.categoryComparisons[0]!,
    };
    expect(
      marginLeakEvaluationResponseSchema.safeParse(duplicateCategory).success,
    ).toBe(false);

    const duplicateEvidence = completeResponse();
    duplicateEvidence.deterministic.evidenceRefs[1] = {
      ...duplicateEvidence.deterministic.evidenceRefs[0]!,
    };
    expect(
      marginLeakEvaluationResponseSchema.safeParse(duplicateEvidence).success,
    ).toBe(false);

    const wrongEvidencePath = completeResponse();
    wrongEvidencePath.deterministic.evidenceRefs[0]!.factPath =
      "/financials/cogs/observed";
    expect(
      marginLeakEvaluationResponseSchema.safeParse(wrongEvidencePath).success,
    ).toBe(false);

    const wrongEvidenceSource = completeResponse();
    wrongEvidenceSource.deterministic.evidenceRefs[0]!.sourceKind =
      "deterministic_rule";
    expect(
      marginLeakEvaluationResponseSchema.safeParse(wrongEvidenceSource).success,
    ).toBe(false);
  });

  it("rejects findings and review reasons that contradict deterministic data", () => {
    const wrongVarianceFinding = completeResponse();
    wrongVarianceFinding.deterministic.data.findings = [
      {
        code: "ADVERSE_COMPONENT_VARIANCE",
        impact: "favorable",
        category: "grossItemRevenue",
        amount: { amountMinor: 1, currency: "USD" },
        evidenceIds: [
          "ev-grossItemRevenue-expected",
          "ev-grossItemRevenue-observed",
        ],
      },
    ];
    expect(
      marginLeakEvaluationResponseSchema.safeParse(wrongVarianceFinding)
        .success,
    ).toBe(false);

    const missingFinding = completeResponse();
    missingFinding.analysisStatus = "needs_review";
    missingFinding.humanReview = {
      required: true,
      reasonCodes: ["MARGINLEAK_EVIDENCE_INCOMPLETE"],
      decidedBy: "deterministic_policy",
      policyVersion: "marginleak-review-g4a.1",
    };
    const missingData = missingFinding.deterministic.data;
    missingData.assessment = "indeterminate";
    missingData.evidenceCompleteness = "incomplete";
    missingData.totals = {
      expectedContributionMargin: null,
      observedContributionMargin: null,
      netContributionVariance: null,
      leakAmount: null,
    };
    missingData.missingEvidencePaths = ["/financials/cogs/observed"];
    missingData.findings = [];
    expect(
      marginLeakEvaluationResponseSchema.safeParse(missingFinding).success,
    ).toBe(false);

    const extraneousReason = completeResponse();
    extraneousReason.humanReview.reasonCodes = ["UNRELATED_REASON"];
    expect(
      marginLeakEvaluationResponseSchema.safeParse(extraneousReason).success,
    ).toBe(false);
  });
});
