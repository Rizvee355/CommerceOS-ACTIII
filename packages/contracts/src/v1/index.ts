import { z } from "zod";

import {
  MARGIN_LEAK_CONTRIBUTION_ROLES,
  MARGIN_LEAK_FINANCIAL_CATEGORIES,
  MARGIN_LEAK_MAX_COMPONENT_AMOUNT_MINOR,
  marginLeakAssessmentSchema,
  marginLeakEvidenceCompletenessSchema,
  marginLeakObservationStateSchema,
  marginLeakVarianceDirectionSchema,
} from "./marginleak";
import {
  dispatchCommitmentSchema,
  promiseGuardAiDataSchema,
  promiseGuardDeterministicDataSchema,
  promiseGuardOperationalEvidenceSchema,
  promiseGuardOpaqueIdSchema,
} from "./promiseguard";

export * from "./marginleak";
export * from "./promiseguard";

export const SCHEMA_VERSION = "1.0" as const;

const schemaVersionSchema = z.literal(SCHEMA_VERSION);
const utcTimestampSchema = z
  .string()
  .datetime({ offset: false })
  .describe("RFC 3339 timestamp assigned by the server");
const opaqueIdSchema = z.string().trim().min(1).max(128);
const generatedIdSchema = z.uuid().describe("Server-generated UUID");

const supportedCurrencyCodes = Intl.supportedValuesOf("currency");
if (supportedCurrencyCodes.length === 0) {
  throw new Error("The runtime does not provide ISO-4217 currency data.");
}

export const currencyCodeSchema = z.enum(
  supportedCurrencyCodes as [string, ...string[]],
);

export const moneySchema = z.strictObject({
  amountMinor: z
    .number()
    .int()
    .safe()
    .describe("Integer amount in the currency's minor units"),
  currency: currencyCodeSchema.describe("ISO-4217 currency code"),
});

export const scenarioRefSchema = z.strictObject({
  scenarioId: opaqueIdSchema,
  synthetic: z.boolean(),
});

export const evidenceRefSchema = z.strictObject({
  evidenceId: opaqueIdSchema,
  factPath: z.string().startsWith("/").max(512),
  sourceKind: z.enum([
    "validated_input",
    "deterministic_rule",
    "synthetic_fixture",
  ]),
});

export const analysisModuleIdSchema = z.enum(["promiseguard", "marginleak"]);

export const analysisStatusSchema = z.enum([
  "complete",
  "limited",
  "needs_review",
]);

export const requestMetadataSchema = z.strictObject({
  requestId: generatedIdSchema,
  traceId: generatedIdSchema,
  receivedAt: utcTimestampSchema,
});

export const responseMetadataSchema = requestMetadataSchema.extend({
  respondedAt: utcTimestampSchema,
});

export const humanReviewMetadataSchema = z.strictObject({
  required: z.boolean(),
  reasonCodes: z.array(opaqueIdSchema).max(32),
  decidedBy: z.literal("deterministic_policy"),
  policyVersion: opaqueIdSchema,
});

const availableInferenceMetadataSchema = z
  .strictObject({
    status: z.literal("available"),
    providerId: opaqueIdSchema,
    modelId: opaqueIdSchema,
    adapterVersion: opaqueIdSchema,
    generatedAt: utcTimestampSchema,
    durationMs: z.number().int().nonnegative().safe(),
    provenance: z.enum(["live", "synthetic_mock"]),
  })
  .superRefine((value, context) => {
    const isDeterministicMock = value.providerId === "deterministic-mock";
    if (value.provenance === "synthetic_mock" && !isDeterministicMock) {
      context.addIssue({
        code: "custom",
        path: ["providerId"],
        message: "Synthetic mock provenance must identify deterministic-mock.",
      });
    }
    if (value.provenance === "live" && isDeterministicMock) {
      context.addIssue({
        code: "custom",
        path: ["providerId"],
        message: "The deterministic mock cannot claim live provenance.",
      });
    }
  });

const unavailableInferenceMetadataSchema = z.strictObject({
  status: z.literal("unavailable"),
  providerId: opaqueIdSchema.optional(),
  reasonCode: z.enum([
    "configuration",
    "malformed_output",
    "provider_unavailable",
    "rate_limited",
    "timeout",
  ]),
});

export const inferenceMetadataSchema = z.discriminatedUnion("status", [
  availableInferenceMetadataSchema,
  unavailableInferenceMetadataSchema,
]);

const genericDataSchema = z.record(z.string(), z.unknown());

