"use client";

type AnalysisProgressProps = {
  orderRef: string;
  scenarioId: string;
  onCancel: () => void;
};

export function AnalysisProgress({
  orderRef,
  scenarioId,
  onCancel,
}: AnalysisProgressProps) {
  return (
    <div
      className="ml-progress-panel"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="ml-progress-header">
        <span className="ml-spinner" aria-hidden="true" />
        <div>
          <p className="eyebrow">Deterministic Evaluation In Flight</p>
          <h3 className="ml-progress-title">
            Reconciling contribution margin for order <code>{orderRef}</code>
          </h3>
        </div>
      </div>
      <p className="ml-progress-body">
        Validating 8 financial categories against{" "}
        <code>POST /api/v1/marginleak/analyze</code> for scenario{" "}
        <code>{scenarioId}</code>...
      </p>
      <div className="ml-progress-actions">
        <button
          type="button"
          className="pg-btn pg-btn-secondary"
          onClick={onCancel}
        >
          Cancel Evaluation
        </button>
      </div>
    </div>
  );
}
