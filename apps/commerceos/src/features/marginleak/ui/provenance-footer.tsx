"use client";

import type { MarginLeakEvaluationResponse } from "@commerceos/contracts";
import { formatUtcTimestamp } from "./format";
import { parseEvidencePathLabel } from "./labels";

type ProvenanceFooterProps = {
  response: MarginLeakEvaluationResponse;
};

export function ProvenanceFooter({ response }: ProvenanceFooterProps) {
  const { metadata, deterministic, scenario } = response;

  return (
    <section
      className="ml-provenance-footer"
      aria-labelledby="ml-provenance-heading"
    >
      <div className="ml-section-header">
        <div>
          <p className="eyebrow">Audit Trail &amp; Contract Provenance</p>
          <h3 id="ml-provenance-heading" className="ml-section-title">
            Envelope metadata &amp; validated evidence references (
            {deterministic.evidenceRefs.length}/16)
          </h3>
        </div>
      </div>

      <dl className="ml-provenance-meta-grid">
        <div>
          <dt>Ruleset Version</dt>
          <dd>
            <code>{deterministic.rulesetVersion}</code>
          </dd>
        </div>
        <div>
          <dt>Scenario ID</dt>
          <dd>
            <code>{scenario.scenarioId}</code> (synthetic:{" "}
            <code>{String(scenario.synthetic)}</code>)
          </dd>
        </div>
        <div>
          <dt>Request ID</dt>
          <dd>
            <code>{metadata.requestId}</code>
          </dd>
        </div>
        <div>
          <dt>Trace ID</dt>
          <dd>
            <code>{metadata.traceId}</code>
          </dd>
        </div>
        <div>
          <dt>Received At (Server UTC)</dt>
          <dd>
            <code>{formatUtcTimestamp(metadata.receivedAt)}</code>
          </dd>
        </div>
        <div>
          <dt>Responded At (Server UTC)</dt>
          <dd>
            <code>{formatUtcTimestamp(metadata.respondedAt)}</code>
          </dd>
        </div>
      </dl>

      <details className="ml-evidence-refs-drawer">
        <summary className="ml-evidence-refs-summary">
          Inspect validated evidence references (
          {deterministic.evidenceRefs.length} present,{" "}
          {deterministic.data.missingEvidencePaths.length} missing)
        </summary>
        <div className="ml-evidence-refs-grid">
          {deterministic.evidenceRefs.map((ref) => {
            const parsed = parseEvidencePathLabel(ref.factPath);
            return (
              <div key={ref.evidenceId} className="ml-evidence-ref-chip">
                <div className="ml-evidence-ref-top">
                  <code>{ref.evidenceId}</code>
                  <span className="ml-source-kind">{ref.sourceKind}</span>
                </div>
                <span className="ml-evidence-ref-label">
                  {parsed.humanLabel}
                </span>
                <code className="ml-evidence-ref-path">{ref.factPath}</code>
              </div>
            );
          })}
        </div>
      </details>
    </section>
  );
}