export const deterministicResultSchema = z.strictObject({
  data: genericDataSchema,
  rulesetVersion: opaqueIdSchema,
  evidenceRefs: z.array(evidenceRefSchema).max(128),
});

export const aiRecommendationSchema = z.strictObject({
  data: genericDataSchema,
  reasoningSummary: z.string().trim().min(1).max(2_000),
  evidenceRefs: z.array(opaqueIdSchema).min(1).max(128),
});

export const analysisResponseEnvelopeSchema = z
  .strictObject({
    schemaVersion: schemaVersionSchema,
    moduleId: analysisModuleIdSchema,
    analysisStatus: analysisStatusSchema,
    metadata: responseMetadataSchema,
    scenario: scenarioRefSchema.optional(),
    deterministic: deterministicResultSchema.optional(),
    aiRecommendation: aiRecommendationSchema.optional(),
    humanReview: humanReviewMetadataSchema,
    inference: inferenceMetadataSchema.optional(),
  })
  .superRefine((value, context) => {
    if (!value.deterministic && !value.aiRecommendation) {
      context.addIssue({
        code: "custom",
        path: ["deterministic"],
        message: "At least one result section is required.",
      });
    }

    if (
      value.analysisStatus === "needs_review" &&
      !value.humanReview.required
    ) {
      context.addIssue({
        code: "custom",
        path: ["humanReview", "required"],
        message: "needs_review requires deterministic human review.",
      });
    }

    if (value.inference?.status === "unavailable") {
      if (value.analysisStatus !== "limited") {
        context.addIssue({
          code: "custom",
          path: ["analysisStatus"],
          message: "Unavailable inference requires limited analysis status.",
        });
      }
      if (value.aiRecommendation) {
        context.addIssue({
          code: "custom",
          path: ["aiRecommendation"],
          message: "Unavailable inference cannot produce an AI recommendation.",
        });
      }
    }

    if (
      value.aiRecommendation &&
      (!value.inference || value.inference.status !== "available")
    ) {
      context.addIssue({
        code: "custom",
        path: ["inference"],
        message: "An AI recommendation requires available inference metadata.",
      });
    }

    if (value.aiRecommendation) {
      const validatedEvidenceIds = new Set(
        value.deterministic?.evidenceRefs.map(({ evidenceId }) => evidenceId),
      );
      value.aiRecommendation.evidenceRefs.forEach((evidenceId, index) => {
        if (!validatedEvidenceIds.has(evidenceId)) {
          context.addIssue({
            code: "custom",
            path: ["aiRecommendation", "evidenceRefs", index],
            message:
              "AI evidence must reference evidence validated by deterministic processing.",
          });
        }
      });
    }
  });

export const errorCategorySchema = z.enum([
  "authorization",
  "internal",
  "provider",
  "rate_limit",
  "timeout",
  "validation",
]);

export const fieldErrorSchema = z.strictObject({
  path: z.string().startsWith("/").max(512),
  code: opaqueIdSchema,
  message: z.string().trim().min(1).max(512),
});

export const errorEnvelopeSchema = z.strictObject({
  schemaVersion: schemaVersionSchema,
  requestId: generatedIdSchema,
  traceId: generatedIdSchema,
  timestamp: utcTimestampSchema,
  error: z.strictObject({
    code: opaqueIdSchema,
    category: errorCategorySchema,
    message: z.string().trim().min(1).max(512),
    retryable: z.boolean(),
    fieldErrors: z.array(fieldErrorSchema).max(64).optional(),
  }),
});

export const capabilityStateSchema = z.enum([
  "planned",
  "stub",
  "active",
  "disabled",
]);

export const capabilityIdSchema = z.enum([
  "promiseguard",
  "marginleak",
  "rescuecart",
]);

export const capabilityStatusSchema = z
  .strictObject({
    id: capabilityIdSchema,
    label: z.string().trim().min(1).max(64),
    description: z.string().trim().min(1).max(280),
    state: capabilityStateSchema,
    routes: z.array(z.string().startsWith("/")).max(16),
  })
  .superRefine((value, context) => {
    if (
      value.id === "rescuecart" &&
      (value.state !== "disabled" || value.routes.length > 0)
    ) {
      context.addIssue({
        code: "custom",
        message: "RescueCart must remain disabled and route-free.",
      });
    }
  });

const apiMetadataShape = {
  schemaVersion: schemaVersionSchema,
  requestId: generatedIdSchema,
  traceId: generatedIdSchema,
  timestamp: utcTimestampSchema,
};

export const capabilitiesResponseSchema = z.strictObject({
  ...apiMetadataShape,
  capabilities: z.array(capabilityStatusSchema).length(3),
});

