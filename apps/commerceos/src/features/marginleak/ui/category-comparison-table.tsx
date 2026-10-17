"use client";

import {
  MARGIN_LEAK_FINANCIAL_CATEGORIES,
  type MarginLeakDeterministicData,
  type MarginLeakFinancialCategory,
} from "@commerceos/contracts";
import { formatMoneyExact } from "./format";
import type { MarginLeakFieldKey } from "./form-model";
import {
  CATEGORY_METADATA,
  directionLabels,
  type MarginLeakCategoryComparison,
} from "./labels";

type CategoryComparisonTableProps = {
  data: MarginLeakDeterministicData;
  onJumpToField: (key: MarginLeakFieldKey) => void;
};

export function CategoryComparisonTable({
  data,
  onJumpToField,
}: CategoryComparisonTableProps) {
  const comparisonByCategory = new Map<
    MarginLeakFinancialCategory,
    MarginLeakCategoryComparison
  >();
  for (const comp of data.categoryComparisons) {
    comparisonByCategory.set(comp.category, comp);
  }

  const missingSet = new Set(data.missingEvidencePaths);

  let adverseTotalMinor = 0;
  let favorableTotalMinor = 0;
  for (const comp of data.categoryComparisons) {
    if (comp.direction === "adverse") {
      adverseTotalMinor += comp.varianceAmount.amountMinor;
    } else if (comp.direction === "favorable") {
      favorableTotalMinor += comp.varianceAmount.amountMinor;
    }
  }
  const combinedMagnitude = adverseTotalMinor + favorableTotalMinor;
  const adversePct =
    combinedMagnitude > 0
      ? Math.round((adverseTotalMinor / combinedMagnitude) * 100)
      : 0;
  const favorablePct =
    combinedMagnitude > 0 ? Math.max(0, 100 - adversePct) : 0;

  const formatSignedCategoryImpact = (comp: MarginLeakCategoryComparison) => {
    if (comp.direction === "adverse") {
      return `${formatMoneyExact(comp.varianceAmount.amountMinor, comp.varianceAmount.currency, { explicitPlus: true })} adverse`;
    }
    if (comp.direction === "favorable") {
      return `-${formatMoneyExact(comp.varianceAmount.amountMinor, comp.varianceAmount.currency)} favorable`;
    }
    return formatMoneyExact(0, comp.varianceAmount.currency);
  };

  return (
    <section
      className="ml-result-section"
      aria-labelledby="ml-comparison-heading"
    >
      <div className="ml-section-header">
        <div>
          <p className="eyebrow">Category-Level Reconciliation</p>
          <h3 id="ml-comparison-heading" className="ml-section-title">
            Contribution-margin component ledger (8 categories)
          </h3>
        </div>
        <p className="ml-section-subtitle">
          Signed component variance is computed as{" "}
          <code>roleSign × (expected − observed)</code>. Positive component
          variance is adverse to margin; negative component variance is
          favorable to margin.
        </p>
      </div>

      {/* Adverse vs Favorable Component Balance Bar */}
      {data.categoryComparisons.length > 0 && (
        <div
          className="ml-balance-meter"
          role="region"
          aria-label="Adverse versus favorable component variance balance"
        >
          <div className="ml-balance-labels">
            <div>
              <span className="ml-balance-tag ml-balance-tag-adverse">
                Total Adverse Drivers
              </span>
              <strong>
                {formatMoneyExact(adverseTotalMinor, data.currency, {
                  explicitPlus: adverseTotalMinor > 0,
                })}
              </strong>
            </div>
            <div className="ml-balance-right">
              <span className="ml-balance-tag ml-balance-tag-favorable">
                Total Favorable Offsets
              </span>
              <strong>
                {favorableTotalMinor > 0
                  ? `-${formatMoneyExact(favorableTotalMinor, data.currency)}`
                  : formatMoneyExact(0, data.currency)}
              </strong>
            </div>
          </div>
          <div className="ml-balance-track" aria-hidden="true">
            <div
              className="ml-balance-fill-adverse"
              style={{ width: `${adversePct}%` }}
            />
            <div
              className="ml-balance-fill-favorable"
              style={{ width: `${favorablePct}%` }}
            />
          </div>
        </div>
      )}

      {/* Desktop Semantic Table */}
      <div className="ml-comparison-table-wrapper">
        <table className="ml-comparison-table">
          <caption className="sr-only">
            Expected versus observed financial amounts and signed margin
            variance across all eight canonical order categories
          </caption>
          <thead>
            <tr>
              <th scope="col">Category &amp; Role</th>
              <th scope="col">Expected</th>
              <th scope="col">Observed</th>
              <th scope="col">Direction</th>
              <th scope="col">Signed Margin Impact</th>
              <th scope="col">Provenance / Action</th>
            </tr>
          </thead>
          <tbody>
            {MARGIN_LEAK_FINANCIAL_CATEGORIES.map((category) => {
              const meta = CATEGORY_METADATA[category];
              const comp = comparisonByCategory.get(category);
              const missingExpected = missingSet.has(
                `/financials/${category}/expected`,
              );
              const missingObserved = missingSet.has(
                `/financials/${category}/observed`,
              );

              if (!comp) {
                const targetSide = missingExpected ? "expected" : "observed";
                const targetKey: MarginLeakFieldKey = `financials.${category}.${targetSide}.included`;
                return (
                  <tr
                    key={category}
                    className="ml-row-missing"
                    data-category-row={category}
                  >
                    <th scope="row">
                      <div className="ml-cell-cat">
                        <strong>{meta.label}</strong>
                        <span className="ml-cell-role">{meta.signLabel}</span>
                      </div>
                    </th>
                    <td>
                      {missingExpected ? (
                        <span className="status-pill status-waiting">
                          Missing input
                        </span>
                      ) : (
                        <span className="ml-cell-muted">Present</span>
                      )}
                    </td>
                    <td>
                      {missingObserved ? (
                        <span className="status-pill status-waiting">
                          Missing input
                        </span>
                      ) : (
                        <span className="ml-cell-muted">Present</span>
                      )}
                    </td>
                    <td colSpan={2}>
                      <span className="ml-missing-explanation">
                        Comparison withheld — missing{" "}
                        {missingExpected && missingObserved
                          ? "expected & observed"
                          : missingExpected
                            ? "expected"
                            : "observed"}{" "}
                        observation (never substituted with $0.00).
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="ml-inline-action-btn"
                        onClick={() => onJumpToField(targetKey)}
                      >
                        Supply {targetSide} {meta.shortLabel}
                      </button>
                    </td>
                  </tr>
                );
              }

              const dirMeta = directionLabels[comp.direction];

              return (
                <tr
                  key={category}
                  className={`ml-row-${comp.direction}`}
                  data-category-row={category}
                >
                  <th scope="row">
                    <div className="ml-cell-cat">
                      <strong>{meta.label}</strong>
                      <span className="ml-cell-role">{meta.signLabel}</span>
                    </div>
                  </th>
                  <td className="ml-cell-money">
                    <strong>
                      {formatMoneyExact(
                        comp.expected.amountMinor,
                        comp.expected.currency,
                      )}
                    </strong>
                    <span className="ml-cell-minor">
                      {comp.expected.amountMinor} minor
                    </span>
                  </td>
                  <td className="ml-cell-money">
                    <strong>
                      {formatMoneyExact(
                        comp.observed.amountMinor,
                        comp.observed.currency,
                      )}
                    </strong>
                    <span className="ml-cell-minor">
                      {comp.observed.amountMinor} minor
                    </span>
                  </td>
                  <td>
                    <span className={`status-pill status-${dirMeta.tone}`}>
                      <span aria-hidden="true">{dirMeta.icon}</span>{" "}
                      {dirMeta.label}
                    </span>
                  </td>
                  <td className="ml-cell-money">
                    <strong className={`ml-impact-${comp.direction}`}>
                      {formatSignedCategoryImpact(comp)}
                    </strong>
                    <span className="ml-cell-minor">
                      |Δ| = {comp.varianceAmount.amountMinor} minor
                    </span>
                  </td>
                  <td>
                    <div className="ml-evidence-pair">
                      <code>{comp.expectedEvidenceId}</code>
                      <code>{comp.observedEvidenceId}</code>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Stacked Category Cards */}
      <div
        className="ml-comparison-mobile-list"
        role="list"
        aria-label="Mobile category comparison cards"
      >
        {MARGIN_LEAK_FINANCIAL_CATEGORIES.map((category) => {
          const meta = CATEGORY_METADATA[category];
          const comp = comparisonByCategory.get(category);
          const missingExpected = missingSet.has(
            `/financials/${category}/expected`,
          );
          const missingObserved = missingSet.has(
            `/financials/${category}/observed`,
          );

          if (!comp) {
            const targetSide = missingExpected ? "expected" : "observed";
            const targetKey: MarginLeakFieldKey = `financials.${category}.${targetSide}.included`;
            return (
              <div
                key={category}
                role="listitem"
                className="ml-mobile-comp-card ml-mobile-comp-missing"
              >
                <div className="ml-mobile-comp-top">
                  <strong>{meta.label}</strong>
                  <span className="status-pill status-waiting">
                    Missing Evidence
                  </span>
                </div>
                <p className="ml-missing-explanation">
                  Missing{" "}
                  {missingExpected && missingObserved
                    ? "expected and observed"
                    : missingExpected
                      ? "expected"
                      : "observed"}{" "}
                  observation. Never substituted with $0.00.
                </p>
                <button
                  type="button"
                  className="ml-inline-action-btn"
                  onClick={() => onJumpToField(targetKey)}
                >
                  Supply {targetSide} {meta.shortLabel}
                </button>
              </div>
            );
          }

          const dirMeta = directionLabels[comp.direction];

          return (
            <div
              key={category}
              role="listitem"
              className={`ml-mobile-comp-card ml-mobile-comp-${comp.direction}`}
            >
              <div className="ml-mobile-comp-top">
                <div className="ml-cell-cat">
                  <strong>{meta.label}</strong>
                  <span className="ml-cell-role">{meta.signLabel}</span>
                </div>
                <span className={`status-pill status-${dirMeta.tone}`}>
                  {dirMeta.icon} {dirMeta.label}
                </span>
              </div>
              <dl className="ml-mobile-comp-grid">
                <div>
                  <dt>Expected</dt>
                  <dd>
                    {formatMoneyExact(
                      comp.expected.amountMinor,
                      comp.expected.currency,
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Observed</dt>
                  <dd>
                    {formatMoneyExact(
                      comp.observed.amountMinor,
                      comp.observed.currency,
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Signed Impact</dt>
                  <dd className={`ml-impact-${comp.direction}`}>
                    {formatSignedCategoryImpact(comp)}
                  </dd>
                </div>
                <div>
                  <dt>Evidence IDs</dt>
                  <dd>
                    <code>{comp.expectedEvidenceId}</code> /{" "}
                    <code>{comp.observedEvidenceId}</code>
                  </dd>
                </div>
              </dl>
            </div>
          );
        })}
      </div>
    </section>
  );
}
