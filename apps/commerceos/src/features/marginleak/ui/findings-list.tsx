"use client";

import type { MarginLeakFinding } from "@commerceos/contracts";
import { formatMoneyExact } from "./format";
import {
  resolveFindingTargetField,
  type MarginLeakFieldKey,
} from "./form-model";
import { CATEGORY_METADATA, parseEvidencePathLabel } from "./labels";

type FindingsListProps = {
  findings: MarginLeakFinding[];
  onJumpToField: (key: MarginLeakFieldKey) => void;
};

export function FindingsList({ findings, onJumpToField }: FindingsListProps) {
  return (
    <section
      className="ml-result-section"
      aria-labelledby="ml-findings-heading"
    >
      <div className="ml-section-header">
        <div>
          <p className="eyebrow">Deterministic Audit Findings</p>
          <h3 id="ml-findings-heading" className="ml-section-title">
            Variance &amp; uncertainty findings ({findings.length})
          </h3>
        </div>
        <p className="ml-section-subtitle">
          Every non-neutral category variance, missing financial observation, or
          provisional finality constraint is emitted as an explicit finding
          backed by validated evidence IDs or JSON pointer paths.
        </p>
      </div>

      {findings.length === 0 ? (
        <div className="ml-empty-findings">
          <p>
            No component variances or uncertainty findings were detected. All 8
            financial categories matched expected values under final settlement.
          </p>
        </div>
      ) : (
        <ul className="ml-findings-grid">
          {findings.map((finding, index) => {
            const target = resolveFindingTargetField(finding);

            if (
              finding.code === "ADVERSE_COMPONENT_VARIANCE" ||
              finding.code === "FAVORABLE_COMPONENT_VARIANCE"
            ) {
              const meta = CATEGORY_METADATA[finding.category];
              const isAdverse = finding.impact === "adverse";
              const formattedAmount = formatMoneyExact(
                finding.amount.amountMinor,
                finding.amount.currency,
              );

              return (
                <li
                  key={`${finding.code}-${finding.category}-${index}`}
                  className={`ml-finding-card ml-finding-${isAdverse ? "adverse" : "favorable"}`}
                >
                  <div className="ml-finding-top">
                    <span
                      className={`status-pill status-${isAdverse ? "risk" : "ready"}`}
                    >
                      {isAdverse ? "▲ Adverse Variance" : "▼ Favorable Offset"}
                    </span>
                    <code className="ml-code-badge">{finding.code}</code>
                  </div>
                  <h4 className="ml-finding-title">
                    {meta.label}: {formattedAmount}{" "}
                    {isAdverse
                      ? "adverse margin impact"
                      : "favorable margin offset"}
                  </h4>
                  <p className="ml-finding-body">
                    {isAdverse
                      ? meta.role === "revenue"
                        ? `Observed ${meta.label.toLowerCase()} fell below expected revenue by ${formattedAmount} (${finding.amount.amountMinor} minor units).`
                        : `Observed ${meta.label.toLowerCase()} exceeded expected deduction by ${formattedAmount} (${finding.amount.amountMinor} minor units).`
                      : meta.role === "revenue"
                        ? `Observed ${meta.label.toLowerCase()} beat expected revenue by ${formattedAmount} (${finding.amount.amountMinor} minor units).`
                        : `Observed ${meta.label.toLowerCase()} came in below expected deduction by ${formattedAmount} (${finding.amount.amountMinor} minor units).`}
                  </p>
                  <div className="ml-finding-footer">
                    <div className="ml-finding-evidence">
                      <span>Evidence IDs:</span>
                      <code>{finding.evidenceIds[0]}</code>
                      <code>{finding.evidenceIds[1]}</code>
                    </div>
                    <button
                      type="button"
                      className="ml-inline-action-btn"
                      onClick={() => onJumpToField(target.key)}
                    >
                      {target.actionLabel}
                    </button>
                  </div>
                </li>
              );
            }

            if (finding.code === "MISSING_FINANCIAL_INPUT") {
              const parsed = parseEvidencePathLabel(finding.fieldPath);
              return (
                <li
                  key={`${finding.code}-${finding.fieldPath}-${index}`}
                  className="ml-finding-card ml-finding-uncertain"
                >
                  <div className="ml-finding-top">
                    <span className="status-pill status-waiting">
                      ◆ Missing Evidence
                    </span>
                    <code className="ml-code-badge">{finding.code}</code>
                  </div>
                  <h4 className="ml-finding-title">
                    {parsed.humanLabel} is missing
                  </h4>
                  <p className="ml-finding-body">
                    Required input at <code>{finding.fieldPath}</code> was
                    omitted. MarginLeak withholds aggregate margin and leak
                    calculations rather than assuming a missing observation is{" "}
                    <code>$0.00</code>.
                  </p>
                  <div className="ml-finding-footer">
                    <div className="ml-finding-evidence">
                      <span>Fact path:</span>
                      <code>{finding.fieldPath}</code>
                    </div>
                    <button
                      type="button"
                      className="ml-inline-action-btn"
                      onClick={() => onJumpToField(target.key)}
                    >
                      {target.actionLabel}
                    </button>
                  </div>
                </li>
              );
            }

            return (
              <li
                key={`${finding.code}-${index}`}
                className="ml-finding-card ml-finding-uncertain"
              >
                <div className="ml-finding-top">
                  <span className="status-pill status-waiting">
                    ◆ Provisional Evidence
                  </span>
                  <code className="ml-code-badge">{finding.code}</code>
                </div>
                <h4 className="ml-finding-title">
                  Financial observations are marked provisional
                </h4>
                <p className="ml-finding-body">
                  <code>{finding.fieldPath}</code> is set to{" "}
                  <code>provisional</code>. While expected and observed margins
                  can be compared, confirmed leak amount remains{" "}
                  <code>null</code> until final settlement.
                </p>
                <div className="ml-finding-footer">
                  <div className="ml-finding-evidence">
                    <span>Policy path:</span>
                    <code>{finding.fieldPath}</code>
                  </div>
                  <button
                    type="button"
                    className="ml-inline-action-btn"
                    onClick={() => onJumpToField(target.key)}
                  >
                    {target.actionLabel}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
