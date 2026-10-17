import type {
  PromiseGuardActionCode,
  PromiseGuardAssessment,
  PromiseGuardEvaluationResponse,
  PromiseGuardFinding,
} from "@commerceos/contracts";

import type { PromiseGuardPresetId } from "../domain/presets";

/**
 * Presentation copy only. Every key is a typed value from the approved
 * PromiseGuard contract; `Record<Code, …>` makes TypeScript fail the build if
 * the contract gains a code this file does not describe.
 */

type FindingCode = PromiseGuardFinding["code"];
type InferenceUnavailableReason = Extract<
  PromiseGuardEvaluationResponse["inference"],
  { status: "unavailable" }
>["reasonCode"];

export const assessmentPresentation: Record<
  PromiseGuardAssessment,
  {
    label: string;
    icon: string;
    headline: string;
    explanation: string;
  }
> = {
  supported: {
    label: "Supported",
    icon: "✓",
    headline: "Current evidence supports dispatch readiness",
    explanation:
      "No adverse or uncertain finding was raised by the deterministic rules. This describes dispatch readiness only. It is not a guarantee of dispatch or delivery.",
  },
  at_risk: {
    label: "At risk",
    icon: "▲",
    headline: "The evidence identifies a risk to this dispatch commitment",
    explanation:
      "At least one finding is adverse to dispatching on time. The adverse findings below explain why.",
  },
  indeterminate: {
    label: "Indeterminate",
    icon: "?",
    headline: "The evidence is not sufficient for a reliable assessment",
    explanation:
      "Evidence is missing, unknown, expired, future-dated or contradictory, so PromiseGuard cannot give a reliable positive or negative assessment. The findings below show what to add or refresh.",
  },
};

export const completenessLabels = {
  complete: "Complete",
  incomplete: "Incomplete",
  conflicted: "Conflicted",
} as const;

export const deadlineLabels = {
  open: "Deadline has not passed",
  elapsed: "Deadline has passed",
} as const;

export const readyByDeadlineLabel = (value: boolean | null): string =>
  value === true
    ? "Readiness estimate falls within the deadline"
    : value === false
      ? "Readiness is not expected by the deadline"
      : "Readiness versus deadline is not established";

export const findingLabels: Record<FindingCode, string> = {
  DISPATCH_DEADLINE_OPEN: "The dispatch deadline has not passed",
  DISPATCH_DEADLINE_ELAPSED: "The dispatch deadline has passed",
  INVENTORY_SECURED: "Inventory is secured for this fulfillment",
  INVENTORY_NOT_SECURED: "Inventory is not secured",
  UNKNOWN_INVENTORY_STATE: "Inventory allocation state is unknown",
  FULFILLMENT_READY: "Fulfillment is ready",
  FULFILLMENT_BLOCKED: "Fulfillment is blocked",
  UNKNOWN_FULFILLMENT_STATE: "Fulfillment state is unknown",
  NO_ACTIVE_BLOCKERS: "No active blockers are known",
  ACTIVE_BLOCKER_REPORTED: "An active blocker is reported",
  UNKNOWN_BLOCKER_STATE: "Blocker state is unknown",
  READY_ESTIMATE_WITHIN_DEADLINE:
    "Readiness estimate falls within the deadline",
  READY_ESTIMATE_AFTER_DEADLINE: "Readiness estimate falls after the deadline",
  READY_ESTIMATE_ELAPSED:
    "The estimated ready time has passed while fulfillment is unfinished",
  READY_ESTIMATE_IGNORED_AFTER_READY:
    "Readiness estimate is not needed because fulfillment is already ready",
  MISSING_READY_ESTIMATE: "No readiness estimate was provided",
  EXPIRED_EVIDENCE: "Evidence has expired",
  UNKNOWN_EVIDENCE_VALIDITY: "Evidence validity is unknown",
  FUTURE_DATED_EVIDENCE: "Evidence is dated after the evaluation time",
  CONTRADICTORY_OPERATIONAL_STATE: "Operational states contradict each other",
};

/**
 * Deterministic guidance template. This is static copy keyed to server finding
 * codes; it is not AI output and adds no facts. Supporting findings need none.
 */
