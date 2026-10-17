"use client";

import type { PromiseGuardEvaluationResponse } from "@commerceos/contracts";
import { useState } from "react";
import { formatUtc } from "./format";

export type ProvenanceFooterProps = {
  response: PromiseGuardEvaluationResponse;
};

export const ProvenanceFooter = ({ response }: ProvenanceFooterProps) => {
  const [copiedTrace, setCopiedTrace] = useState(false);

  const copyTrace = async () => {
    try {
      await navigator.clipboard.writeText(response.metadata.traceId);
      setCopiedTrace(true);
      setTimeout(() => setCopiedTrace(false), 2000);
    } catch {
      // Fallback if clipboard API is unavailable
    }
  };

  return (
    <footer
      aria-labelledby="pg-provenance-heading"
      className="pg-provenance-footer"
    >
      <div className="pg-section-intro">
        <h3 id="pg-provenance-heading" className="pg-section-title">
          Session Execution Metadata
        </h3>
        <p className="pg-section-hint">
          Ephemeral execution trace and contract schema versions returned for
          this evaluation request. Results are not persisted.
        </p>
      </div>

      <div className="pg-provenance-grid">
        <div className="pg-provenance-item">
          <span className="pg-meta-label">Trace ID</span>
          <div className="pg-copyable-field">
            <code>{response.metadata.traceId}</code>
            <button
              type="button"
              onClick={copyTrace}
              className="pg-copy-btn"
              aria-label="Copy Trace ID to clipboard"
            >
              {copiedTrace ? "Copied" : "Copy"}
            </button>
          </div>
        </div>

        <div className="pg-provenance-item">
          <span className="pg-meta-label">Request ID</span>
          <code>{response.metadata.requestId}</code>
        </div>

        <div className="pg-provenance-item">
          <span className="pg-meta-label">Received (UTC)</span>
          <span>{formatUtc(response.metadata.receivedAt)}</span>
        </div>

        <div className="pg-provenance-item">
          <span className="pg-meta-label">Responded (UTC)</span>
          <span>{formatUtc(response.metadata.respondedAt)}</span>
        </div>

        <div className="pg-provenance-item">
          <span className="pg-meta-label">Ruleset Version</span>
          <code>{response.deterministic.rulesetVersion}</code>
        </div>

        <div className="pg-provenance-item">
          <span className="pg-meta-label">Contract Schema</span>
          <code>v{response.schemaVersion}</code>
        </div>
      </div>

      <details className="pg-raw-details">
        <summary className="pg-raw-summary">
          View raw contract response payload (JSON)
        </summary>
        <pre className="pg-raw-json">
          <code>{JSON.stringify(response, null, 2)}</code>
        </pre>
      </details>
    </footer>
  );
};
