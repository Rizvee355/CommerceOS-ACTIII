"use client";

import type {
  PromiseGuardAssessment,
  PromiseGuardEvaluationResponse,
} from "@commerceos/contracts";
import {
  analysisStatusCopy,
  analysisStatusExplanation,
  assessmentPresentation,
  completenessLabels,
  deadlineLabels,
  readyByDeadlineLabel,
} from "./labels";

export type AssessmentBannerProps = {
  assessment: PromiseGuardAssessment;
  analysisStatus: PromiseGuardEvaluationResponse["analysisStatus"];
  deterministic: PromiseGuardEvaluationResponse["deterministic"];
};

export const AssessmentBanner = ({
  assessment,
  analysisStatus,
  deterministic,
}: AssessmentBannerProps) => {
  const presentation = assessmentPresentation[assessment];
  const { data, rulesetVersion } = deterministic;
  const summary = `Evaluated against ruleset ${rulesetVersion} with ${data.findings.length} operational finding${data.findings.length === 1 ? "" : "s"}.`;

  return (
    <div
      className="pg-assessment-banner"
      data-assessment={assessment}
      aria-labelledby="pg-assessment-title"
    >
      <div className="pg-assessment-header">
        <div className="pg-assessment-badge-group">
          <span className="pg-assessment-badge" data-assessment={assessment}>
            <span className="pg-assessment-icon" aria-hidden="true">
              {presentation.icon}
            </span>
            <span className="pg-assessment-name">{presentation.label}</span>
          </span>

          <span
            className="pg-envelope-status-badge"
            data-envelope={analysisStatus}
            title={analysisStatusExplanation[analysisStatus]}
          >
            Envelope: {analysisStatusCopy[analysisStatus]}
          </span>
        </div>

        <h3 id="pg-assessment-title" className="pg-assessment-headline">
          {presentation.headline}
        </h3>
      </div>

      <div className="pg-assessment-body">
        <p className="pg-assessment-summary">{summary}</p>
        <p className="pg-assessment-disclaimer">{presentation.explanation}</p>
      </div>

      <div
        className="pg-assessment-pills"
        aria-label="Deterministic operational state"
      >
        <div className="pg-state-pill">
          <span className="pg-pill-label">Evidence completeness</span>
          <span className="pg-pill-value" data-val={data.evidenceCompleteness}>
            {completenessLabels[data.evidenceCompleteness]}
          </span>
        </div>

        <div className="pg-state-pill">
          <span className="pg-pill-label">Dispatch deadline</span>
          <span className="pg-pill-value" data-val={data.derived.deadlineState}>
            {deadlineLabels[data.derived.deadlineState]}
          </span>
        </div>

        <div className="pg-state-pill">
          <span className="pg-pill-label">Readiness timeline</span>
          <span className="pg-pill-value">
            {readyByDeadlineLabel(data.derived.readyByDeadline)}
          </span>
        </div>
      </div>
    </div>
  );
};
