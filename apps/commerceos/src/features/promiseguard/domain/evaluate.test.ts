import {
  promiseGuardEvaluationRequestSchema,
  type PromiseGuardEvaluationRequest,
} from "@commerceos/contracts";
import { describe, expect, it } from "vitest";

import { evaluatePromiseGuard } from "./evaluate";

const asOf = new Date("2026-10-15T09:00:00.000Z");

const supportedRequest = (): PromiseGuardEvaluationRequest =>
  promiseGuardEvaluationRequestSchema.parse({
    schemaVersion: "1.0",
    moduleId: "promiseguard",
    scenario: { scenarioId: "pg-supported", synthetic: true },
    fulfillmentRef: "FUL-SYN-001",
    commitment: {
      evidenceId: "ev-commitment",
      kind: "dispatch_by",
      dispatchBy: "2026-10-15T15:00:00.000Z",
    },
    operationalEvidence: {
      inventoryAllocation: {
        evidenceId: "ev-inventory",
        origin: "synthetic_fixture",
        observedAt: "2026-10-15T08:30:00.000Z",
        validUntil: "2026-10-15T15:30:00.000Z",
        status: "secured",
      },
      fulfillmentState: {
        evidenceId: "ev-fulfillment",
        origin: "synthetic_fixture",
        observedAt: "2026-10-15T08:35:00.000Z",
        validUntil: "2026-10-15T15:30:00.000Z",
        state: "in_progress",
      },
      blockingState: {
        evidenceId: "ev-blocker",
        origin: "synthetic_fixture",
        observedAt: "2026-10-15T08:40:00.000Z",
        validUntil: "2026-10-15T15:30:00.000Z",
        status: "none_known",
        codes: [],
      },
      readyTimeEstimate: {
        evidenceId: "ev-estimate",
        origin: "synthetic_fixture",
        observedAt: "2026-10-15T08:45:00.000Z",
        validUntil: "2026-10-15T13:00:00.000Z",
        estimatedReadyAt: "2026-10-15T12:30:00.000Z",
      },
    },
  });

const codes = (request: PromiseGuardEvaluationRequest) =>
  evaluatePromiseGuard(request, asOf).deterministic.data.findings.map(
    ({ code }) => code,
  );

