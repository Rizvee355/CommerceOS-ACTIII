"use client";

import type { PromiseGuardEvaluationResponse } from "@commerceos/contracts";
import { reviewReasonLabels } from "./labels";

export type HumanReviewPanelProps = {
  humanReview: PromiseGuardEvaluationResponse["humanReview"];
};

export const HumanReviewPanel = ({ humanReview }: HumanReviewPanelProps) => {
  return (
    <section
      aria-labelledby="pg-review-heading"
      className="pg-review-panel"
      data-required={humanReview.required}
    >
      <div className="pg-review-header">
        <div className="pg-review-badge" data-required={humanReview.required}>
          {humanReview.required ? "Review Required" : "No Review Required"}
        </div>
        <h3 id="pg-review-heading" className="pg-review-title">
          {humanReview.required
            ? "Human Operational Review Flagged"
            : "Automated Review Status: Clear"}
        </h3>
      </div>

      <div className="pg-review-body">
        {humanReview.required ? (
          <>
            <p className="pg-review-desc">
              Deterministic governance rules flagged this evaluation for human
              investigation before taking dispatch actions. Review reasons:
            </p>
            <ul className="pg-review-reasons">
              {humanReview.reasonCodes.map((code) => (
                <li key={code} className="pg-review-reason-item">
                  <span className="pg-code-pill">{code}</span>
                  <span className="pg-reason-label">
                    {reviewReasonLabels[code] || code}
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="pg-review-desc">
            All evidence satisfies deterministic criteria. No manual
            intervention or escalation is requested by the current governance
            policy.
          </p>
        )}

        <div className="pg-review-meta">
          <span>
            Decided by: <strong>{humanReview.decidedBy}</strong>
          </span>
          <span className="pg-meta-sep">•</span>
          <span>
            Policy version: <code>{humanReview.policyVersion}</code>
          </span>
        </div>
      </div>
    </section>
  );
};
