"use client";

import type { MarginLeakEvaluationResponse } from "@commerceos/contracts";
import {
  assessmentBannerCopy,
  completenessLabels,
  observationStateLabels,
} from "./labels";

type AssessmentBannerProps = {
  response: MarginLeakEvaluationResponse;
};

export function AssessmentBanner({ response }: AssessmentBannerProps) {
  const { data } = response.deterministic;
  const copy = assessmentBannerCopy[data.assessment];

  return (
    <div
      className={`ml-assessment-banner ml-assessment-${copy.tone}`}
      data-assessment={data.assessment}
    >
      <div className="ml-assessment-meta-row">
        <span className={`status-pill status-${copy.tone}`}>
          <span aria-hidden="true">{copy.icon}</span> {copy.badge}
        </span>
        <span className="ml-meta-chip">
          Status: <code>{response.analysisStatus}</code>
        </span>
        <span className="ml-meta-chip">
          Completeness:{" "}
          <strong>{completenessLabels[data.evidenceCompleteness]}</strong>
        </span>
        <span className="ml-meta-chip">
          Finality:{" "}
          <strong>{observationStateLabels[data.observationState]}</strong>
        </span>
        <span className="ml-meta-chip">
          Order: <code>{data.orderRef}</code> ({data.currency})
        </span>
      </div>

      <h3 className="ml-assessment-headline">{copy.headline}</h3>
      <p className="ml-assessment-subheadline">{copy.subheadline}</p>
    </div>
  );
}
