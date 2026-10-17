import type { ReactNode } from "react";

import { fieldDomId, type FieldKey } from "./form-model";

type Option<T extends string> = { value: T; label: string };

type FieldFrameProps = {
  fieldKey: FieldKey;
  label: ReactNode;
  hint?: string;
  error?: string;
  children: (aria: {
    id: string;
    "aria-describedby": string | undefined;
    "aria-invalid": true | undefined;
  }) => ReactNode;
};

/** Label + control + hint + inline error, wired together for assistive tech. */
function FieldFrame({
  fieldKey,
  label,
  hint,
  error,
  children,
}: FieldFrameProps) {
  const id = fieldDomId(fieldKey);
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy =
    [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") ||
    undefined;

  return (
    <div className="pg-field" data-invalid={error ? "true" : undefined}>
      <label className="pg-label" htmlFor={id}>
        {label}
      </label>
      {hint ? (
        <p className="pg-hint" id={hintId}>
          {hint}
        </p>
      ) : null}
      {children({
        id,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
      })}
      {error ? (
        <p className="pg-field-error" id={errorId}>
          <span aria-hidden="true">▲ </span>
          <span className="sr-only">Error: </span>
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function TextField(props: {
  fieldKey: FieldKey;
  label: string;
  hint?: string;
  error?: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const { fieldKey, label, hint, error, value, disabled, onChange } = props;
  return (
    <FieldFrame fieldKey={fieldKey} label={label} hint={hint} error={error}>
      {(aria) => (
        <input
          {...aria}
          className="pg-control"
          type="text"
          value={value}
          disabled={disabled}
          maxLength={128}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </FieldFrame>
  );
}

export function SelectField<T extends string>(props: {
  fieldKey: FieldKey;
  label: string;
  hint?: string;
  error?: string;
  value: T;
  options: ReadonlyArray<Option<T>>;
  disabled?: boolean;
  onChange: (value: T) => void;
}) {
  const { fieldKey, label, hint, error, value, options, disabled, onChange } =
    props;
  return (
    <FieldFrame fieldKey={fieldKey} label={label} hint={hint} error={error}>
      {(aria) => (
        <select
          {...aria}
          className="pg-control"
          value={value}
          disabled={disabled}
          onChange={(event) => {
            const next = options.find(
              (option) => option.value === event.target.value,
            );
            if (next) onChange(next.value);
          }}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </FieldFrame>
  );
}

/** A date-time control whose digits are read and written as UTC. */
export function UtcField(props: {
  fieldKey: FieldKey;
  label: string;
  hint?: string;
  error?: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const { fieldKey, label, hint, error, value, disabled, onChange } = props;
  return (
    <FieldFrame
      fieldKey={fieldKey}
      label={
        <>
          {label} <span className="pg-utc-badge">UTC</span>
        </>
      }
      hint={hint ?? "Read as UTC, not your local time zone."}
      error={error}
    >
      {(aria) => (
        <input
          {...aria}
          className="pg-control"
          type="datetime-local"
          step={60}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </FieldFrame>
  );
}

export function CheckboxField(props: {
  fieldKey: FieldKey;
  label: string;
  hint?: string;
  error?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  const { fieldKey, label, hint, error, checked, disabled, onChange } = props;
  const id = fieldDomId(fieldKey);
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy =
    [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") ||
    undefined;

  return (
    <div className="pg-field" data-invalid={error ? "true" : undefined}>
      <label className="pg-check" htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span>{label}</span>
      </label>
      {hint ? (
        <p className="pg-hint pg-check-hint" id={hintId}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="pg-field-error" id={errorId}>
          <span aria-hidden="true">▲ </span>
          <span className="sr-only">Error: </span>
          {error}
        </p>
      ) : null}
    </div>
  );
}