export const healthResponseSchema = z.strictObject({
  ...apiMetadataShape,
  status: z.literal("ok"),
  service: z.literal("commerceos"),
  version: opaqueIdSchema,
});

const marginLeakEvidenceTimestampSchema = z
  .string()
  .datetime({ offset: false })
  .describe("UTC timestamp supplied for the synthetic evidence");

const marginLeakScenarioRefSchema = scenarioRefSchema.extend({
  synthetic: z.literal(true),
});

const marginLeakEvidenceSourceSchema = z.strictObject({
  kind: z.literal("synthetic_fixture"),
  label: z.string().trim().min(1).max(160),
  recordedAt: marginLeakEvidenceTimestampSchema,
});

const marginLeakFinancialObservationSchema = z.strictObject({
  amountMinor: z
    .number()
    .int()
    .nonnegative()
    .max(MARGIN_LEAK_MAX_COMPONENT_AMOUNT_MINOR),
  currency: currencyCodeSchema,
  evidenceId: opaqueIdSchema,
  source: marginLeakEvidenceSourceSchema,
});

const marginLeakFinancialComponentSchema = z.strictObject({
  expected: marginLeakFinancialObservationSchema.optional(),
  observed: marginLeakFinancialObservationSchema.optional(),
});

const marginLeakFinancialsSchema = z.strictObject(
  Object.fromEntries(
    MARGIN_LEAK_FINANCIAL_CATEGORIES.map((category) => [
      category,
      marginLeakFinancialComponentSchema.optional(),
    ]),
  ) as Record<
    (typeof MARGIN_LEAK_FINANCIAL_CATEGORIES)[number],
    z.ZodOptional<typeof marginLeakFinancialComponentSchema>
  >,
);

export const marginLeakEvaluationRequestSchema = z
  .strictObject({
    schemaVersion: schemaVersionSchema,
    moduleId: z.literal("marginleak"),
    scenario: marginLeakScenarioRefSchema,
    orderRef: opaqueIdSchema,
    currency: currencyCodeSchema,
    observationState: marginLeakObservationStateSchema,
    financials: marginLeakFinancialsSchema,
  })
  .superRefine((value, context) => {
    if (!value.scenario.synthetic) {
      context.addIssue({
        code: "custom",
        path: ["scenario", "synthetic"],
        message: "MarginLeak currently accepts synthetic scenarios only.",
      });
    }

    const evidenceIds = new Set<string>();
    for (const category of MARGIN_LEAK_FINANCIAL_CATEGORIES) {
      const component = value.financials[category];
      for (const side of ["expected", "observed"] as const) {
        const observation = component?.[side];
        if (!observation) continue;

        if (observation.currency !== value.currency) {
          context.addIssue({
            code: "custom",
            path: ["financials", category, side, "currency"],
            message: "Every financial input must use the request currency.",
          });
        }

        if (evidenceIds.has(observation.evidenceId)) {
          context.addIssue({
            code: "custom",
            path: ["financials", category, side, "evidenceId"],
            message: "Evidence identifiers must be unique within the request.",
          });
        }
        evidenceIds.add(observation.evidenceId);
      }
    }
  });

const marginLeakNonnegativeMoneySchema = moneySchema.extend({
  amountMinor: z
    .number()
    .int()
    .nonnegative()
    .max(MARGIN_LEAK_MAX_COMPONENT_AMOUNT_MINOR),
});

const marginLeakCategoryComparisonSchema = z.strictObject({
  category: z.enum(MARGIN_LEAK_FINANCIAL_CATEGORIES),
  role: z.enum(["revenue", "deduction"]),
  expected: marginLeakNonnegativeMoneySchema,
  observed: marginLeakNonnegativeMoneySchema,
  direction: marginLeakVarianceDirectionSchema,
  varianceAmount: marginLeakNonnegativeMoneySchema,
  expectedEvidenceId: opaqueIdSchema,
  observedEvidenceId: opaqueIdSchema,
});

const MARGIN_LEAK_EVIDENCE_PATHS = MARGIN_LEAK_FINANCIAL_CATEGORIES.flatMap(
  (category) => [
    `/financials/${category}/expected`,
    `/financials/${category}/observed`,
  ],
) as [string, ...string[]];

const marginLeakEvidencePathSchema = z.enum(MARGIN_LEAK_EVIDENCE_PATHS);

const marginLeakEvidenceRefSchema = evidenceRefSchema.extend({
  factPath: marginLeakEvidencePathSchema,
  sourceKind: z.literal("synthetic_fixture"),
});

