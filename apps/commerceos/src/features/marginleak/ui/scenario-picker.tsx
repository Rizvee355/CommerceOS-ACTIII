"use client";

import { scenarioOptions } from "./labels";
import type { MarginLeakPresetId } from "./presets";

type ScenarioPickerProps = {
  selectedPreset: MarginLeakPresetId;
  disabled?: boolean;
  onSelectPreset: (presetId: MarginLeakPresetId) => void;
};

export function ScenarioPicker({
  selectedPreset,
  disabled = false,
  onSelectPreset,
}: ScenarioPickerProps) {
  return (
    <section
      className="ml-scenario-picker"
      aria-labelledby="ml-scenario-heading"
    >
      <div className="ml-section-header">
        <div>
          <p className="eyebrow">Step 1 · Synthetic Order Fixtures</p>
          <h2 id="ml-scenario-heading" className="ml-section-title">
            Select a synthetic order-margin scenario
          </h2>
        </div>
        <p className="ml-section-subtitle">
          Every preset loads deterministic expected vs. observed financial
          observations in minor currency units. Switching scenarios clears any
          prior result immediately so stale analysis is never shown.
        </p>
      </div>

      <fieldset
        className="ml-scenario-fieldset"
        disabled={disabled}
        aria-label="Synthetic order-margin scenario presets"
      >
        <legend className="sr-only">
          Choose one of the four canonical MarginLeak synthetic scenarios
        </legend>
        <div className="ml-scenario-grid">
          {scenarioOptions.map((option) => {
            const isSelected = selectedPreset === option.id;
            const inputId = `ml-scenario-${option.id}`;
            const descId = `ml-scenario-desc-${option.id}`;

            return (
              <label
                key={option.id}
                htmlFor={inputId}
                className={`ml-scenario-card ${isSelected ? "ml-scenario-card-active" : ""}`}
                data-selected={isSelected ? "true" : "false"}
              >
                <input
                  id={inputId}
                  type="radio"
                  name="marginleak-scenario"
                  value={option.id}
                  checked={isSelected}
                  onChange={() => onSelectPreset(option.id)}
                  aria-describedby={descId}
                  className="ml-scenario-radio"
                />
                <div className="ml-scenario-card-top">
                  <span className="ml-scenario-ordinal">
                    Scenario {option.ordinal}
                  </span>
                  <span
                    className={`status-pill status-${option.tone}`}
                    data-tone={option.tone}
                  >
                    {option.badge}
                  </span>
                </div>
                <span className="ml-scenario-title">{option.title}</span>
                <span id={descId} className="ml-scenario-description">
                  {option.description}
                </span>
                <span className="ml-scenario-intent">{option.intent}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
    </section>
  );
}
