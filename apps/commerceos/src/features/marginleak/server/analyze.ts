import {
  MARGIN_LEAK_FINANCIAL_CATEGORIES,
  marginLeakEvaluationResponseSchema,
  SCHEMA_VERSION,
  type MarginLeakEvaluationRequest,
  type MarginLeakEvaluationResponse,
} from "@commerceos/contracts";

import { evaluateMarginLeak } from "../domain/evaluate";

export type MarginLeakAnalysisDependencies = {
  now: () => Date;
  randomUUID: () => string;
};

export const analyzeMarginLeak = (
  request: MarginLeakEvaluationRequest,
  dependencies: MarginLeakAnalysisDependencies,
): MarginLeakEvaluationResponse => {
  const receivedAt = dependencies.now();
  const requestId = dependencies.randomUUID();
  const traceId = dependencies.randomUUID();
  const evaluation = evaluateMarginLeak(request);

  const evidenceRefs = MARGIN_LEAK_FINANCIAL_CATEGORIES.flatMap((category) => {
    const component = request.financials[category];
    return (["expected", "observed"] as const).flatMap((side) => {
      const observation = component?.[side];
      return observation
        ? [
            {
              evidenceId: observation.evidenceId,
              factPath: `/financials/${category}/${side}`,
              sourceKind: "synthetic_fixture" as const,
            },
          ]
        : [];
    });
  });

  return marginLeakEvaluationResponseSchema.parse({
    schemaVersion: SCHEMA_VERSION,
    moduleId: "marginleak",
    analysisStatus: evaluation.humanReview.required
      ? "needs_review"
      : "complete",
    metadata: {
      requestId,
      traceId,
      receivedAt: receivedAt.toISOString(),
      respondedAt: dependencies.now().toISOString(),
    },
    scenario: request.scenario,
    deterministic: {
      data: {
        assessment: evaluation.assessment,
        evidenceCompleteness: evaluation.completeness,
        observationState: evaluation.observationState,
        orderRef: request.orderRef,
        currency: evaluation.currency,
        totals: evaluation.totals,
        categoryComparisons: evaluation.componentBreakdown,
        findings: evaluation.findings,
        missingEvidencePaths: evaluation.missingInputs,
      },
      rulesetVersion: evaluation.rulesetVersion,
      evidenceRefs,
    },
    humanReview: evaluation.humanReview,
  });
};