describe("PromiseGuard deterministic evaluator", () => {
  it("supports a current secured and unblocked fulfillment with a viable estimate", () => {
    const result = evaluatePromiseGuard(supportedRequest(), asOf);

    expect(result.deterministic.data).toMatchObject({
      assessment: "supported",
      evidenceCompleteness: "complete",
      derived: { deadlineState: "open", readyByDeadline: true },
    });
    expect(result.humanReview).toMatchObject({
      required: false,
      reasonCodes: [],
    });
    expect(result.deterministic.data.findings.map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        "DISPATCH_DEADLINE_OPEN",
        "INVENTORY_SECURED",
        "NO_ACTIVE_BLOCKERS",
        "READY_ESTIMATE_WITHIN_DEADLINE",
      ]),
    );
  });

  it("lets a current adverse fact outrank unrelated unknown evidence", () => {
    const request = supportedRequest();
    request.operationalEvidence.inventoryAllocation.status = "not_secured";
    request.operationalEvidence.blockingState.status = "unknown";

    const result = evaluatePromiseGuard(request, asOf);
    expect(result.deterministic.data.assessment).toBe("at_risk");
    expect(result.deterministic.data.evidenceCompleteness).toBe("incomplete");
    expect(result.humanReview.required).toBe(true);
    expect(codes(request)).toEqual(
      expect.arrayContaining([
        "INVENTORY_NOT_SECURED",
        "UNKNOWN_BLOCKER_STATE",
      ]),
    );
  });

  it("does not treat an expired adverse inventory snapshot as current risk", () => {
    const request = supportedRequest();
    request.operationalEvidence.inventoryAllocation.status = "not_secured";
    request.operationalEvidence.inventoryAllocation.validUntil =
      "2026-10-15T09:00:00.000Z";

    const result = evaluatePromiseGuard(request, asOf);
    expect(result.deterministic.data.assessment).toBe("indeterminate");
    expect(codes(request)).toContain("EXPIRED_EVIDENCE");
    expect(codes(request)).not.toContain("INVENTORY_NOT_SECURED");
  });

  it("treats a same-time or elapsed dispatch deadline as independently at risk", () => {
    for (const dispatchBy of [
      "2026-10-15T09:00:00.000Z",
      "2026-10-15T08:59:59.999Z",
    ]) {
      const request = supportedRequest();
      request.commitment.dispatchBy = dispatchBy;
      const result = evaluatePromiseGuard(request, asOf);
      expect(result.deterministic.data.assessment).toBe("at_risk");
      expect(result.deterministic.data.derived.deadlineState).toBe("elapsed");
      expect(codes(request)).toContain("DISPATCH_DEADLINE_ELAPSED");
    }
  });

  it("marks an elapsed or expired readiness estimate without inventing facts", () => {
    const elapsed = supportedRequest();
    elapsed.operationalEvidence.readyTimeEstimate!.estimatedReadyAt =
      "2026-10-15T08:59:59.999Z";
    expect(
      evaluatePromiseGuard(elapsed, asOf).deterministic.data.assessment,
    ).toBe("at_risk");
    expect(codes(elapsed)).toContain("READY_ESTIMATE_ELAPSED");

    const expired = supportedRequest();
    expired.operationalEvidence.readyTimeEstimate!.validUntil =
      "2026-10-15T09:00:00.000Z";
    expect(
      evaluatePromiseGuard(expired, asOf).deterministic.data.assessment,
    ).toBe("indeterminate");
    expect(codes(expired)).toContain("EXPIRED_EVIDENCE");
    expect(codes(expired)).not.toContain("READY_ESTIMATE_WITHIN_DEADLINE");
  });

  it("does not treat an elapsed estimate as adverse without current unfinished fulfillment evidence", () => {
    const request = supportedRequest();
    request.operationalEvidence.fulfillmentState.validUntil =
      "2026-10-15T09:00:00.000Z";
    request.operationalEvidence.readyTimeEstimate!.estimatedReadyAt =
      "2026-10-15T08:59:59.999Z";

    const result = evaluatePromiseGuard(request, asOf);
    const estimateFinding = result.deterministic.data.findings.find(
      ({ code }) => code === "READY_ESTIMATE_ELAPSED",
    );

    expect(result.deterministic.data.assessment).toBe("indeterminate");
    expect(result.deterministic.data.derived.readyByDeadline).toBeNull();
    expect(estimateFinding?.impact).toBe("uncertain");
  });

  it("accepts a current readiness estimate exactly at the dispatch deadline", () => {
    const request = supportedRequest();
    request.operationalEvidence.readyTimeEstimate!.estimatedReadyAt =
      request.commitment.dispatchBy;

    const result = evaluatePromiseGuard(request, asOf);
    expect(result.deterministic.data.assessment).toBe("supported");
    expect(codes(request)).toContain("READY_ESTIMATE_WITHIN_DEADLINE");
  });

  it("traces a missing readiness estimate to its field path", () => {
    const request = supportedRequest();
    delete request.operationalEvidence.readyTimeEstimate;

    const result = evaluatePromiseGuard(request, asOf);
    const finding = result.deterministic.data.findings.find(
      ({ code }) => code === "MISSING_READY_ESTIMATE",
    );
    expect(result.deterministic.data.assessment).toBe("indeterminate");
    expect(finding).toEqual({
      code: "MISSING_READY_ESTIMATE",
      impact: "uncertain",
      trace: {
        kind: "field_path",
        fieldPaths: ["/operationalEvidence/readyTimeEstimate"],
      },
    });
  });

  it("reports future observations and contradictory current states", () => {
    const future = supportedRequest();
    future.operationalEvidence.inventoryAllocation.observedAt =
      "2026-10-15T09:00:00.001Z";
    expect(
      evaluatePromiseGuard(future, asOf).deterministic.data.assessment,
    ).toBe("indeterminate");
    expect(codes(future)).toContain("FUTURE_DATED_EVIDENCE");

    const contradictory = supportedRequest();
    contradictory.operationalEvidence.fulfillmentState.state = "blocked";
    const result = evaluatePromiseGuard(contradictory, asOf);
    expect(result.deterministic.data.assessment).toBe("at_risk");
    expect(result.deterministic.data.evidenceCompleteness).toBe("conflicted");
    expect(codes(contradictory)).toContain("CONTRADICTORY_OPERATIONAL_STATE");
  });

  it("ignores a conflicting readiness estimate once current evidence says ready", () => {
    for (const validUntil of [
      "2026-10-15T15:30:00.000Z",
      "2026-10-15T09:00:00.000Z",
    ]) {
      const request = supportedRequest();
      request.operationalEvidence.fulfillmentState.state = "ready";
      request.operationalEvidence.readyTimeEstimate!.estimatedReadyAt =
        "2026-10-15T17:00:00.000Z";
      request.operationalEvidence.readyTimeEstimate!.validUntil = validUntil;

      const result = evaluatePromiseGuard(request, asOf);
      expect(result.deterministic.data.assessment).toBe("supported");
      expect(codes(request)).toContain("READY_ESTIMATE_IGNORED_AFTER_READY");
      expect(codes(request)).not.toContain("READY_ESTIMATE_AFTER_DEADLINE");
    }
  });

  it("returns repeatable output and traceable evidence references", () => {
    const request = supportedRequest();
    const first = evaluatePromiseGuard(request, asOf);
    const second = evaluatePromiseGuard(request, asOf);

    expect(first).toEqual(second);
    expect(first.deterministic.evidenceRefs).toEqual(
      expect.arrayContaining([
        {
          evidenceId: "ev-commitment",
          factPath: "/commitment/dispatchBy",
          sourceKind: "synthetic_fixture",
        },
        {
          evidenceId: "ev-inventory",
          factPath: "/operationalEvidence/inventoryAllocation",
          sourceKind: "synthetic_fixture",
        },
      ]),
    );
  });
});
