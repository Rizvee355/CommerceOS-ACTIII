"use client";

import type { RefObject } from "react";
import type { ErrorEnvelope } from "@commerceos/contracts";
import type { MarginLeakFieldError, MarginLeakFieldKey } from "./form-model";

type ErrorSummaryProps = {
  summaryRef: RefObject<HTMLDivElement | null>;
  title: string;
  description: string;
  fieldErrors: MarginLeakFieldError[];
  envelope?: ErrorEnvelope;
  retryable?: boolean;
  onFocusField: (key: MarginLeakFieldKey) => void;
  onRetry?: () => void;
};

export function ErrorSummary({
  summaryRef,
  title,
  description,
  fieldErrors,
  envelope,
  retryable = false,
  onFocusField,
  onRetry,
}: ErrorSummaryProps) {
  return (
    <div
      id="ml-error-summary"
      ref={summaryRef}
      tabIndex={-1}
      role="alert"
      aria-labelledby="ml-error-summary-title"
      className="ml-error-summary"
    >
      <div className="ml-error-summary-header">
        <span className="status-pill status-risk">Action Required</span>
        <h3 id="ml-error-summary-title" className="ml-error-summary-title">
          {title}
        </h3>
      </div>
      <p className="ml-error-summary-description">{description}</p>

      {fieldErrors.length > 0 && (
        <ul className="ml-error-list">
          {fieldErrors.map((err, idx) => (
            <li key={`${err.key}-${idx}`} className="ml-error-item">
              <button
                type="button"
                className="ml-error-jump-btn"
                onClick={() => onFocusField(err.key)}
              >
                <span className="ml-error-field-label">{err.label}:</span>{" "}
                <span>{err.message}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {envelope && (
        <dl className="ml-error-meta">
          <div>
            <dt>Error code</dt>
            <dd>
              <code>{envelope.error.code}</code>
            </dd>
          </div>
          <div>
            <dt>Category</dt>
            <dd>
              <code>{envelope.error.category}</code>
            </dd>
          </div>
          <div>
            <dt>Request ID</dt>
            <dd>
              <code>{envelope.requestId}</code>
            </dd>
          </div>
          <div>
            <dt>Trace ID</dt>
            <dd>
              <code>{envelope.traceId}</code>
            </dd>
          </div>
        </dl>
      )}

      {retryable && onRetry && (
        <div className="ml-error-actions">
          <button
            type="button"
            className="pg-btn pg-btn-secondary"
            onClick={onRetry}
          >
            Retry Margin Analysis
          </button>
        </div>
      )}
    </div>
  );
}

type RestrictedPreviewStateProps = {
  restrictedRef: RefObject<HTMLDivElement | null>;
  envelope: ErrorEnvelope;
};

export function RestrictedPreviewState({
  restrictedRef,
  envelope,
}: RestrictedPreviewStateProps) {
  return (
    <div
      id="ml-restricted-state"
      ref={restrictedRef}
      tabIndex={-1}
      role="region"
      aria-labelledby="ml-restricted-heading"
      className="ml-restricted-panel"
    >
      <div className="ml-restricted-header">
        <span className="status-pill status-waiting">
          HTTP 403 · Preview Restricted
        </span>
        <span className="ml-code-badge">{envelope.error.code}</span>
      </div>
      <h3 id="ml-restricted-heading" className="ml-restricted-title">
        Synthetic MarginLeak preview is disabled in this runtime
      </h3>
      <p className="ml-restricted-lead">{envelope.error.message}</p>
      <p className="ml-restricted-body">
        MarginLeak remains in <strong>planned</strong> capability status on
        production deployments. To protect unauthenticated production hosts,{" "}
        <code>POST /api/v1/marginleak/analyze</code> fails closed with HTTP 403{" "}
        (<code>retryable: false</code>) whenever the server runs outside local
        development or automated test environments.
      </p>
      <dl className="ml-error-meta">
        <div>
          <dt>Capability status</dt>
          <dd>
            <code>planned</code>
          </dd>
        </div>
        <div>
          <dt>Retryable</dt>
          <dd>
            <code>{String(envelope.error.retryable)}</code>
          </dd>
        </div>
        <div>
          <dt>Request ID</dt>
          <dd>
            <code>{envelope.requestId}</code>
          </dd>
        </div>
        <div>
          <dt>Trace ID</dt>
          <dd>
            <code>{envelope.traceId}</code>
          </dd>
        </div>
      </dl>
    </div>
  );
}