export const findingGuidance: Partial<Record<FindingCode, string>> = {
  DISPATCH_DEADLINE_ELAPSED:
    "The dispatch-by time has passed. Confirm the actual dispatch status outside PromiseGuard, which does not record whether dispatch happened.",
  INVENTORY_NOT_SECURED:
    "Verify whether inventory can be secured for this fulfillment.",
  UNKNOWN_INVENTORY_STATE: "Obtain a current inventory allocation status.",
  FULFILLMENT_BLOCKED: "Identify and resolve what is blocking fulfillment.",
  UNKNOWN_FULFILLMENT_STATE: "Obtain a current fulfillment state.",
  ACTIVE_BLOCKER_REPORTED:
    "Review the reported blocker and resolve it, or escalate it to the fulfillment lead.",
  UNKNOWN_BLOCKER_STATE: "Confirm whether any blocker is currently active.",
  READY_ESTIMATE_AFTER_DEADLINE:
    "The estimate is later than the commitment. Reassess the commitment or the readiness plan with a human reviewer.",
  READY_ESTIMATE_ELAPSED:
    "Obtain a current readiness estimate; the previous one has passed.",
  MISSING_READY_ESTIMATE:
    "Add a current readiness estimate if one is available.",
  EXPIRED_EVIDENCE: "Refresh this evidence; its validity window has ended.",
  UNKNOWN_EVIDENCE_VALIDITY:
    "Provide a validity end time for this evidence so it can be trusted.",
  FUTURE_DATED_EVIDENCE:
    "Correct the observation time; it is later than the server evaluation time.",
  CONTRADICTORY_OPERATIONAL_STATE:
    "Reconcile the blocked fulfillment state with the report that no blocker is known.",
};

export const impactLabels = {
  supporting: "Supporting",
  adverse: "Adverse",
  uncertain: "Uncertain or missing",
} as const;

export const reviewReasonLabels: Record<string, string> = {
  PROMISEGUARD_AT_RISK: "The assessment is at risk",
  PROMISEGUARD_EVIDENCE_CONFLICT: "The evidence conflicts",
  PROMISEGUARD_EVIDENCE_INCOMPLETE: "The evidence is incomplete",
};

export const actionLabels: Record<PromiseGuardActionCode, string> = {
  verify_inventory_allocation: "Verify inventory allocation",
  obtain_current_readiness_estimate: "Obtain a current readiness estimate",
  resolve_identified_blocker: "Resolve the identified blocker",
  escalate_to_fulfillment_lead: "Escalate to the fulfillment lead",
  reassess_customer_facing_commitment:
    "Reassess the customer-facing commitment",
};

export const inferenceUnavailableCopy: Record<
  InferenceUnavailableReason,
  string
> = {
  configuration: "AI assistance is not enabled in this environment.",
  timeout: "The AI service did not respond in time.",
  rate_limited: "The AI service is rate limited right now.",
  provider_unavailable: "The AI service is unavailable.",
  malformed_output: "The AI output did not pass validation and was discarded.",
};

export const analysisStatusCopy = {
  complete: "Complete",
  limited: "Limited",
  needs_review: "Needs review",
} as const;

export const analysisStatusExplanation: Record<
  PromiseGuardEvaluationResponse["analysisStatus"],
  string
> = {
  complete: "All analysis sections were produced.",
  limited:
    "Some analysis output is unavailable, for example AI assistance. This is independent of the business assessment.",
  needs_review:
    "Analysis output was produced and human review is required. This restates the review policy, not a different assessment.",
};

export const scenarioOptions: ReadonlyArray<{
  id: PromiseGuardPresetId;
  ordinal: number;
  title: string;
  description: string;
  intent: string;
}> = [
  {
    id: "supported",
    ordinal: 1,
    title: "Aligned evidence",
    description:
      "Inventory is secured, no blocker is known, and a readiness estimate falls before the dispatch deadline.",
    intent: "Designed to show a supported assessment",
  },
  {
    id: "at_risk",
    ordinal: 2,
    title: "Adverse evidence",
    description:
      "Inventory is not secured, fulfillment is blocked by an active blocker, and the readiness estimate falls after the deadline.",
    intent: "Designed to show an at-risk assessment",
  },
  {
    id: "indeterminate",
    ordinal: 3,
    title: "Incomplete evidence",
    description:
      "Inventory and blocker states are unknown, their validity is not stated, and no readiness estimate is provided.",
    intent: "Designed to show an indeterminate assessment",
  },
];
