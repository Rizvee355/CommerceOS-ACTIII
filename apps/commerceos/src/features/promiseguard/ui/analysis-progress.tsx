"use client";

import { useEffect, useState } from "react";

export type AnalysisProgressProps = {
  onCancel: () => void;
};

export const AnalysisProgress = ({ onCancel }: AnalysisProgressProps) => {
  const [secondsElapsed, setSecondsElapsed] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      className="pg-progress-card"
      id="pg-analysis-progress"
    >
      <div className="pg-progress-indicator">
        <div className="pg-spinner" aria-hidden="true" />
        <div className="pg-progress-content">
          <div className="pg-progress-title">
            Evaluating evidence and orchestrating analysis...
          </div>
          <div className="pg-progress-detail">
            Running deterministic rule evaluation and checking AI assistance.
            Elapsed: <strong>{secondsElapsed}s</strong>.
          </div>
        </div>
      </div>

      <div className="pg-progress-actions">
        <button
          type="button"
          onClick={onCancel}
          className="pg-button pg-button-secondary"
        >
          Cancel evaluation
        </button>
      </div>
    </div>
  );
};
