import type { FormEvent, Ref } from "react";

import { CheckboxField, SelectField, TextField, UtcField } from "./form-fields";
import { formatUtc } from "./format";
import {
  blockerCodes,
  fieldDomId,
  groupLabels,
  patchGroup,
  type BlockerCode,
  type BlockingStatus,
  type EvidenceGroup,
  type EvidenceTimes,
  type FieldKey,
  type FulfillmentStateValue,
  type InventoryStatus,
  type PromiseGuardDraft,
} from "./form-model";

const inventoryOptions: ReadonlyArray<{
  value: InventoryStatus;
  label: string;
}> = [
  { value: "secured", label: "Secured" },
  { value: "not_secured", label: "Not secured" },
  { value: "unknown", label: "Unknown" },
];

const fulfillmentOptions: ReadonlyArray<{
  value: FulfillmentStateValue;
  label: string;
}> = [
  { value: "not_started", label: "Not started" },
  { value: "in_progress", label: "In progress" },
  { value: "ready", label: "Ready" },
  { value: "blocked", label: "Blocked" },
  { value: "unknown", label: "Unknown" },
];

const blockingOptions: ReadonlyArray<{ value: BlockingStatus; label: string }> =
  [
    { value: "none_known", label: "No known blockers" },
    { value: "active", label: "Active blocker" },
    { value: "unknown", label: "Unknown" },
  ];

const blockerLabels: Record<BlockerCode, string> = {
  inventory_shortage: "Inventory shortage",
  fulfillment_hold: "Fulfillment hold",
  capacity_constraint: "Capacity constraint",
  cutoff_missed: "Cutoff missed",
  other_operational_blocker: "Other operational blocker",
};

export type FieldErrors = Partial<Record<FieldKey, string>>;

type TimesFieldsProps = {
  group: EvidenceGroup;
  noun: string;
  draft: PromiseGuardDraft;
  errors: FieldErrors;
  disabled: boolean;
  onChange: (draft: PromiseGuardDraft) => void;
};

function TimesFields({
  group,
  noun,
  draft,
  errors,
  disabled,
  onChange,
}: TimesFieldsProps) {
  const times: EvidenceTimes = draft[group];
  const patch = (next: Partial<EvidenceTimes>) =>
    onChange(patchGroup(draft, group, next));

  return (
    <div className="pg-grid-2">
      <UtcField
        fieldKey={`${group}.observedAt`}
        label="Observed at"
        hint={`When this ${noun} was observed. Read as UTC.`}
        error={errors[`${group}.observedAt`]}
        value={times.observedAt}
        disabled={disabled}
        onChange={(observedAt) => patch({ observedAt })}
      />
      <div>
        <UtcField
          fieldKey={`${group}.validUntil`}
          label="Valid until"
          hint="After this time the evidence is treated as expired. Read as UTC."
          error={errors[`${group}.validUntil`]}
          value={times.validUntil}
          disabled={disabled || times.validityUnknown}
          onChange={(validUntil) => patch({ validUntil })}
        />
        <CheckboxField
          fieldKey={`${group}.validityUnknown`}
          label="Validity is unknown"
          hint="No expiry is stated. The server cannot treat this evidence as current."
          error={errors[`${group}.validityUnknown`]}
          checked={times.validityUnknown}
          disabled={disabled}
          onChange={(validityUnknown) => patch({ validityUnknown })}
        />
      </div>
    </div>
  );
}

export type EvidenceFormProps = {
  draft: PromiseGuardDraft;
  errors: FieldErrors;
  disabled: boolean;
  serverTime: string | null;
  headingRef: Ref<HTMLHeadingElement>;
  onChange: (draft: PromiseGuardDraft) => void;
  onSubmit: () => void;
  onReset: () => void;
};

