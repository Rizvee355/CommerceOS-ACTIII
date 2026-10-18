import {
  promiseGuardAiMitigationOutputSchema,
  promiseGuardEvaluationResponseSchema,
  SCHEMA_VERSION,
  type PromiseGuardActionCode,
  type PromiseGuardAiMitigationOutput,
  type PromiseGuardEvaluationRequest,
  type PromiseGuardEvaluationResponse,
  type PromiseGuardFinding,
} from "@commerceos/contracts";
import {
  InferenceProviderError,
  type InferenceErrorCode,
  type InferenceProvider,
} from "@commerceos/inference";

import { evaluatePromiseGuard } from "../domain/evaluate";

export type PromiseGuardAnalysisDependencies = {
  inferenceProvider: InferenceProvider | null;
  now: () => Date;
  randomUUID: () => string;
};

const actionIsCompatible = (
  actionCode: PromiseGuardActionCode,
  findings: PromiseGuardFinding[],
  assessment: "supported" | "at_risk" | "indeterminate",
  inventoryEvidenceId: string,
): boolean => {
  const findingCodes = new Set(findings.map(({ code }) => code));
  const inventoryIsUncertain = findings.some(
    (finding) =>
      finding.impact === "uncertain" &&
      finding.trace.kind === "evidence" &&
      finding.trace.evidenceIds.includes(inventoryEvidenceId),
  );

  switch (actionCode) {
    case "verify_inventory_allocation":
      return (
        findingCodes.has("INVENTORY_NOT_SECURED") ||
        findingCodes.has("UNKNOWN_INVENTORY_STATE") ||
        inventoryIsUncertain
      );
    case "obtain_current_readiness_estimate":
      return (
        findingCodes.has("MISSING_READY_ESTIMATE") ||
        findingCodes.has("READY_ESTIMATE_AFTER_DEADLINE") ||
        findingCodes.has("READY_ESTIMATE_ELAPSED") ||
        findingCodes.has("UNKNOWN_FULFILLMENT_STATE")
      );
    case "resolve_identified_blocker":
      return (
        findingCodes.has("ACTIVE_BLOCKER_REPORTED") ||
        findingCodes.has("FULFILLMENT_BLOCKED")
      );
    case "escalate_to_fulfillment_lead":
      return assessment !== "supported";
    case "reassess_customer_facing_commitment":
      return assessment === "at_risk";
  }
};

const promiseGuardActionCodes: readonly PromiseGuardActionCode[] = [
  "resolve_identified_blocker",
  "verify_inventory_allocation",
  "obtain_current_readiness_estimate",
  "reassess_customer_facing_commitment",
  "escalate_to_fulfillment_lead",
];

const evidenceIdsForAction = (
  actionCode: PromiseGuardActionCode,
  request: PromiseGuardEvaluationRequest,
  deterministic: ReturnType<typeof evaluatePromiseGuard>["deterministic"],
): ReadonlySet<string> => {
  const evidence = request.operationalEvidence;
  switch (actionCode) {
    case "verify_inventory_allocation":
      return new Set([evidence.inventoryAllocation.evidenceId]);
    case "obtain_current_readiness_estimate":
      return new Set([
        evidence.fulfillmentState.evidenceId,
        ...(evidence.readyTimeEstimate
          ? [evidence.readyTimeEstimate.evidenceId]
          : []),
      ]);
    case "resolve_identified_blocker":
      return new Set([
        evidence.blockingState.evidenceId,
        evidence.fulfillmentState.evidenceId,
      ]);
    case "escalate_to_fulfillment_lead":
      return new Set(
        deterministic.evidenceRefs.map(({ evidenceId }) => evidenceId),
      );
    case "reassess_customer_facing_commitment":
      return new Set([
        request.commitment.evidenceId,
        ...(evidence.readyTimeEstimate
          ? [evidence.readyTimeEstimate.evidenceId]
          : []),
        ...deterministic.data.findings.flatMap((finding) =>
          finding.impact === "adverse" && finding.trace.kind === "evidence"
            ? finding.trace.evidenceIds
            : [],
        ),
      ]);
  }
};

const allowedActionsFor = (
  request: PromiseGuardEvaluationRequest,
  deterministic: ReturnType<typeof evaluatePromiseGuard>["deterministic"],
) =>
  promiseGuardActionCodes
    .filter((actionCode) =>
      actionIsCompatible(
        actionCode,
        deterministic.data.findings,
        deterministic.data.assessment,
        request.operationalEvidence.inventoryAllocation.evidenceId,
      ),
    )
    .map((actionCode) => ({
      actionCode,
      evidenceIds: [
        ...evidenceIdsForAction(actionCode, request, deterministic),
      ],
    }));