const marginLeakVarianceFindingShape = {
  category: z.enum(MARGIN_LEAK_FINANCIAL_CATEGORIES),
  amount: marginLeakNonnegativeMoneySchema,
  evidenceIds: z.tuple([opaqueIdSchema, opaqueIdSchema]),
};

const marginLeakVarianceFindingSchema = z.discriminatedUnion("code", [
  z.strictObject({
    code: z.literal("ADVERSE_COMPONENT_VARIANCE"),
    impact: z.literal("adverse"),
    ...marginLeakVarianceFindingShape,
  }),
  z.strictObject({
    code: z.literal("FAVORABLE_COMPONENT_VARIANCE"),
    impact: z.literal("favorable"),
    ...marginLeakVarianceFindingShape,
  }),
]);

const marginLeakMissingFindingSchema = z.strictObject({
  code: z.literal("MISSING_FINANCIAL_INPUT"),
  impact: z.literal("uncertain"),
  fieldPath: marginLeakEvidencePathSchema,
});

const marginLeakProvisionalFindingSchema = z.strictObject({
  code: z.literal("PROVISIONAL_FINANCIAL_INPUTS"),
  impact: z.literal("uncertain"),
  fieldPath: z.literal("/observationState"),
});

export const marginLeakFindingSchema = z.union([
  marginLeakVarianceFindingSchema,
  marginLeakMissingFindingSchema,
  marginLeakProvisionalFindingSchema,
]);

const nullableMoneySchema = moneySchema.nullable();
const marginLeakTotalsSchema = z.strictObject({
  expectedContributionMargin: nullableMoneySchema,
  observedContributionMargin: nullableMoneySchema,
  netContributionVariance: nullableMoneySchema,
  leakAmount: nullableMoneySchema,
});

export const marginLeakDeterministicDataSchema = z.strictObject({
  assessment: marginLeakAssessmentSchema,
  evidenceCompleteness: marginLeakEvidenceCompletenessSchema,
  observationState: marginLeakObservationStateSchema,
  orderRef: opaqueIdSchema,
  currency: currencyCodeSchema,
  totals: marginLeakTotalsSchema,
  categoryComparisons: z.array(marginLeakCategoryComparisonSchema).max(8),
  findings: z.array(marginLeakFindingSchema).max(32),
  missingEvidencePaths: z.array(marginLeakEvidencePathSchema).max(16),
});

const marginLeakDeterministicResultSchema = deterministicResultSchema.extend({
  data: marginLeakDeterministicDataSchema,
  evidenceRefs: z.array(marginLeakEvidenceRefSchema).max(16),
});