export function EvidenceForm({
  draft,
  errors,
  disabled,
  serverTime,
  headingRef,
  onChange,
  onSubmit,
  onReset,
}: EvidenceFormProps) {
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  const toggleCode = (code: BlockerCode, checked: boolean) => {
    const codes = checked
      ? [...draft.blocking.codes, code]
      : draft.blocking.codes.filter((existing) => existing !== code);
    onChange(patchGroup(draft, "blocking", { codes }));
  };

  const codesId = fieldDomId("blocking.codes");
  const codesError = errors["blocking.codes"];

  return (
    <form
      className="pg-card pg-form"
      noValidate
      onSubmit={submit}
      aria-labelledby="pg-form-heading"
    >
      <header className="pg-card-header">
        <div>
          <p className="eyebrow">Step 2</p>
          <h2 id="pg-form-heading" tabIndex={-1} ref={headingRef}>
            Review and edit the evidence
          </h2>
        </div>
        <button
          type="button"
          className="pg-button pg-button-quiet"
          onClick={onReset}
          disabled={disabled}
        >
          Reset to scenario
        </button>
      </header>

      <p className="pg-notice" data-tone="synthetic">
        <strong>Synthetic data only.</strong> Scenario{" "}
        <code>{draft.scenarioId}</code>. Evidence origin is fixed to
        &ldquo;synthetic fixture&rdquo;.
        {serverTime
          ? ` Times were generated from the server clock at ${formatUtc(serverTime)}.`
          : ""}
      </p>

      <fieldset className="pg-group" disabled={disabled}>
        <legend>Commitment</legend>
        <TextField
          fieldKey="fulfillmentRef"
          label="Fulfillment reference"
          hint="An opaque reference for this synthetic fulfillment."
          error={errors.fulfillmentRef}
          value={draft.fulfillmentRef}
          onChange={(fulfillmentRef) => onChange({ ...draft, fulfillmentRef })}
        />
        <UtcField
          fieldKey="dispatchBy"
          label="Dispatch by"
          hint="The merchant's dispatch commitment. Read as UTC."
          error={errors.dispatchBy}
          value={draft.commitment.dispatchBy}
          onChange={(dispatchBy) =>
            onChange({
              ...draft,
              commitment: { ...draft.commitment, dispatchBy },
            })
          }
        />
      </fieldset>

      <fieldset className="pg-group" disabled={disabled}>
        <legend>{groupLabels.inventory}</legend>
        <SelectField
          fieldKey="inventory.status"
          label="Allocation status"
          hint="Whether inventory is allocated to this fulfillment."
          error={errors["inventory.status"]}
          value={draft.inventory.status}
          options={inventoryOptions}
          onChange={(status) =>
            onChange(patchGroup(draft, "inventory", { status }))
          }
        />
        <TimesFields
          group="inventory"
          noun="inventory allocation"
          draft={draft}
          errors={errors}
          disabled={disabled}
          onChange={onChange}
        />
      </fieldset>

      <fieldset className="pg-group" disabled={disabled}>
        <legend>{groupLabels.fulfillment}</legend>
        <SelectField
          fieldKey="fulfillment.state"
          label="State"
          hint="Where the fulfillment is in its workflow."
          error={errors["fulfillment.state"]}
          value={draft.fulfillment.state}
          options={fulfillmentOptions}
          onChange={(state) =>
            onChange(patchGroup(draft, "fulfillment", { state }))
          }
        />
        <TimesFields
          group="fulfillment"
          noun="fulfillment state"
          draft={draft}
          errors={errors}
          disabled={disabled}
          onChange={onChange}
        />
      </fieldset>

      <fieldset className="pg-group" disabled={disabled}>
        <legend>{groupLabels.blocking}</legend>
        <SelectField
          fieldKey="blocking.status"
          label="Blocking status"
          hint="Whether anything is currently blocking this fulfillment."
          error={errors["blocking.status"]}
          value={draft.blocking.status}
          options={blockingOptions}
          onChange={(status) =>
            onChange(
              patchGroup(draft, "blocking", {
                status,
                codes: status === "active" ? draft.blocking.codes : [],
              }),
            )
          }
        />
        {draft.blocking.status === "active" ? (
          <fieldset
            className="pg-subgroup"
            aria-describedby={codesError ? `${codesId}-error` : undefined}
          >
            <legend>Blocker codes</legend>
            <p className="pg-hint">Select every code that applies.</p>
            <div className="pg-checks">
              {blockerCodes.map((code, index) => (
                <label className="pg-check" key={code}>
                  <input
                    id={index === 0 ? codesId : `${codesId}-${code}`}
                    type="checkbox"
                    checked={draft.blocking.codes.includes(code)}
                    aria-invalid={codesError ? true : undefined}
                    onChange={(event) => toggleCode(code, event.target.checked)}
                  />
                  <span>{blockerLabels[code]}</span>
                </label>
              ))}
            </div>
            {codesError ? (
              <p className="pg-field-error" id={`${codesId}-error`}>
                <span aria-hidden="true">▲ </span>
                <span className="sr-only">Error: </span>
                {codesError}
              </p>
            ) : null}
          </fieldset>
        ) : null}
        <TimesFields
          group="blocking"
          noun="blocking state"
          draft={draft}
          errors={errors}
          disabled={disabled}
          onChange={onChange}
        />
      </fieldset>

      <fieldset className="pg-group" disabled={disabled}>
        <legend>{groupLabels.estimate} (optional)</legend>
        <CheckboxField
          fieldKey="estimate.include"
          label="Include a readiness estimate"
          hint="Without one, the server reports the estimate as missing."
          error={errors["estimate.include"]}
          checked={draft.estimate.include}
          onChange={(include) =>
            onChange(patchGroup(draft, "estimate", { include }))
          }
        />
        {draft.estimate.include ? (
          <>
            <UtcField
              fieldKey="estimate.estimatedReadyAt"
              label="Estimated ready at"
              hint="When fulfillment is expected to be ready. An estimate is not a dispatch guarantee. Read as UTC."
              error={errors["estimate.estimatedReadyAt"]}
              value={draft.estimate.estimatedReadyAt}
              onChange={(estimatedReadyAt) =>
                onChange(patchGroup(draft, "estimate", { estimatedReadyAt }))
              }
            />
            <TimesFields
              group="estimate"
              noun="readiness estimate"
              draft={draft}
              errors={errors}
              disabled={disabled}
              onChange={onChange}
            />
          </>
        ) : null}
      </fieldset>

      <details className="pg-details">
        <summary>Technical details: evidence identifiers</summary>
        <dl className="pg-dl">
          <div>
            <dt>Commitment</dt>
            <dd>{draft.commitment.evidenceId}</dd>
          </div>
          <div>
            <dt>Inventory allocation</dt>
            <dd>{draft.inventory.evidenceId}</dd>
          </div>
          <div>
            <dt>Fulfillment state</dt>
            <dd>{draft.fulfillment.evidenceId}</dd>
          </div>
          <div>
            <dt>Blocking state</dt>
            <dd>{draft.blocking.evidenceId}</dd>
          </div>
          {draft.estimate.include ? (
            <div>
              <dt>Readiness estimate</dt>
              <dd>{draft.estimate.evidenceId}</dd>
            </div>
          ) : null}
        </dl>
      </details>

      <div className="pg-actions">
        <button
          type="submit"
          className="pg-button pg-button-primary"
          disabled={disabled}
          aria-disabled={disabled}
        >
          {disabled ? "Analyzing…" : "Run analysis"}
        </button>
        <p className="pg-hint">
          The server evaluates this against its own clock. Results are not
          saved.
        </p>
      </div>
    </form>
  );
}