const validateMitigations = (
  output: PromiseGuardAiMitigationOutput,
  request: PromiseGuardEvaluationRequest,
  deterministic: ReturnType<typeof evaluatePromiseGuard>["deterministic"],
): void => {
  for (const action of output.data.actions) {
    if (
      !actionIsCompatible(
        action.actionCode,
        deterministic.data.findings,
        deterministic.data.assessment,
        request.operationalEvidence.inventoryAllocation.evidenceId,
      )
    ) {
      throw new InferenceProviderError(
        "MALFORMED_OUTPUT",
        "Inference recommended an action unsupported by deterministic findings.",
        false,
      );
    }
    const allowedEvidenceIds = evidenceIdsForAction(
      action.actionCode,
      request,
      deterministic,
    );
    if (
      action.evidenceIds.some(
        (evidenceId) => !allowedEvidenceIds.has(evidenceId),
      )
    ) {
      throw new InferenceProviderError(
        "MALFORMED_OUTPUT",
        "Inference action evidence was unrelated to the recommended mitigation.",
        false,
      );
    }
  }
};

const reasonCodeFor = (
  code: InferenceErrorCode,
): Extract<
  PromiseGuardEvaluationResponse["inference"],
  { status: "unavailable" }
>["reasonCode"] => {
  switch (code) {
    case "TIMEOUT":
      return "timeout";
    case "RATE_LIMITED":
      return "rate_limited";
    case "MALFORMED_OUTPUT":
      return "malformed_output";
    case "INVALID_PROVIDER_CONFIGURATION":
    case "LIVE_PROVIDER_NOT_ACTIVATED":
    case "MOCK_FORBIDDEN_IN_PRODUCTION":
      return "configuration";
    default:
      return "provider_unavailable";
  }
};

export const analyzePromiseGuard = async (
  request: PromiseGuardEvaluationRequest,
  dependencies: PromiseGuardAnalysisDependencies,
): Promise<PromiseGuardEvaluationResponse> => {
  const receivedAt = dependencies.now();
  const requestId = dependencies.randomUUID();
  const traceId = dependencies.randomUUID();
  const evaluation = evaluatePromiseGuard(request, receivedAt);

  const responseBase = () => ({
    schemaVersion: SCHEMA_VERSION,
    moduleId: "promiseguard" as const,
    metadata: {
      requestId,
      traceId,
      receivedAt: receivedAt.toISOString(),
      respondedAt: dependencies.now().toISOString(),
    },
    scenario: request.scenario,
    deterministic: evaluation.deterministic,
    humanReview: evaluation.humanReview,
  });

  if (!dependencies.inferenceProvider) {
    return promiseGuardEvaluationResponseSchema.parse({
      ...responseBase(),
      analysisStatus: "limited",
      inference: { status: "unavailable", reasonCode: "configuration" },
    });
  }

  try {
    const result = await dependencies.inferenceProvider.generateStructured(
      {
        requestId,
        traceId,
        scenario: request.scenario,
        input: {
          assessment: evaluation.deterministic.data.assessment,
          findings: evaluation.deterministic.data.findings,
          findingCodes: evaluation.deterministic.data.findings.map(
            ({ code }) => code,
          ),
          allowedActions: allowedActionsFor(request, evaluation.deterministic),
        },
      },
      promiseGuardAiMitigationOutputSchema,
    );
    validateMitigations(result.output, request, evaluation.deterministic);

    const response = promiseGuardEvaluationResponseSchema.safeParse({
      ...responseBase(),
      analysisStatus: evaluation.humanReview.required
        ? "needs_review"
        : "complete",
      aiRecommendation: result.output,
      inference: result.metadata,
    });
    if (!response.success) {
      throw new InferenceProviderError(
        "MALFORMED_OUTPUT",
        "Inference output was incompatible with the evaluation response.",
        false,
      );
    }
    return response.data;
  } catch (error) {
    if (!(error instanceof InferenceProviderError)) throw error;
    return promiseGuardEvaluationResponseSchema.parse({
      ...responseBase(),
      analysisStatus: "limited",
      inference: {
        status: "unavailable",
        providerId: dependencies.inferenceProvider.providerId,
        reasonCode: reasonCodeFor(error.code),
      },
    });
  }
};
