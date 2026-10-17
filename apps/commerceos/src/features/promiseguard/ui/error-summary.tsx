"use client";

import { forwardRef } from "react";
import { fieldDomId, fieldLabels, type FieldError } from "./form-model";

export type ErrorSummaryProps = {
  generalMessage?: string | null;
  fieldErrors?: FieldError[];
  onFieldClick?: (key: NonNullable<FieldError["key"]>) => void;
};

export const ErrorSummary = forwardRef<HTMLDivElement, ErrorSummaryProps>(
  ({ generalMessage, fieldErrors = [], onFieldClick }, ref) => {
    if (!generalMessage && fieldErrors.length === 0) {
      return null;
    }

    return (
      <div
        ref={ref}
        role="alert"
        aria-labelledby="pg-error-summary-title"
        tabIndex={-1}
        className="pg-error-summary"
        id="pg-error-summary"
      >
        <h2 id="pg-error-summary-title" className="pg-error-summary-title">
          There is a problem with your submission
        </h2>

        {generalMessage && (
          <p className="pg-error-summary-general">{generalMessage}</p>
        )}

        {fieldErrors.length > 0 && (
          <ul className="pg-error-summary-list">
            {fieldErrors.map((error, idx) => {
              if (error.key) {
                const domId = fieldDomId(error.key);
                const label = fieldLabels[error.key] || error.key;
                return (
                  <li key={`${error.key}-${idx}`}>
                    <a
                      href={`#${domId}`}
                      className="pg-error-summary-link"
                      onClick={(e) => {
                        if (onFieldClick && error.key) {
                          e.preventDefault();
                          onFieldClick(error.key);
                        }
                      }}
                    >
                      <strong>{label}:</strong> {error.message}
                    </a>
                  </li>
                );
              }
              return (
                <li key={idx} className="pg-error-summary-text">
                  {error.message}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  },
);

ErrorSummary.displayName = "ErrorSummary";
