"use client";

import type { FormEvent } from "react";
import type { MarginLeakFinancialCategory } from "@commerceos/contracts";
import { formatMoneyExact } from "./format";
import {
  fieldDomId,
  type MarginLeakDraft,
  type MarginLeakFieldError,
  type MarginLeakFieldKey,
  type ObservationDraft,
  type ObservationSide,
} from "./form-model";
import { CATEGORY_METADATA, type MarginLeakObservationState } from "./labels";

const REVENUE_CATEGORIES: readonly MarginLeakFinancialCategory[] = [
  "grossItemRevenue",
  "shippingRevenue",
];

const DEDUCTION_CATEGORIES: readonly MarginLeakFinancialCategory[] = [
  "discounts",
  "cogs",
  "shippingCost",
  "fulfillmentCost",
  "paymentCost",
  "platformCost",
];

type FinancialEvidenceFormProps = {
  draft: MarginLeakDraft;
  fieldErrors: MarginLeakFieldError[];
  isDirty: boolean;
  isLossLeaderLoaded: boolean;
  isSubmitting: boolean;
  onUpdateOrderRef: (value: string) => void;
  onUpdateCurrency: (value: string) => void;
  onUpdateObservationState: (value: MarginLeakObservationState) => void;
  onUpdateObservation: (
    category: MarginLeakFinancialCategory,
    side: ObservationSide,
    patch: Partial<ObservationDraft>,
  ) => void;
  onResetPreset: () => void;
  onLoadLossLeader: () => void;
  onSubmit: () => void;
};

