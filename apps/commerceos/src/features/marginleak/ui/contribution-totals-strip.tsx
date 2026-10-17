"use client";

import type { MarginLeakDeterministicData } from "@commerceos/contracts";
import {
  formatLeakAmountDisplay,
  formatMoneyExact,
  formatMoneySubtext,
  formatSignedVarianceHeadline,
} from "./format";

type ContributionTotalsStripProps = {
  data: MarginLeakDeterministicData;
  scenarioId?: string;
};

export function ContributionTotalsStrip({
  data,
  scenarioId,
}: ContributionTotalsStripProps) {
  const { totals, evidenceCompleteness, observationState } = data;

  const expectedMargin = totals.expectedContributionMargin;
  const observedMargin = totals.observedContributionMargin;
  const netVariance = totals.netContributionVariance;
  const leakDisplay = formatLeakAmountDisplay(
    totals.leakAmount,
    evidenceCompleteness,
    observationState,
  );
  const varianceDisplay = netVariance
    ? formatSignedVarianceHeadline(netVariance)
    : null;

  const isNegativeObservedMargin =
    observedMargin !== null && observedMargin.amountMinor < 0;
  const isExplicitLossLeaderScenario = scenarioId === "ml-loss-leader-no-leak";

  return (
    <div
      className="ml-totals-grid"
      role="region"
      aria-label="Contribution margin aggregate totals"
    >
      {/* Card 1: Expected Contribution Margin */}
      <article className="ml-kpi-card" data-kpi="expected-margin">
        <span className="ml-kpi-label">Expected Contribution Margin</span>
        {expectedMargin !== null ? (
          <>
            <strong className="ml-kpi-value">
              {formatMoneyExact(
                expectedMargin.amountMinor,
                expectedMargin.currency,
              )}
            </strong>
            <span className="ml-kpi-subtext">
              {formatMoneySubtext(
                expectedMargin.amountMinor,
                expectedMargin.currency,
              )}
            </span>
            {expectedMargin.amountMinor < 0 && (
              <span className="ml-kpi-note">
                {isExplicitLossLeaderScenario
                  ? "Synthetic loss-leader scenario baseline (negative expected contribution margin)"
                  : "Negative expected contribution margin (expected deductions exceed expected revenue)"}
              </span>
            )}
          </>
        ) : (
          <>
            <strong className="ml-kpi-value ml-kpi-value-null">
              Not calculable — evidence incomplete
            </strong>
            <span className="ml-kpi-subtext">
              Requires all 8 expected category observations.
            </span>
          </>
        )}
      </article>

      {/* Card 2: Observed Contribution Margin */}
      <article className="ml-kpi-card" data-kpi="observed-margin">
        <span className="ml-kpi-label">Observed Contribution Margin</span>
        {observedMargin !== null ? (
          <>
            <strong className="ml-kpi-value">
              {formatMoneyExact(
                observedMargin.amountMinor,
                observedMargin.currency,
              )}
            </strong>
            <span className="ml-kpi-subtext">
              {formatMoneySubtext(
                observedMargin.amountMinor,
                observedMargin.currency,
              )}
            </span>
            {isNegativeObservedMargin && (
              <span className="ml-kpi-note ml-kpi-note-accounting">
                Negative contribution margin · Not a leak when matching or
                beating expected margin
              </span>
            )}
          </>
        ) : (
          <>
            <strong className="ml-kpi-value ml-kpi-value-null">
              Not calculable — evidence incomplete
            </strong>
            <span className="ml-kpi-subtext">
              Requires all 8 observed category observations.
            </span>
          </>
        )}
      </article>

      {/* Card 3: Signed Net Contribution Variance */}
      <article
        className={`ml-kpi-card ${varianceDisplay ? `ml-kpi-tone-${varianceDisplay.tone}` : "ml-kpi-tone-waiting"}`}
        data-kpi="net-variance"
      >
        <div className="ml-kpi-top-row">
          <span className="ml-kpi-label">
            Net Contribution Variance (Expected − Observed)
          </span>
          {varianceDisplay && (
            <span className={`status-pill status-${varianceDisplay.tone}`}>
              {varianceDisplay.directionBadge}
            </span>
          )}
        </div>
        {varianceDisplay && netVariance ? (
          <>
            <strong className="ml-kpi-value ml-kpi-value-variance">
              {varianceDisplay.primary}
            </strong>
            <span className="ml-kpi-subtext">
              {formatMoneySubtext(
                netVariance.amountMinor,
                netVariance.currency,
              )}{" "}
              · {varianceDisplay.explanation}
            </span>
          </>
        ) : (
          <>
            <strong className="ml-kpi-value ml-kpi-value-null">
              Not calculable — evidence incomplete
            </strong>
            <span className="ml-kpi-subtext">
              Signed net variance is withheld until all 16 financial
              observations are present.
            </span>
          </>
        )}
      </article>

      {/* Card 4: Confirmed Leak Amount */}
      <article
        className={`ml-kpi-card ml-kpi-tone-${leakDisplay.tone}`}
        data-kpi="leak-amount"
      >
        <div className="ml-kpi-top-row">
          <span className="ml-kpi-label">Confirmed Leak Amount</span>
          <span className={`status-pill status-${leakDisplay.tone}`}>
            {leakDisplay.isNull
              ? "Withheld"
              : totals.leakAmount && totals.leakAmount.amountMinor > 0
                ? "Confirmed Leak"
                : "Zero Leak"}
          </span>
        </div>
        <strong
          className={`ml-kpi-value ${leakDisplay.isNull ? "ml-kpi-value-null" : ""}`}
        >
          {leakDisplay.primary}
        </strong>
        <span className="ml-kpi-subtext">{leakDisplay.subtext}</span>
      </article>
    </div>
  );
}
