"use client";

import type {
  PromiseGuardEvaluationRequest,
  PromiseGuardEvaluationResponse,
} from "@commerceos/contracts";
import type { Ref } from "react";
import { AiPanel } from "./ai-panel";
import { AssessmentBanner } from "./assessment-banner";
import { FindingsList } from "./findings-list";
import type { FieldKey } from "./form-model";
import { HumanReviewPanel } from "./human-review-panel";
import { ProvenanceFooter } from "./provenance-footer";

export type ResultViewProps = {
  response: PromiseGuardEvaluationResponse;
  request: PromiseGuardEvaluationRequest;
  headingRef?: Ref<HTMLHeadingElement>;
  onReviseEvidence: () => void;
  onFocusField: (key: FieldKey) => void;
};

export const ResultView = ({
  response,
  request,
  headingRef,
  onReviseEvidence,
  onFocusField,
}: ResultViewProps) => {
  return (
    <div className="pg-results-container" id="pg-results-view">
      <div className="pg-results-actions-top">
        <h2
          id="pg-results-heading"
          className="pg-results-title"
          tabIndex={-1}
          ref={headingRef}
        >
          Evaluation Results
        </h2>
        <button
          type="button"
          onClick={onReviseEvidence}
          className="pg-button pg-button-secondary"
        >
          ← Edit Evidence Facts
        </button>
      </div>

      <AssessmentBanner
        assessment={response.deterministic.data.assessment}
        analysisStatus={response.analysisStatus}
        deterministic={response.deterministic}
      />

      <div className="pg-results-grid">
        <div className="pg-results-main">
          <FindingsList
            findings={response.deterministic.data.findings}
            request={request}
            onFocusField={onFocusField}
          />
        </div>

        <div className="pg-results-sidebar">
          <HumanReviewPanel humanReview={response.humanReview} />
          <AiPanel
            inference={response.inference}
            aiRecommendation={response.aiRecommendation}
          />
        </div>
      </div>

      <ProvenanceFooter response={response} />

      <div className="pg-results-actions-bottom">
        <button
          type="button"
          onClick={onReviseEvidence}
          className="pg-button pg-button-primary"
        >
          Modify Evidence & Re-evaluate
        </button>
      </div>
    </div>
  );
};
