"use client";

import type { RefObject } from "react";
import type { MarginLeakEvaluationResponse } from "@commerceos/contracts";
import { AiBoundaryPanel } from "./ai-boundary-panel";
import { AssessmentBanner } from "./assessment-banner";
import { CategoryComparisonTable } from "./category-comparison-table";
import { ContributionTotalsStrip } from "./contribution-totals-strip";
import { FindingsList } from "./findings-list";
import type { MarginLeakFieldKey } from "./form-model";
import { HumanReviewPanel } from "./human-review-panel";
import { ProvenanceFooter } from "./provenance-footer";

type ResultViewProps = {
  headingRef: RefObject<HTMLHeadingElement | null>;
  response: MarginLeakEvaluationResponse;
  onJumpToField: (key: MarginLeakFieldKey) => void;
};

export function ResultView({
  headingRef,
  response,
  onJumpToField,
}: ResultViewProps) {
  const { data } = response.deterministic;

  return (
    <section
      className="ml-results-container"
      aria-labelledby="ml-results-heading"
    >
      <div className="ml-section-header">
        <div>
          <p className="eyebrow">
            Step 3 · Deterministic Reconciliation Output
          </p>
          <h2
            id="ml-results-heading"
            ref={headingRef}
            tabIndex={-1}
            className="ml-section-title"
          >
            Contribution-margin evaluation results
          </h2>
        </div>
      </div>

      <AssessmentBanner response={response} />

      <ContributionTotalsStrip
        data={data}
        scenarioId={response.scenario.scenarioId}
      />

      <CategoryComparisonTable data={data} onJumpToField={onJumpToField} />

      <FindingsList findings={data.findings} onJumpToField={onJumpToField} />

      <div className="ml-governance-grid">
        <HumanReviewPanel humanReview={response.humanReview} />
        <AiBoundaryPanel
          rulesetVersion={response.deterministic.rulesetVersion}
        />
      </div>

      <ProvenanceFooter response={response} />
    </section>
  );
}