export const marginLeakEvaluationResponseSchema = z
  .strictObject({
    schemaVersion: schemaVersionSchema,
    moduleId: z.literal("marginleak"),
    analysisStatus: analysisStatusSchema,
    metadata: responseMetadataSchema,
    scenario: marginLeakScenarioRefSchema,
    deterministic: marginLeakDeterministicResultSchema,
    humanReview: humanReviewMetadataSchema,
  })
  .superRefine((value, context) => {
    const generic = analysisResponseEnvelopeSchema.safeParse(value);
    if (!generic.success) {
      generic.error.issues.forEach((issue) => {
        context.addIssue({
          code: "custom",
          path: issue.path,
          message: issue.message,
        });
      });
    }

    if (!value.scenario.synthetic) {
      context.addIssue({
        code: "custom",
        path: ["scenario", "synthetic"],
        message: "MarginLeak responses must describe synthetic scenarios.",
      });
    }

    const data = value.deterministic.data;
    const totals = data.totals;
    const totalValues = Object.values(totals);
    const allTotalsNull = totalValues.every((total) => total === null);
    const completeTotals =
      totals.expectedContributionMargin !== null &&
      totals.observedContributionMargin !== null &&
      totals.netContributionVariance !== null;

    if (data.evidenceCompleteness === "incomplete") {
      if (
        data.assessment !== "indeterminate" ||
        !allTotalsNull ||
        data.missingEvidencePaths.length === 0
      ) {
        context.addIssue({
          code: "custom",
          path: ["deterministic", "data"],
          message:
            "Incomplete evidence requires an indeterminate assessment, missing paths, and null aggregate totals.",
        });
      }
    } else {
      if (!completeTotals || data.missingEvidencePaths.length > 0) {
        context.addIssue({
          code: "custom",
          path: ["deterministic", "data", "totals"],
          message:
            "Complete evidence requires calculated margins and variance without missing paths.",
        });
      } else if (data.observationState === "provisional") {
        if (data.assessment !== "indeterminate" || totals.leakAmount !== null) {
          context.addIssue({
            code: "custom",
            path: ["deterministic", "data", "totals", "leakAmount"],
            message:
              "Provisional evidence cannot produce a confirmed leak amount.",
          });
        }
      } else if (
        totals.leakAmount === null ||
        totals.netContributionVariance === null
      ) {
        context.addIssue({
          code: "custom",
          path: ["deterministic", "data", "totals", "leakAmount"],
          message: "Complete final evidence requires a confirmed leak amount.",
        });
      } else {
        const variance = totals.netContributionVariance.amountMinor;
        const expectedAssessment =
          variance > 0 ? "leak_detected" : "no_leak_detected";
        if (
          data.assessment !== expectedAssessment ||
          totals.leakAmount.amountMinor !== Math.max(variance, 0)
        ) {
          context.addIssue({
            code: "custom",
            path: ["deterministic", "data", "totals", "leakAmount"],
            message:
              "Final assessment and confirmed leak must match signed net variance.",
          });
        }
      }
    }

    const requiresReview = data.assessment !== "no_leak_detected";
    if (
      value.humanReview.required !== requiresReview ||
      (requiresReview && value.humanReview.reasonCodes.length === 0) ||
      (!requiresReview && value.humanReview.reasonCodes.length > 0)
    ) {
      context.addIssue({
        code: "custom",
        path: ["humanReview"],
        message: "Human-review metadata must match the MarginLeak assessment.",
      });
    }

    const expectedStatus = requiresReview ? "needs_review" : "complete";
    if (value.analysisStatus !== expectedStatus) {
      context.addIssue({
        code: "custom",
        path: ["analysisStatus"],
        message: "Analysis status must match deterministic review policy.",
      });
    }

    if (
      Date.parse(value.metadata.respondedAt) <
      Date.parse(value.metadata.receivedAt)
    ) {
      context.addIssue({
        code: "custom",
        path: ["metadata", "respondedAt"],
        message: "The response timestamp cannot precede receipt.",
      });
    }

    const comparisonCategories = new Set<string>();
    data.categoryComparisons.forEach((comparison, index) => {
      if (comparisonCategories.has(comparison.category)) {
        context.addIssue({
          code: "custom",
          path: ["deterministic", "data", "categoryComparisons", index],
          message: "Each financial category may appear only once.",
        });
      }
      comparisonCategories.add(comparison.category);

      const contributionSign =
        MARGIN_LEAK_CONTRIBUTION_ROLES[comparison.category];
      const expectedRole = contributionSign === 1 ? "revenue" : "deduction";
      const signedVariance =
        contributionSign *
        (comparison.expected.amountMinor - comparison.observed.amountMinor);
      const expectedDirection =
        signedVariance > 0
          ? "adverse"
          : signedVariance < 0
            ? "favorable"
            : "neutral";

      if (
        comparison.role !== expectedRole ||
        comparison.direction !== expectedDirection ||
        comparison.varianceAmount.amountMinor !== Math.abs(signedVariance)
      ) {
        context.addIssue({
          code: "custom",
          path: ["deterministic", "data", "categoryComparisons", index],
          message:
            "Category role, direction, and variance must match its financial values.",
        });
      }
    });

    if (
      data.evidenceCompleteness === "complete" &&
      (data.categoryComparisons.length !==
        MARGIN_LEAK_FINANCIAL_CATEGORIES.length ||
        comparisonCategories.size !== MARGIN_LEAK_FINANCIAL_CATEGORIES.length)
    ) {
      context.addIssue({
        code: "custom",
        path: ["deterministic", "data", "categoryComparisons"],
        message:
          "Complete evidence requires exactly one comparison for every financial category.",
      });
    }

    const expectedTotal = totals.expectedContributionMargin;
    const observedTotal = totals.observedContributionMargin;
    const varianceTotal = totals.netContributionVariance;
    if (
      data.evidenceCompleteness === "complete" &&
      expectedTotal !== null &&
      observedTotal !== null &&
      varianceTotal !== null &&
      data.categoryComparisons.length ===
        MARGIN_LEAK_FINANCIAL_CATEGORIES.length &&
      comparisonCategories.size === MARGIN_LEAK_FINANCIAL_CATEGORIES.length
    ) {
      let expectedMargin = 0;
      let observedMargin = 0;
      for (const comparison of data.categoryComparisons) {
        const sign = MARGIN_LEAK_CONTRIBUTION_ROLES[comparison.category];
        expectedMargin += comparison.expected.amountMinor * sign;
        observedMargin += comparison.observed.amountMinor * sign;
      }
      const netVariance = expectedMargin - observedMargin;
      if (
        expectedTotal.amountMinor !== expectedMargin ||
        observedTotal.amountMinor !== observedMargin ||
        varianceTotal.amountMinor !== netVariance
      ) {
        context.addIssue({
          code: "custom",
          path: ["deterministic", "data", "totals"],
          message:
            "Aggregate totals must equal the exact contribution-margin equations.",
        });
      }
    }

    const expectedVarianceFindings = data.categoryComparisons.filter(
      ({ direction }) => direction !== "neutral",
    );
    const actualVarianceFindings = data.findings.filter(
      (finding) =>
        finding.code === "ADVERSE_COMPONENT_VARIANCE" ||
        finding.code === "FAVORABLE_COMPONENT_VARIANCE",
    );
    const varianceFindingsMatch =
      actualVarianceFindings.length === expectedVarianceFindings.length &&
      expectedVarianceFindings.every((comparison) =>
        actualVarianceFindings.some(
          (finding) =>
            finding.category === comparison.category &&
            finding.impact === comparison.direction &&
            finding.amount.amountMinor ===
              comparison.varianceAmount.amountMinor &&
            finding.amount.currency === comparison.varianceAmount.currency &&
            finding.evidenceIds[0] === comparison.expectedEvidenceId &&
            finding.evidenceIds[1] === comparison.observedEvidenceId,
        ),
      );
    if (!varianceFindingsMatch) {
      context.addIssue({
        code: "custom",
        path: ["deterministic", "data", "findings"],
        message:
          "Variance findings must exactly match non-neutral category comparisons.",
      });
    }

    const missingFindingPaths = data.findings.flatMap((finding) =>
      finding.code === "MISSING_FINANCIAL_INPUT" ? [finding.fieldPath] : [],
    );
    const missingPathsMatch =
      new Set(missingFindingPaths).size === missingFindingPaths.length &&
      new Set(data.missingEvidencePaths).size ===
        data.missingEvidencePaths.length &&
      missingFindingPaths.length === data.missingEvidencePaths.length &&
      missingFindingPaths.every((path) =>
        data.missingEvidencePaths.includes(path),
      );
    const provisionalFindingCount = data.findings.filter(
      ({ code }) => code === "PROVISIONAL_FINANCIAL_INPUTS",
    ).length;
    if (
      !missingPathsMatch ||
      provisionalFindingCount !==
        (data.observationState === "provisional" ? 1 : 0)
    ) {
      context.addIssue({
        code: "custom",
        path: ["deterministic", "data", "findings"],
        message:
          "Uncertainty findings must exactly match missing and provisional evidence state.",
      });
    }

    const expectedReasonCodes = [
      ...(data.evidenceCompleteness === "incomplete"
        ? ["MARGINLEAK_EVIDENCE_INCOMPLETE"]
        : []),
      ...(data.observationState === "provisional"
        ? ["MARGINLEAK_PROVISIONAL_INPUTS"]
        : []),
      ...(data.evidenceCompleteness === "complete" &&
      data.observationState === "final" &&
      data.assessment === "leak_detected"
        ? ["MARGINLEAK_LEAK_DETECTED"]
        : []),
    ].sort();
    const actualReasonCodes = [...value.humanReview.reasonCodes].sort();
    if (
      actualReasonCodes.length !== expectedReasonCodes.length ||
      actualReasonCodes.some(
        (reasonCode, index) => reasonCode !== expectedReasonCodes[index],
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["humanReview", "reasonCodes"],
        message: "Human-review reasons must exactly match deterministic state.",
      });
    }

    const moneyValues = [
      ...totalValues.filter((total) => total !== null),
      ...data.categoryComparisons.flatMap((comparison) => [
        comparison.expected,
        comparison.observed,
        comparison.varianceAmount,
      ]),
      ...data.findings.flatMap((finding) =>
        "amount" in finding ? [finding.amount] : [],
      ),
    ];
    moneyValues.forEach((amount) => {
      if (amount.currency !== data.currency) {
        context.addIssue({
          code: "custom",
          path: ["deterministic", "data", "currency"],
          message: "Every response amount must use the response currency.",
        });
      }
    });

    const evidenceIds = new Set(
      value.deterministic.evidenceRefs.map(({ evidenceId }) => evidenceId),
    );
    const evidencePaths = new Set(
      value.deterministic.evidenceRefs.map(({ factPath }) => factPath),
    );
    if (
      evidenceIds.size !== value.deterministic.evidenceRefs.length ||
      evidencePaths.size !== value.deterministic.evidenceRefs.length ||
      value.deterministic.evidenceRefs.some(
        ({ factPath, sourceKind }) =>
          sourceKind !== "synthetic_fixture" ||
          !/^\/financials\/(grossItemRevenue|shippingRevenue|discounts|cogs|shippingCost|fulfillmentCost|paymentCost|platformCost)\/(expected|observed)$/.test(
            factPath,
          ),
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["deterministic", "evidenceRefs"],
        message:
          "MarginLeak evidence references must be unique synthetic financial input paths.",
      });
    }

    const evidenceById = new Map(
      value.deterministic.evidenceRefs.map((reference) => [
        reference.evidenceId,
        reference,
      ]),
    );
    const comparisonEvidenceMatches = data.categoryComparisons.every(
      (comparison) =>
        evidenceById.get(comparison.expectedEvidenceId)?.factPath ===
          `/financials/${comparison.category}/expected` &&
        evidenceById.get(comparison.observedEvidenceId)?.factPath ===
          `/financials/${comparison.category}/observed`,
    );
    if (!comparisonEvidenceMatches) {
      context.addIssue({
        code: "custom",
        path: ["deterministic", "evidenceRefs"],
        message:
          "Category comparison evidence must resolve to its exact financial input paths.",
      });
    }

    const evidenceByPath = new Map(
      value.deterministic.evidenceRefs.map((reference) => [
        reference.factPath,
        reference,
      ]),
    );
    const missingPathSet = new Set(data.missingEvidencePaths);
    const evidencePartitionMatches = MARGIN_LEAK_EVIDENCE_PATHS.every(
      (path) => evidenceByPath.has(path) !== missingPathSet.has(path),
    );
    const comparisonsMatchAvailablePairs =
      MARGIN_LEAK_FINANCIAL_CATEGORIES.every((category) => {
        const expectedRef = evidenceByPath.get(
          `/financials/${category}/expected`,
        );
        const observedRef = evidenceByPath.get(
          `/financials/${category}/observed`,
        );
        const comparison = data.categoryComparisons.find(
          (candidate) => candidate.category === category,
        );
        if (expectedRef && observedRef) {
          return (
            comparison?.expectedEvidenceId === expectedRef.evidenceId &&
            comparison.observedEvidenceId === observedRef.evidenceId
          );
        }
        return comparison === undefined;
      });
    if (!evidencePartitionMatches || !comparisonsMatchAvailablePairs) {
      context.addIssue({
        code: "custom",
        path: ["deterministic", "evidenceRefs"],
        message:
          "Evidence references, missing paths, and comparisons must describe one consistent input set.",
      });
    }

    const requiredEvidenceIds = [
      ...data.categoryComparisons.flatMap((comparison) => [
        comparison.expectedEvidenceId,
        comparison.observedEvidenceId,
      ]),
      ...data.findings.flatMap((finding) =>
        "evidenceIds" in finding ? finding.evidenceIds : [],
      ),
    ];
    if (
      requiredEvidenceIds.some((evidenceId) => !evidenceIds.has(evidenceId))
    ) {
      context.addIssue({
        code: "custom",
        path: ["deterministic", "evidenceRefs"],
        message: "Every response evidence identifier must resolve.",
      });
    }
  });