export function FinancialEvidenceForm({
  draft,
  fieldErrors,
  isDirty,
  isLossLeaderLoaded,
  isSubmitting,
  onUpdateOrderRef,
  onUpdateCurrency,
  onUpdateObservationState,
  onUpdateObservation,
  onResetPreset,
  onLoadLossLeader,
  onSubmit,
}: FinancialEvidenceFormProps) {
  const errorMap = new Map<MarginLeakFieldKey, string>();
  for (const err of fieldErrors) {
    if (!errorMap.has(err.key)) {
      errorMap.set(err.key, err.message);
    }
  }

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSubmit();
  };

  const renderObservationSide = (
    category: MarginLeakFinancialCategory,
    side: ObservationSide,
  ) => {
    const meta = CATEGORY_METADATA[category];
    const obs = draft.financials[category][side];
    const sideTitle = side === "expected" ? "Expected" : "Observed";

    const includedKey: MarginLeakFieldKey = `financials.${category}.${side}.included`;
    const amountKey: MarginLeakFieldKey = `financials.${category}.${side}.amountMinor`;
    const evIdKey: MarginLeakFieldKey = `financials.${category}.${side}.evidenceId`;
    const labelKey: MarginLeakFieldKey = `financials.${category}.${side}.sourceLabel`;
    const timeKey: MarginLeakFieldKey = `financials.${category}.${side}.recordedAt`;

    const amountError = errorMap.get(amountKey);
    const evIdError = errorMap.get(evIdKey);
    const labelError = errorMap.get(labelKey);
    const timeError = errorMap.get(timeKey);
    const hasProvenanceError = Boolean(evIdError || labelError || timeError);

    const trimmedAmount = obs.amountMinor.trim();
    const numericAmount =
      trimmedAmount !== "" && /^\d+$/.test(trimmedAmount)
        ? Number(trimmedAmount)
        : null;
    const previewDisplay =
      numericAmount !== null && Number.isSafeInteger(numericAmount)
        ? formatMoneyExact(numericAmount, draft.currency || "USD")
        : "Invalid integer";

    return (
      <div
        className={`ml-obs-box ${!obs.included ? "ml-obs-box-omitted" : ""} ${amountError || hasProvenanceError ? "ml-obs-box-error" : ""}`}
        data-category={category}
        data-side={side}
      >
        <div className="ml-obs-header">
          <label
            htmlFor={fieldDomId(includedKey)}
            className="ml-obs-include-label"
          >
            <input
              id={fieldDomId(includedKey)}
              type="checkbox"
              checked={obs.included}
              disabled={isSubmitting}
              onChange={(e) =>
                onUpdateObservation(category, side, {
                  included: e.target.checked,
                })
              }
            />
            <span className="ml-obs-side-title">
              Include {sideTitle.toLowerCase()}
            </span>
          </label>
          <span
            className={`ml-obs-badge ${obs.included ? "ml-obs-badge-present" : "ml-obs-badge-missing"}`}
          >
            {obs.included ? `${sideTitle} present` : "Omitted"}
          </span>
        </div>

        {!obs.included ? (
          <div className="ml-obs-omitted-notice">
            <p className="ml-obs-omitted-title">
              Omitted — missing financial input
            </p>
            <p className="ml-obs-omitted-copy">
              <code>
                /financials/{category}/{side}
              </code>{" "}
              will be omitted from the request. MarginLeak never substitutes{" "}
              <code>$0.00</code> for missing evidence.
            </p>
          </div>
        ) : (
          <div className="ml-obs-fields">
            <div className="ml-field-group">
              <div className="ml-amount-label-row">
                <label
                  htmlFor={fieldDomId(amountKey)}
                  className="ml-field-label"
                >
                  {sideTitle} {meta.shortLabel.toLowerCase()} (minor units)
                </label>
                <span
                  className="ml-amount-preview"
                  aria-label={`${sideTitle} ${meta.shortLabel} formatted preview`}
                >
                  {previewDisplay}
                </span>
              </div>
              <input
                id={fieldDomId(amountKey)}
                type="text"
                inputMode="numeric"
                value={obs.amountMinor}
                disabled={isSubmitting}
                aria-invalid={Boolean(amountError)}
                aria-describedby={
                  amountError ? `${fieldDomId(amountKey)}-error` : undefined
                }
                onChange={(e) =>
                  onUpdateObservation(category, side, {
                    amountMinor: e.target.value,
                  })
                }
                className="ml-text-input ml-mono-input"
              />
              {amountError && (
                <p
                  id={`${fieldDomId(amountKey)}-error`}
                  className="ml-field-error"
                >
                  {amountError}
                </p>
              )}
            </div>

            <details
              className="ml-provenance-details"
              open={hasProvenanceError ? true : undefined}
            >
              <summary className="ml-provenance-summary">
                <span>
                  Provenance (<code>{obs.evidenceId || "unset"}</code>)
                </span>
              </summary>
              <div className="ml-provenance-grid">
                <div className="ml-field-group">
                  <label
                    htmlFor={fieldDomId(evIdKey)}
                    className="ml-field-label"
                  >
                    {sideTitle} evidence ID
                  </label>
                  <input
                    id={fieldDomId(evIdKey)}
                    type="text"
                    value={obs.evidenceId}
                    disabled={isSubmitting}
                    aria-invalid={Boolean(evIdError)}
                    onChange={(e) =>
                      onUpdateObservation(category, side, {
                        evidenceId: e.target.value,
                      })
                    }
                    className="ml-text-input ml-mono-input"
                  />
                  {evIdError && <p className="ml-field-error">{evIdError}</p>}
                </div>

                <div className="ml-field-group">
                  <label
                    htmlFor={fieldDomId(labelKey)}
                    className="ml-field-label"
                  >
                    {sideTitle} source label
                  </label>
                  <input
                    id={fieldDomId(labelKey)}
                    type="text"
                    value={obs.sourceLabel}
                    disabled={isSubmitting}
                    aria-invalid={Boolean(labelError)}
                    onChange={(e) =>
                      onUpdateObservation(category, side, {
                        sourceLabel: e.target.value,
                      })
                    }
                    className="ml-text-input"
                  />
                  {labelError && <p className="ml-field-error">{labelError}</p>}
                </div>

                <div className="ml-field-group">
                  <label
                    htmlFor={fieldDomId(timeKey)}
                    className="ml-field-label"
                  >
                    {sideTitle} recorded UTC timestamp
                  </label>
                  <input
                    id={fieldDomId(timeKey)}
                    type="text"
                    value={obs.recordedAt}
                    disabled={isSubmitting}
                    aria-invalid={Boolean(timeError)}
                    onChange={(e) =>
                      onUpdateObservation(category, side, {
                        recordedAt: e.target.value,
                      })
                    }
                    className="ml-text-input ml-mono-input"
                  />
                  {timeError && <p className="ml-field-error">{timeError}</p>}
                </div>
              </div>
            </details>
          </div>
        )}
      </div>
    );
  };

  const renderCategoryCard = (category: MarginLeakFinancialCategory) => {
    const meta = CATEGORY_METADATA[category];
    return (
      <article
        key={category}
        className="ml-category-card"
        aria-labelledby={`ml-cat-title-${category}`}
      >
        <div className="ml-category-card-header">
          <div>
            <h4 id={`ml-cat-title-${category}`} className="ml-category-title">
              {meta.label}
            </h4>
            <p className="ml-category-description">{meta.description}</p>
          </div>
          <span
            className={`ml-role-badge ${meta.role === "revenue" ? "ml-role-revenue" : "ml-role-deduction"}`}
          >
            {meta.signLabel}
          </span>
        </div>

        <div className="ml-category-sides">
          {renderObservationSide(category, "expected")}
          {renderObservationSide(category, "observed")}
        </div>
      </article>
    );
  };

  const orderRefError = errorMap.get("orderRef");
  const currencyError = errorMap.get("currency");

  return (
    <form
      className="ml-evidence-form"
      onSubmit={handleSubmit}
      noValidate
      aria-labelledby="ml-form-heading"
    >
      <div className="ml-section-header">
        <div>
          <p className="eyebrow">Step 2 · Order & Financial Observations</p>
          <h2 id="ml-form-heading" className="ml-section-title">
            Configure expected vs. observed order economics
          </h2>
        </div>
        <div className="ml-form-toolbar">
          <button
            type="button"
            className="pg-btn pg-btn-secondary"
            disabled={isSubmitting}
            onClick={onLoadLossLeader}
          >
            Load loss-leader example (-$1.00 margin)
          </button>
          <button
            type="button"
            className="pg-btn pg-btn-secondary"
            disabled={isSubmitting || (!isDirty && !isLossLeaderLoaded)}
            onClick={onResetPreset}
          >
            Reset to scenario
          </button>
          <button
            type="submit"
            className="pg-btn pg-btn-primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Analyzing Margin..." : "Run Margin Analysis"}
          </button>
        </div>
      </div>

      {isLossLeaderLoaded && (
        <div className="ml-loss-leader-banner" role="status">
          <strong>Negative-margin loss-leader helper loaded:</strong> Expected
          margin is <code>-$2.00</code> (<code>-200</code> minor units) and
          observed margin is <code>-$1.00</code> (<code>-100</code> minor
          units). Because observed margin beat expected by <code>$1.00</code>{" "}
          (variance <code>-$1.00</code> favorable), deterministic evaluation
          reports <code>no_leak_detected</code> and <code>$0.00</code> leakage.
        </div>
      )}

      {/* Order Context Header */}
      <div className="ml-order-context-panel">
        <div className="ml-order-context-grid">
          <div className="ml-field-group">
            <label htmlFor={fieldDomId("orderRef")} className="ml-field-label">
              Order reference
            </label>
            <input
              id={fieldDomId("orderRef")}
              type="text"
              value={draft.orderRef}
              disabled={isSubmitting}
              aria-invalid={Boolean(orderRefError)}
              onChange={(e) => onUpdateOrderRef(e.target.value)}
              className="ml-text-input ml-mono-input"
            />
            {orderRefError && <p className="ml-field-error">{orderRefError}</p>}
          </div>

          <div className="ml-field-group">
            <label htmlFor={fieldDomId("currency")} className="ml-field-label">
              ISO-4217 currency code
            </label>
            <input
              id={fieldDomId("currency")}
              type="text"
              maxLength={3}
              value={draft.currency}
              disabled={isSubmitting}
              aria-invalid={Boolean(currencyError)}
              onChange={(e) => onUpdateCurrency(e.target.value.toUpperCase())}
              className="ml-text-input ml-mono-input"
            />
            <span className="ml-field-hint">
              All 16 component amounts must match this currency.
            </span>
            {currencyError && <p className="ml-field-error">{currencyError}</p>}
          </div>

          <fieldset
            id={fieldDomId("observationState")}
            tabIndex={-1}
            className="ml-finality-fieldset"
            disabled={isSubmitting}
          >
            <legend className="ml-field-label">
              Observation finality state
            </legend>
            <div className="ml-finality-options">
              <label className="ml-finality-option">
                <input
                  type="radio"
                  name="marginleak-observation-state"
                  value="final"
                  checked={draft.observationState === "final"}
                  onChange={() => onUpdateObservationState("final")}
                />
                <span>
                  <strong>Final</strong> (settled invoices &amp; fees)
                </span>
              </label>
              <label className="ml-finality-option">
                <input
                  type="radio"
                  name="marginleak-observation-state"
                  value="provisional"
                  checked={draft.observationState === "provisional"}
                  onChange={() => onUpdateObservationState("provisional")}
                />
                <span>
                  <strong>Provisional</strong> (unsettled pre-close values)
                </span>
              </label>
            </div>
          </fieldset>
        </div>
      </div>

      {/* Category Group 1: Revenue (+1) */}
      <div className="ml-category-group">
        <div className="ml-category-group-header">
          <h3 className="ml-category-group-title">
            Revenue Components (<code>+1</code> Contribution Sign)
          </h3>
          <p className="ml-category-group-copy">
            Lower observed revenue than expected creates an{" "}
            <strong>adverse</strong> contribution-margin variance.
          </p>
        </div>
        <div className="ml-category-list">
          {REVENUE_CATEGORIES.map(renderCategoryCard)}
        </div>
      </div>

      {/* Category Group 2: Deductions (-1) */}
      <div className="ml-category-group">
        <div className="ml-category-group-header">
          <h3 className="ml-category-group-title">
            Deduction &amp; Cost Components (<code>−1</code> Contribution Sign)
          </h3>
          <p className="ml-category-group-copy">
            Higher observed deductions or costs than expected create an{" "}
            <strong>adverse</strong> contribution-margin variance; lower
            observed deductions create a <strong>favorable</strong> variance.
          </p>
        </div>
        <div className="ml-category-list">
          {DEDUCTION_CATEGORIES.map(renderCategoryCard)}
        </div>
      </div>

      <div className="ml-form-footer">
        <p className="ml-form-footer-note">
          All monetary inputs are non-negative integers in minor units (e.g.,{" "}
          <code>12000</code> = <code>$120.00</code> USD).
        </p>
        <div className="ml-form-toolbar">
          <button
            type="button"
            className="pg-btn pg-btn-secondary"
            disabled={isSubmitting || (!isDirty && !isLossLeaderLoaded)}
            onClick={onResetPreset}
          >
            Reset to scenario
          </button>
          <button
            type="submit"
            className="pg-btn pg-btn-primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Analyzing Margin..." : "Run Margin Analysis"}
          </button>
        </div>
      </div>
    </form>
  );
}
