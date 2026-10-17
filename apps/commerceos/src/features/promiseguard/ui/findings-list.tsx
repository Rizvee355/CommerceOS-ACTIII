"use client";

import type {
  PromiseGuardEvaluationRequest,
  PromiseGuardFinding,
} from "@commerceos/contracts";
import { fieldLabels, focusKeyForFinding, type FieldKey } from "./form-model";
import { findingGuidance, findingLabels, impactLabels } from "./labels";

export type FindingsListProps = {
  findings: readonly PromiseGuardFinding[];
  request: PromiseGuardEvaluationRequest;
  onFocusField?: (key: FieldKey) => void;
};

export const FindingsList = ({
  findings,
  request,
  onFocusField,
}: FindingsListProps) => {
  const adverse = findings.filter((f) => f.impact === "adverse");
  const uncertain = findings.filter((f) => f.impact === "uncertain");
  const supporting = findings.filter((f) => f.impact === "supporting");

  const renderFindingCard = (finding: PromiseGuardFinding, idx: number) => {
    const focusKey = focusKeyForFinding(finding, request);
    const guidance = findingGuidance[finding.code];
    const codeLabel = findingLabels[finding.code] || finding.code;

    return (
      <li
        key={`${finding.code}-${idx}`}
        className="pg-finding-card"
        data-impact={finding.impact}
      >
        <div className="pg-finding-header">
          <span className="pg-finding-impact-tag" data-impact={finding.impact}>
            {impactLabels[finding.impact]}
          </span>
          <span className="pg-finding-code-tag">{finding.code}</span>
        </div>

        <div className="pg-finding-title">{codeLabel}</div>

        {guidance && <p className="pg-finding-guidance">{guidance}</p>}

        <div className="pg-finding-meta">
          <div className="pg-finding-trace">
            <span className="pg-meta-label">Evidence trace:</span>{" "}
            {finding.trace.kind === "field_path" ? (
              <code>{finding.trace.fieldPaths.join(", ")}</code>
            ) : (
              <code>{finding.trace.evidenceIds.join(", ")}</code>
            )}
          </div>

          {focusKey && onFocusField && (
            <div className="pg-finding-action">
              <button
                type="button"
                className="pg-button pg-button-tertiary"
                onClick={() => onFocusField(focusKey)}
              >
                {finding.impact === "uncertain"
                  ? "Add this fact"
                  : "Edit related fact"}{" "}
                ({fieldLabels[focusKey] || focusKey})
              </button>
            </div>
          )}
        </div>
      </li>
    );
  };

  return (
    <section
      aria-labelledby="pg-findings-heading"
      className="pg-findings-section"
    >
      <div className="pg-section-intro">
        <h3 id="pg-findings-heading" className="pg-section-title">
          Deterministic Findings ({findings.length})
        </h3>
        <p className="pg-section-hint">
          Findings evaluated by deterministic domain rules against the provided
          operational evidence.
        </p>
      </div>

      <div className="pg-findings-columns">
        {adverse.length > 0 && (
          <div className="pg-findings-group" data-impact="adverse">
            <h4 className="pg-group-heading">
              <span className="pg-indicator-dot" aria-hidden="true" />
              Adverse Findings ({adverse.length})
            </h4>
            <ul className="pg-findings-list">
              {adverse.map(renderFindingCard)}
            </ul>
          </div>
        )}

        {uncertain.length > 0 && (
          <div className="pg-findings-group" data-impact="uncertain">
            <h4 className="pg-group-heading">
              <span className="pg-indicator-dot" aria-hidden="true" />
              Uncertain or Missing Evidence ({uncertain.length})
            </h4>
            <ul className="pg-findings-list">
              {uncertain.map(renderFindingCard)}
            </ul>
          </div>
        )}

        {supporting.length > 0 && (
          <div className="pg-findings-group" data-impact="supporting">
            <h4 className="pg-group-heading">
              <span className="pg-indicator-dot" aria-hidden="true" />
              Supporting Findings ({supporting.length})
            </h4>
            <ul className="pg-findings-list">
              {supporting.map(renderFindingCard)}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
};