export const promiseGuardEvaluationRequestSchema = z
  .strictObject({
    schemaVersion: schemaVersionSchema,
    moduleId: z.literal("promiseguard"),
    scenario: scenarioRefSchema,
    fulfillmentRef: promiseGuardOpaqueIdSchema,
    commitment: dispatchCommitmentSchema,
    operationalEvidence: promiseGuardOperationalEvidenceSchema,
  })
  .superRefine((value, context) => {
    if (!value.scenario.synthetic) {
      context.addIssue({
        code: "custom",
        path: ["scenario", "synthetic"],
        message: "PromiseGuard currently accepts synthetic scenarios only.",
      });
    }

    const evidence = [
      value.operationalEvidence.inventoryAllocation,
      value.operationalEvidence.fulfillmentState,
      value.operationalEvidence.blockingState,
      value.operationalEvidence.readyTimeEstimate,
    ].filter((item) => item !== undefined);
    const identifiers = [
      value.commitment.evidenceId,
      ...evidence.map(({ evidenceId }) => evidenceId),
    ];
    const seen = new Set<string>();
    identifiers.forEach((identifier, index) => {
      if (seen.has(identifier)) {
        context.addIssue({
          code: "custom",
          path:
            index === 0
              ? ["commitment", "evidenceId"]
              : ["operationalEvidence"],
          message: "Evidence identifiers must be unique within the request.",
        });
      }
      seen.add(identifier);
    });

    evidence.forEach((item) => {
      if (
        item.validUntil !== null &&
        Date.parse(item.validUntil) < Date.parse(item.observedAt)
      ) {
        context.addIssue({
          code: "custom",
          path: ["operationalEvidence"],
          message: "Evidence validity cannot end before it was observed.",
        });
      }
    });
  });

