"use client";

import type {
  PromiseGuardAiMitigationOutput,
  PromiseGuardEvaluationResponse,
} from "@commerceos/contracts";
import { actionLabels, inferenceUnavailableCopy } from "./labels";

export type AiPanelProps = {
  inference: PromiseGuardEvaluationResponse["inference"];
  aiRecommendation?: PromiseGuardAiMitigationOutput;
};

export const AiPanel = ({ inference, aiRecommendation }: AiPanelProps) => {
  if (inference.status === "unavailable") {
    const reasonText =
      inferenceUnavailableCopy[inference.reasonCode] || inference.reasonCode;

    return (
      <section
        aria-labelledby="pg-ai-heading"
        className="pg-ai-panel is-unavailable"
      >
        <div className="pg-section-intro">
          <div className="pg-ai-status-row">
            <span className="pg-status-tag" data-state="disabled">
              Inference Offline
            </span>
            <span className="pg-ai-reason-code">
              Reason: <code>{inference.reasonCode}</code>
            </span>
          </div>
          <h3 id="pg-ai-heading" className="pg-section-title">
            AI Operational Explanation
          </h3>
          <p className="pg-ai-unavailable-msg">{reasonText}</p>
        </div>

        <div className="pg-ai-truth-banner">
          <p>
            <strong>Truthful Inference Guarantee:</strong> When AI inference is
            disabled or unavailable, CommerceOS does not fabricate synthetic
            explanations or invent metrics. Deterministic rules remain fully
            functional and authoritative.
          </p>
        </div>
      </section>
    );
  }

  const isSynthetic = inference.provenance === "synthetic_mock";

  // G0 authenticated AMD hardware verification remains blocked. Broad string
  // prefixes like `amd-*` are strictly disallowed. All live inference providers
  // receive neutral branding until an exact, verified AMD adapter identity is
  // approved by the Control Room.
  const APPROVED_AMD_ADAPTER_ID: string | null = null;
  const isAuthorizedAmd =
    !isSynthetic &&
    APPROVED_AMD_ADAPTER_ID !== null &&
    inference.providerId === APPROVED_AMD_ADAPTER_ID;

  const providerLabel = isSynthetic
    ? "Synthetic Mock"
    : isAuthorizedAmd
      ? "AMD Instinct Accelerated"
      : "Live Inference Provider";

  const providerTone = isSynthetic
    ? "preview"
    : isAuthorizedAmd
      ? "ready"
      : "neutral";

  return (
    <section
      aria-labelledby="pg-ai-heading"
      className="pg-ai-panel is-available"
    >
      <div className="pg-section-intro">
        <div className="pg-ai-status-row">
          <span className="pg-status-tag" data-tone={providerTone}>
            {providerLabel}
          </span>
          <span className="pg-ai-runtime-spec">
            {inference.providerId} • {inference.modelId} •{" "}
            {inference.durationMs}ms
          </span>
        </div>

        <h3 id="pg-ai-heading" className="pg-section-title">
          AI Operational Explanation & Mitigations
        </h3>
        <p className="pg-section-hint">
          Model-assisted explanation of detected risks and suggested operational
          mitigations.
        </p>
      </div>

      {aiRecommendation && (
        <div className="pg-ai-content">
          <div className="pg-ai-summary-card">
            <h4 className="pg-card-subheading">Operational Summary</h4>
            <p className="pg-ai-summary-text">
              {aiRecommendation.data.operationalSummary}
            </p>
            <div className="pg-ai-reasoning-details">
              <span className="pg-meta-label">Reasoning synopsis:</span>{" "}
              {aiRecommendation.reasoningSummary}
            </div>
          </div>

          {aiRecommendation.data.actions.length > 0 && (
            <div className="pg-ai-actions-group">
              <h4 className="pg-card-subheading">
                Suggested Mitigations ({aiRecommendation.data.actions.length})
              </h4>
              <ol className="pg-ai-actions-list">
                {aiRecommendation.data.actions.map((action) => (
                  <li key={action.actionCode} className="pg-ai-action-card">
                    <div className="pg-action-header">
                      <span className="pg-action-priority-badge">
                        Priority {action.priority}
                      </span>
                      <strong className="pg-action-name">
                        {actionLabels[action.actionCode] || action.actionCode}
                      </strong>
                    </div>

                    <p className="pg-action-explanation">
                      {action.explanation}
                    </p>

                    <div className="pg-action-evidence">
                      <span className="pg-meta-label">Related evidence:</span>{" "}
                      <code>{action.evidenceIds.join(", ")}</code>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}

      <div className="pg-ai-disclaimer">
        <p>
          AI-generated explanations and mitigations provide decision support for
          merchants. They do not override deterministic rules or alter the
          evaluated readiness status.
        </p>
      </div>
    </section>
  );
};
