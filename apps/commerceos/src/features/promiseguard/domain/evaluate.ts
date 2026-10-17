import type {
  EvidenceRef,
  HumanReviewMetadata,
  PromiseGuardDeterministicData,
  PromiseGuardEvaluationRequest,
  PromiseGuardFinding,
} from "@commerceos/contracts";

export const PROMISE_GUARD_RULESET_VERSION =
  "promiseguard-dispatch-1.0.0" as const;
export const PROMISE_GUARD_REVIEW_POLICY_VERSION =
  "promiseguard-review-1.0.0" as const;

type Snapshot =
  | PromiseGuardEvaluationRequest["operationalEvidence"]["inventoryAllocation"]
  | PromiseGuardEvaluationRequest["operationalEvidence"]["fulfillmentState"]
  | PromiseGuardEvaluationRequest["operationalEvidence"]["blockingState"]
  | NonNullable<
      PromiseGuardEvaluationRequest["operationalEvidence"]["readyTimeEstimate"]
    >;

type EvaluationResult = {
  deterministic: {
    data: PromiseGuardDeterministicData;
    rulesetVersion: typeof PROMISE_GUARD_RULESET_VERSION;
    evidenceRefs: EvidenceRef[];
  };
  humanReview: HumanReviewMetadata;
};

const evidenceFinding = (
  code: PromiseGuardFinding["code"],
  impact: PromiseGuardFinding["impact"],
  ...evidenceIds: string[]
): PromiseGuardFinding => ({
  code,
  impact,
  trace: { kind: "evidence", evidenceIds },
});

const fieldFinding = (
  code: PromiseGuardFinding["code"],
  ...fieldPaths: string[]
): PromiseGuardFinding => ({
  code,
  impact: "uncertain",
  trace: { kind: "field_path", fieldPaths },
});

const assessSnapshot = (
  snapshot: Snapshot,
  asOfMs: number,
): { current: boolean; finding?: PromiseGuardFinding } => {
  if (Date.parse(snapshot.observedAt) > asOfMs) {
    return {
      current: false,
      finding: evidenceFinding(
        "FUTURE_DATED_EVIDENCE",
        "uncertain",
        snapshot.evidenceId,
      ),
    };
  }
  if (snapshot.validUntil === null) {
    return {
      current: false,
      finding: evidenceFinding(
        "UNKNOWN_EVIDENCE_VALIDITY",
        "uncertain",
        snapshot.evidenceId,
      ),
    };
  }
  if (Date.parse(snapshot.validUntil) <= asOfMs) {
    return {
      current: false,
      finding: evidenceFinding(
        "EXPIRED_EVIDENCE",
        "uncertain",
        snapshot.evidenceId,
      ),
    };
  }
  return { current: true };
};

const evidenceRefsFor = (
  request: PromiseGuardEvaluationRequest,
): EvidenceRef[] => {
  const refs: EvidenceRef[] = [
    {
      evidenceId: request.commitment.evidenceId,
      factPath: "/commitment/dispatchBy",
      sourceKind: "synthetic_fixture",
    },
    {
      evidenceId: request.operationalEvidence.inventoryAllocation.evidenceId,
      factPath: "/operationalEvidence/inventoryAllocation",
      sourceKind: "synthetic_fixture",
    },
    {
      evidenceId: request.operationalEvidence.fulfillmentState.evidenceId,
      factPath: "/operationalEvidence/fulfillmentState",
      sourceKind: "synthetic_fixture",
    },
    {
      evidenceId: request.operationalEvidence.blockingState.evidenceId,
      factPath: "/operationalEvidence/blockingState",
      sourceKind: "synthetic_fixture",
    },
  ];
  if (request.operationalEvidence.readyTimeEstimate) {
    refs.push({
      evidenceId: request.operationalEvidence.readyTimeEstimate.evidenceId,
      factPath: "/operationalEvidence/readyTimeEstimate",
      sourceKind: "synthetic_fixture",
    });
  }
  return refs;
};

