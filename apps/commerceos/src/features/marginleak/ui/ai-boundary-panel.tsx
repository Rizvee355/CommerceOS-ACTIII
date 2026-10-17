"use client";

type AiBoundaryPanelProps = {
  rulesetVersion: string;
};

export function AiBoundaryPanel({ rulesetVersion }: AiBoundaryPanelProps) {
  return (
    <section
      className="ml-governance-card ml-ai-boundary-card"
      aria-labelledby="ml-ai-boundary-heading"
    >
      <div className="ml-governance-top">
        <span className="status-pill status-neutral">
          Deterministic-Only Contract (G4)
        </span>
        <span className="ml-meta-chip">
          AI Inference: <code>Not Invoked</code>
        </span>
      </div>

      <h3 id="ml-ai-boundary-heading" className="ml-governance-title">
        Why AI never calculates financial variance
      </h3>
      <p className="ml-governance-copy">
        Unlike PromiseGuard (whose contract includes optional,
        disabled-by-default advisory AI recommendation slots alongside
        deterministic SLA rules), the <strong>MarginLeak v1.0 contract</strong>{" "}
        omits <code>aiRecommendation</code> and <code>inference</code> fields
        entirely by design:
      </p>
      <ul className="ml-boundary-list">
        <li>
          <strong>100% deterministic integer math:</strong> Contribution
          margins, signed variances, and leak amounts are computed exclusively
          in exact minor currency units by ruleset <code>{rulesetVersion}</code>
          .
        </li>
        <li>
          <strong>Zero hallucinated recoveries:</strong> AI models never invent
          financial numbers, classify leak status, or promise automated cash
          recovery.
        </li>
        <li>
          <strong>Fail-closed completeness &amp; finality:</strong> Missing
          observations are never coerced to <code>$0.00</code>, and provisional
          observations never produce a confirmed <code>leakAmount</code>.
        </li>
      </ul>
    </section>
  );
}