export const promiseGuardAiMitigationOutputSchema =
  aiRecommendationSchema.extend({
    data: promiseGuardAiDataSchema,
  });

const promiseGuardDeterministicResultSchema = deterministicResultSchema.extend({
  data: promiseGuardDeterministicDataSchema,
});

export const promiseGuardEvaluationResponseSchema = z
  .strictObject({
    schemaVersion: schemaVersionSchema,
    moduleId: z.literal("promiseguard"),
    analysisStatus: analysisStatusSchema,
    metadata: responseMetadataSchema,
    scenario: scenarioRefSchema,
    deterministic: promiseGuardDeterministicResultSchema,
    aiRecommendation: promiseGuardAiMitigationOutputSchema.optional(),
    humanReview: humanReviewMetadataSchema,
    inference: inferenceMetadataSchema,
  })
  .superRefine((value, context) => {
    const generic = analysisResponseEnvelopeSchema.safeParse(value);
    if (!generic.success) {
      generic.error.issues.forEach((issue) => {
        context.addIssue({
          code: "custom",
          path: issue.path,
          message: issue.message,
        });
      });
    }

    const requiresReview = value.deterministic.data.assessment !== "supported";
    if (
      value.humanReview.required !== requiresReview ||
      (requiresReview && value.humanReview.reasonCodes.length === 0)
    ) {
      context.addIssue({
        code: "custom",
        path: ["humanReview"],
        message: "Human-review metadata must match the business assessment.",
      });
    }

    if (value.inference.status === "available") {
      const expectedStatus = requiresReview ? "needs_review" : "complete";
      if (value.analysisStatus !== expectedStatus || !value.aiRecommendation) {
        context.addIssue({
          code: "custom",
          path: ["analysisStatus"],
          message:
            "Available inference must produce the expected complete response.",
        });
      }
    }

    if (value.aiRecommendation) {
      const deterministicEvidence = new Set(
        value.deterministic.evidenceRefs.map(({ evidenceId }) => evidenceId),
      );
      const recommendationEvidence = new Set(
        value.aiRecommendation.evidenceRefs,
      );
      value.aiRecommendation.data.actions.forEach((action, actionIndex) => {
        action.evidenceIds.forEach((evidenceId, evidenceIndex) => {
          if (
            !deterministicEvidence.has(evidenceId) ||
            !recommendationEvidence.has(evidenceId)
          ) {
            context.addIssue({
              code: "custom",
              path: [
                "aiRecommendation",
                "data",
                "actions",
                actionIndex,
                "evidenceIds",
                evidenceIndex,
              ],
              message: "AI action evidence must resolve to validated evidence.",
            });
          }
        });
      });
    }
  });