export const evaluatePromiseGuard = (
  request: PromiseGuardEvaluationRequest,
  asOf: Date,
): EvaluationResult => {
  const asOfMs = asOf.getTime();
  const deadlineMs = Date.parse(request.commitment.dispatchBy);
  const findings: PromiseGuardFinding[] = [];
  let conflicted = false;
  let readyByDeadline: boolean | null = null;

  const deadlineElapsed = deadlineMs <= asOfMs;
  findings.push(
    evidenceFinding(
      deadlineElapsed ? "DISPATCH_DEADLINE_ELAPSED" : "DISPATCH_DEADLINE_OPEN",
      deadlineElapsed ? "adverse" : "supporting",
      request.commitment.evidenceId,
    ),
  );

  const inventory = request.operationalEvidence.inventoryAllocation;
  const inventoryAssessment = assessSnapshot(inventory, asOfMs);
  if (inventoryAssessment.finding) findings.push(inventoryAssessment.finding);
  if (inventoryAssessment.current) {
    if (inventory.status === "secured") {
      findings.push(
        evidenceFinding(
          "INVENTORY_SECURED",
          "supporting",
          inventory.evidenceId,
        ),
      );
    } else if (inventory.status === "not_secured") {
      findings.push(
        evidenceFinding(
          "INVENTORY_NOT_SECURED",
          "adverse",
          inventory.evidenceId,
        ),
      );
    } else {
      findings.push(
        evidenceFinding(
          "UNKNOWN_INVENTORY_STATE",
          "uncertain",
          inventory.evidenceId,
        ),
      );
    }
  }

  const fulfillment = request.operationalEvidence.fulfillmentState;
  const fulfillmentAssessment = assessSnapshot(fulfillment, asOfMs);
  if (fulfillmentAssessment.finding)
    findings.push(fulfillmentAssessment.finding);
  if (fulfillmentAssessment.current) {
    if (fulfillment.state === "ready") {
      findings.push(
        evidenceFinding(
          "FULFILLMENT_READY",
          "supporting",
          fulfillment.evidenceId,
        ),
      );
      readyByDeadline = deadlineElapsed ? null : true;
    } else if (fulfillment.state === "blocked") {
      findings.push(
        evidenceFinding(
          "FULFILLMENT_BLOCKED",
          "adverse",
          fulfillment.evidenceId,
        ),
      );
    } else if (fulfillment.state === "unknown") {
      findings.push(
        evidenceFinding(
          "UNKNOWN_FULFILLMENT_STATE",
          "uncertain",
          fulfillment.evidenceId,
        ),
      );
    }
  }

  const blocking = request.operationalEvidence.blockingState;
  const blockingAssessment = assessSnapshot(blocking, asOfMs);
  if (blockingAssessment.finding) findings.push(blockingAssessment.finding);
  if (blockingAssessment.current) {
    if (blocking.status === "none_known") {
      findings.push(
        evidenceFinding(
          "NO_ACTIVE_BLOCKERS",
          "supporting",
          blocking.evidenceId,
        ),
      );
    } else if (blocking.status === "active") {
      findings.push(
        evidenceFinding(
          "ACTIVE_BLOCKER_REPORTED",
          "adverse",
          blocking.evidenceId,
        ),
      );
    } else {
      findings.push(
        evidenceFinding(
          "UNKNOWN_BLOCKER_STATE",
          "uncertain",
          blocking.evidenceId,
        ),
      );
    }
  }

  if (
    fulfillmentAssessment.current &&
    blockingAssessment.current &&
    fulfillment.state === "blocked" &&
    blocking.status === "none_known"
  ) {
    conflicted = true;
    findings.push(
      evidenceFinding(
        "CONTRADICTORY_OPERATIONAL_STATE",
        "uncertain",
        fulfillment.evidenceId,
        blocking.evidenceId,
      ),
    );
  }

  const estimate = request.operationalEvidence.readyTimeEstimate;
  if (fulfillmentAssessment.current && fulfillment.state === "ready") {
    if (estimate) {
      findings.push(
        evidenceFinding(
          "READY_ESTIMATE_IGNORED_AFTER_READY",
          "supporting",
          fulfillment.evidenceId,
          estimate.evidenceId,
        ),
      );
    }
  } else if (!estimate) {
    findings.push(
      fieldFinding(
        "MISSING_READY_ESTIMATE",
        "/operationalEvidence/readyTimeEstimate",
      ),
    );
  } else {
    const estimateAssessment = assessSnapshot(estimate, asOfMs);
    if (estimateAssessment.finding) findings.push(estimateAssessment.finding);
    if (estimateAssessment.current) {
      const estimatedReadyMs = Date.parse(estimate.estimatedReadyAt);
      if (estimatedReadyMs <= asOfMs) {
        const currentlyUnfinished =
          fulfillmentAssessment.current &&
          (fulfillment.state === "not_started" ||
            fulfillment.state === "in_progress" ||
            fulfillment.state === "blocked");
        readyByDeadline = currentlyUnfinished ? false : null;
        findings.push(
          evidenceFinding(
            "READY_ESTIMATE_ELAPSED",
            currentlyUnfinished ? "adverse" : "uncertain",
            estimate.evidenceId,
            fulfillment.evidenceId,
          ),
        );
      } else if (estimatedReadyMs > deadlineMs) {
        readyByDeadline = false;
        findings.push(
          evidenceFinding(
            "READY_ESTIMATE_AFTER_DEADLINE",
            "adverse",
            estimate.evidenceId,
            request.commitment.evidenceId,
          ),
        );
      } else {
        readyByDeadline = true;
        findings.push(
          evidenceFinding(
            "READY_ESTIMATE_WITHIN_DEADLINE",
            "supporting",
            estimate.evidenceId,
            request.commitment.evidenceId,
          ),
        );
      }
    }
  }

  const hasAdverse = findings.some(({ impact }) => impact === "adverse");
  const hasUncertainty = findings.some(({ impact }) => impact === "uncertain");
  const assessment = hasAdverse
    ? "at_risk"
    : hasUncertainty || conflicted
      ? "indeterminate"
      : "supported";
  const evidenceCompleteness = conflicted
    ? "conflicted"
    : hasUncertainty
      ? "incomplete"
      : "complete";
  const reviewRequired = assessment !== "supported";
  const reasonCodes = reviewRequired
    ? [
        assessment === "at_risk"
          ? "PROMISEGUARD_AT_RISK"
          : conflicted
            ? "PROMISEGUARD_EVIDENCE_CONFLICT"
            : "PROMISEGUARD_EVIDENCE_INCOMPLETE",
      ]
    : [];

  return {
    deterministic: {
      data: {
        assessment,
        decisionScope: "dispatch_readiness_not_delivery_guarantee",
        evidenceCompleteness,
        findings,
        derived: {
          deadlineState: deadlineElapsed ? "elapsed" : "open",
          readyByDeadline,
        },
      },
      rulesetVersion: PROMISE_GUARD_RULESET_VERSION,
      evidenceRefs: evidenceRefsFor(request),
    },
    humanReview: {
      required: reviewRequired,
      reasonCodes,
      decidedBy: "deterministic_policy",
      policyVersion: PROMISE_GUARD_REVIEW_POLICY_VERSION,
    },
  };
};
