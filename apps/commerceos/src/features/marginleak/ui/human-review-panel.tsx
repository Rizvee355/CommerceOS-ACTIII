"use client";

import type { HumanReviewMetadata } from "@commerceos/contracts";
import { reviewReasonLabels } from "./labels";

type HumanReviewPanelProps = {
  humanReview: HumanReviewMetadata;
};

export function HumanReviewPanel({ humanReview }: HumanReviewPanelProps) {
  return (
    <section
      className="ml-governance-card"
      aria-labelledby="ml-human-review-heading"
    >
      <div className="ml-governance-top">
        <span
          className={`status-pill status-${humanReview.required ? "waiting" : "ready"}`}
        >
          {humanReview.required
            ? "Human Review Required"
            : "No Review Required"}
        </span>
        <span className="ml-meta-chip">
          Policy: <code>{humanReview.policyVersion}</code>
        </span>
      </div>

      <h3 id="ml-human-review-heading" className="ml-governance-title">
        Deterministic human-review gate
      </h3>
      <p className="ml-governance-copy">
        Review routing is decided strictly by{" "}
        <code>{humanReview.decidedBy}</code>. Only complete, final evaluations
        with zero net leakage (<code>no_leak_detected</code>) bypass mandatory
        operator review.
      </p>

      {humanReview.reasonCodes.length > 0 ? (
        <ul className="ml-reason-list">
          {humanReview.reasonCodes.map((code) => {
            const detail = reviewReasonLabels[code] ?? {
              title: code,
              explanation:
                "Deterministic policy triggered mandatory human operator review.",
            };
            return (
              <li key={code} className="ml-reason-item">
                <div className="ml-reason-item-header">
                  <strong>{detail.title}</strong>
                  <code className="ml-code-badge">{code}</code>
                </div>
                <p>{detail.explanation}</p>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="ml-reason-clear">
          <p>
            <strong>Zero review triggers:</strong> All 16 financial observations
            are present, settled as <code>final</code>, and observed
            contribution margin met or exceeded expected margin.
          </p>
        </div>
      )}
    </section>
  );
}