export type Money = z.infer<typeof moneySchema>;
export type ScenarioRef = z.infer<typeof scenarioRefSchema>;
export type EvidenceRef = z.infer<typeof evidenceRefSchema>;
export type AnalysisResponseEnvelope = z.infer<
  typeof analysisResponseEnvelopeSchema
>;
export type ErrorEnvelope = z.infer<typeof errorEnvelopeSchema>;
export type InferenceMetadata = z.infer<typeof inferenceMetadataSchema>;
export type HumanReviewMetadata = z.infer<typeof humanReviewMetadataSchema>;
export type CapabilityStatus = z.infer<typeof capabilityStatusSchema>;
export type CapabilitiesResponse = z.infer<typeof capabilitiesResponseSchema>;
export type HealthResponse = z.infer<typeof healthResponseSchema>;
export type PromiseGuardEvaluationRequest = z.infer<
  typeof promiseGuardEvaluationRequestSchema
>;
export type PromiseGuardAiMitigationOutput = z.infer<
  typeof promiseGuardAiMitigationOutputSchema
>;
export type PromiseGuardEvaluationResponse = z.infer<
  typeof promiseGuardEvaluationResponseSchema
>;
export type MarginLeakEvaluationRequest = z.infer<
  typeof marginLeakEvaluationRequestSchema
>;
export type MarginLeakFinding = z.infer<typeof marginLeakFindingSchema>;
export type MarginLeakDeterministicData = z.infer<
  typeof marginLeakDeterministicDataSchema
>;
export type MarginLeakEvaluationResponse = z.infer<
  typeof marginLeakEvaluationResponseSchema
>;
