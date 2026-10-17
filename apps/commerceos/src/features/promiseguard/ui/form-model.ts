import {
  promiseGuardBlockerCodeSchema,
  promiseGuardEvaluationRequestSchema,
  promiseGuardOpaqueIdSchema,
  type PromiseGuardEvaluationRequest,
  type PromiseGuardFinding,
} from "@commerceos/contracts";

import type { PromiseGuardPresetId } from "../domain/presets";

/**
 * Form model for the synthetic PromiseGuard request.
 *
 * The draft mirrors ONLY fields of the approved request contract. The final
 * gate is always `promiseGuardEvaluationRequestSchema`; UI-level checks exist
 * solely to give field-specific, human-readable messages first.
 */

type Evidence = PromiseGuardEvaluationRequest["operationalEvidence"];

export type BlockerCode = Evidence["blockingState"]["codes"][number];
export type InventoryStatus = Evidence["inventoryAllocation"]["status"];
export type FulfillmentStateValue = Evidence["fulfillmentState"]["state"];
export type BlockingStatus = Evidence["blockingState"]["status"];

export const blockerCodes: readonly BlockerCode[] =
  promiseGuardBlockerCodeSchema.options;

export type EvidenceGroup =
  "inventory" | "fulfillment" | "blocking" | "estimate";

type TimeField = "observedAt" | "validUntil" | "validityUnknown";

export type FieldKey =
  | "fulfillmentRef"
  | "dispatchBy"
  | "inventory.status"
  | "fulfillment.state"
  | "blocking.status"
  | "blocking.codes"
  | "estimate.include"
  | "estimate.estimatedReadyAt"
  | `${EvidenceGroup}.${TimeField}`;

export type EvidenceTimes = {
  /** `YYYY-MM-DDTHH:mm`, interpreted as UTC. Empty when not entered. */
  observedAt: string;
  validUntil: string;
  validityUnknown: boolean;
};

export type PromiseGuardDraft = {
  presetId: PromiseGuardPresetId;
  scenarioId: string;
  fulfillmentRef: string;
  commitment: { evidenceId: string; dispatchBy: string };
  inventory: EvidenceTimes & { evidenceId: string; status: InventoryStatus };
  fulfillment: EvidenceTimes & {
    evidenceId: string;
    state: FulfillmentStateValue;
  };
  blocking: EvidenceTimes & {
    evidenceId: string;
    status: BlockingStatus;
    codes: BlockerCode[];
  };
  estimate: EvidenceTimes & {
    evidenceId: string;
    include: boolean;
    estimatedReadyAt: string;
  };
};

export type FieldError = {
  key: FieldKey | null;
  message: string;
};

export type ValidationResult =
  | { ok: true; request: PromiseGuardEvaluationRequest }
  | { ok: false; errors: FieldError[] };

const MINUTE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const SECOND = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;

/** RFC 3339 UTC -> value for a datetime-local control (read as UTC). */
export const toInput = (iso: string | null | undefined): string =>
  iso ? iso.slice(0, 16) : "";

/** datetime-local value (read as UTC) -> RFC 3339 UTC. Invalid input is left as-is so the schema rejects it. */
export const fromInput = (value: string): string =>
  MINUTE.test(value)
    ? `${value}:00.000Z`
    : SECOND.test(value)
      ? `${value}.000Z`
      : value;

const isValidInput = (value: string): boolean =>
  (MINUTE.test(value) || SECOND.test(value)) &&
  !Number.isNaN(Date.parse(fromInput(value)));

export const groupLabels: Record<EvidenceGroup, string> = {
  inventory: "Inventory allocation",
  fulfillment: "Fulfillment state",
  blocking: "Blocking state",
  estimate: "Readiness estimate",
};

export const fieldLabels: Record<FieldKey, string> = {
  fulfillmentRef: "Fulfillment reference",
  dispatchBy: "Dispatch by",
  "inventory.status": "Inventory allocation status",
  "fulfillment.state": "Fulfillment state",
  "blocking.status": "Blocking status",
  "blocking.codes": "Blocker codes",
  "estimate.include": "Readiness estimate",
  "estimate.estimatedReadyAt": "Estimated ready at",
  "inventory.observedAt": "Inventory allocation observed at",
  "inventory.validUntil": "Inventory allocation valid until",
  "inventory.validityUnknown": "Inventory allocation validity",
  "fulfillment.observedAt": "Fulfillment state observed at",
  "fulfillment.validUntil": "Fulfillment state valid until",
  "fulfillment.validityUnknown": "Fulfillment state validity",
  "blocking.observedAt": "Blocking state observed at",
  "blocking.validUntil": "Blocking state valid until",
  "blocking.validityUnknown": "Blocking state validity",
  "estimate.observedAt": "Readiness estimate observed at",
  "estimate.validUntil": "Readiness estimate valid until",
  "estimate.validityUnknown": "Readiness estimate validity",
};

export const fieldDomId = (key: FieldKey): string =>
  `pg-field-${key.replaceAll(".", "-")}`;

const timesOf = (snapshot: {
  observedAt: string;
  validUntil: string | null;
}): EvidenceTimes => ({
  observedAt: toInput(snapshot.observedAt),
  validUntil: toInput(snapshot.validUntil),
  validityUnknown: snapshot.validUntil === null,
});

/** Converts a schema-valid preset request into an editable draft. */
export const presetToDraft = (
  request: PromiseGuardEvaluationRequest,
  presetId: PromiseGuardPresetId,
): PromiseGuardDraft => {
  const evidence = request.operationalEvidence;
  const estimate = evidence.readyTimeEstimate;
  const commitmentId = request.commitment.evidenceId;
  const absentEstimateId = commitmentId.startsWith("ev-commitment-")
    ? commitmentId.replace("ev-commitment-", "ev-estimate-")
    : `${commitmentId}-estimate`;

  return {
    presetId,
    scenarioId: request.scenario.scenarioId,
    fulfillmentRef: request.fulfillmentRef,
    commitment: {
      evidenceId: commitmentId,
      dispatchBy: toInput(request.commitment.dispatchBy),
    },
    inventory: {
      evidenceId: evidence.inventoryAllocation.evidenceId,
      status: evidence.inventoryAllocation.status,
      ...timesOf(evidence.inventoryAllocation),
    },
    fulfillment: {
      evidenceId: evidence.fulfillmentState.evidenceId,
      state: evidence.fulfillmentState.state,
      ...timesOf(evidence.fulfillmentState),
    },
    blocking: {
      evidenceId: evidence.blockingState.evidenceId,
      status: evidence.blockingState.status,
      codes: [...evidence.blockingState.codes],
      ...timesOf(evidence.blockingState),
    },
    estimate: estimate
      ? {
          evidenceId: estimate.evidenceId,
          include: true,
          estimatedReadyAt: toInput(estimate.estimatedReadyAt),
          ...timesOf(estimate),
        }
      : {
          evidenceId: absentEstimateId,
          include: false,
          estimatedReadyAt: "",
          // Editable starting point only; the merchant still supplies the
          // estimate itself.
          observedAt: toInput(evidence.fulfillmentState.observedAt),
          validUntil: toInput(evidence.fulfillmentState.validUntil),
          validityUnknown: false,
        },
  };
};

export const patchGroup = <G extends EvidenceGroup>(
  draft: PromiseGuardDraft,
  group: G,
  patch: Partial<PromiseGuardDraft[G]>,
): PromiseGuardDraft =>
  ({
    ...draft,
    [group]: { ...draft[group], ...patch },
  }) as PromiseGuardDraft;

const evidenceInput = (
  group: {
    evidenceId: string;
  } & EvidenceTimes,
) => ({
  evidenceId: group.evidenceId,
  origin: "synthetic_fixture" as const,
  observedAt: fromInput(group.observedAt),
  validUntil: group.validityUnknown ? null : fromInput(group.validUntil),
});

/** Builds the raw (not yet validated) request body from the draft. */
export const draftToRequestInput = (draft: PromiseGuardDraft): unknown => ({
  schemaVersion: "1.0",
  moduleId: "promiseguard",
  scenario: { scenarioId: draft.scenarioId, synthetic: true },
  fulfillmentRef: draft.fulfillmentRef.trim(),
  commitment: {
    evidenceId: draft.commitment.evidenceId,
    kind: "dispatch_by",
    dispatchBy: fromInput(draft.commitment.dispatchBy),
  },
  operationalEvidence: {
    inventoryAllocation: {
      ...evidenceInput(draft.inventory),
      status: draft.inventory.status,
    },
    fulfillmentState: {
      ...evidenceInput(draft.fulfillment),
      state: draft.fulfillment.state,
    },
    blockingState: {
      ...evidenceInput(draft.blocking),
      status: draft.blocking.status,
      codes: draft.blocking.status === "active" ? draft.blocking.codes : [],
    },
    ...(draft.estimate.include
      ? {
          readyTimeEstimate: {
            ...evidenceInput(draft.estimate),
            estimatedReadyAt: fromInput(draft.estimate.estimatedReadyAt),
          },
        }
      : {}),
  },
});

export const pointerFromPath = (path: readonly PropertyKey[]): string =>
  path.length === 0
    ? "/"
    : `/${path
        .map((segment) =>
          String(segment).replaceAll("~", "~0").replaceAll("/", "~1"),
        )
        .join("/")}`;

const groupPointers: Record<
  EvidenceGroup,
  { pointer: string; primary: FieldKey; value?: string; valueKey?: FieldKey }
> = {
  inventory: {
    pointer: "/operationalEvidence/inventoryAllocation",
    primary: "inventory.status",
    value: "status",
    valueKey: "inventory.status",
  },
  fulfillment: {
    pointer: "/operationalEvidence/fulfillmentState",
    primary: "fulfillment.state",
    value: "state",
    valueKey: "fulfillment.state",
  },
  blocking: {
    pointer: "/operationalEvidence/blockingState",
    primary: "blocking.status",
    value: "status",
    valueKey: "blocking.status",
  },
  estimate: {
    pointer: "/operationalEvidence/readyTimeEstimate",
    primary: "estimate.include",
    value: "estimatedReadyAt",
    valueKey: "estimate.estimatedReadyAt",
  },
};

const pointerKeys: ReadonlyMap<string, FieldKey> = (() => {
  const map = new Map<string, FieldKey>([
    ["/fulfillmentRef", "fulfillmentRef"],
    ["/commitment", "dispatchBy"],
    ["/commitment/dispatchBy", "dispatchBy"],
    ["/operationalEvidence/blockingState/codes", "blocking.codes"],
  ]);
  (Object.keys(groupPointers) as EvidenceGroup[]).forEach((group) => {
    const entry = groupPointers[group];
    map.set(entry.pointer, entry.primary);
    map.set(`${entry.pointer}/observedAt`, `${group}.observedAt`);
    map.set(`${entry.pointer}/validUntil`, `${group}.validUntil`);
    if (entry.value && entry.valueKey) {
      map.set(`${entry.pointer}/${entry.value}`, entry.valueKey);
    }
  });
  return map;
})();

/** Maps a JSON Pointer from the contract to the editable form control, if any. */
export const keyForPointer = (pointer: string): FieldKey | null => {
  const exact = pointerKeys.get(pointer);
  if (exact) return exact;
  let best: FieldKey | null = null;
  let bestLength = 0;
  for (const [candidate, key] of pointerKeys) {
    if (pointer.startsWith(`${candidate}/`) && candidate.length > bestLength) {
      best = key;
      bestLength = candidate.length;
    }
  }
  return best;
};

const timeErrors = (
  errors: FieldError[],
  group: EvidenceGroup,
  noun: string,
  times: EvidenceTimes,
): void => {
  if (!times.observedAt) {
    errors.push({
      key: `${group}.observedAt`,
      message: `Enter when the ${noun} was observed (UTC).`,
    });
  } else if (!isValidInput(times.observedAt)) {
    errors.push({
      key: `${group}.observedAt`,
      message: "Enter a valid UTC date and time.",
    });
  }

  if (times.validityUnknown) return;
  if (!times.validUntil) {
    errors.push({
      key: `${group}.validUntil`,
      message: `Enter when this ${noun} stops being valid (UTC), or mark its validity as unknown.`,
    });
  } else if (!isValidInput(times.validUntil)) {
    errors.push({
      key: `${group}.validUntil`,
      message: "Enter a valid UTC date and time.",
    });
  } else if (
    isValidInput(times.observedAt) &&
    Date.parse(fromInput(times.validUntil)) <
      Date.parse(fromInput(times.observedAt))
  ) {
    errors.push({
      key: `${group}.validUntil`,
      message: "Validity must not end before the observation time.",
    });
  }
};

/**
 * Validates the draft. Field-specific checks come first for readable messages;
 * the approved request schema is always the final authority.
 */
export const validateDraft = (draft: PromiseGuardDraft): ValidationResult => {
  const errors: FieldError[] = [];

  if (!draft.fulfillmentRef.trim()) {
    errors.push({
      key: "fulfillmentRef",
      message: "Enter a fulfillment reference.",
    });
  } else if (
    !promiseGuardOpaqueIdSchema.safeParse(draft.fulfillmentRef).success
  ) {
    errors.push({
      key: "fulfillmentRef",
      message:
        "Use up to 128 letters, numbers, dots, underscores, colons or hyphens, starting with a letter or number.",
    });
  }

  if (!draft.commitment.dispatchBy) {
    errors.push({
      key: "dispatchBy",
      message: "Enter the dispatch-by time (UTC).",
    });
  } else if (!isValidInput(draft.commitment.dispatchBy)) {
    errors.push({
      key: "dispatchBy",
      message: "Enter a valid UTC date and time.",
    });
  }

  timeErrors(errors, "inventory", "inventory allocation", draft.inventory);
  timeErrors(errors, "fulfillment", "fulfillment state", draft.fulfillment);

  if (draft.blocking.status === "active" && draft.blocking.codes.length === 0) {
    errors.push({
      key: "blocking.codes",
      message: "Select at least one blocker code when a blocker is active.",
    });
  }
  timeErrors(errors, "blocking", "blocking state", draft.blocking);

  if (draft.estimate.include) {
    if (!draft.estimate.estimatedReadyAt) {
      errors.push({
        key: "estimate.estimatedReadyAt",
        message: "Enter the estimated ready time (UTC).",
      });
    } else if (!isValidInput(draft.estimate.estimatedReadyAt)) {
      errors.push({
        key: "estimate.estimatedReadyAt",
        message: "Enter a valid UTC date and time.",
      });
    }
    timeErrors(errors, "estimate", "readiness estimate", draft.estimate);
  }

  if (errors.length > 0) return { ok: false, errors };

  const parsed = promiseGuardEvaluationRequestSchema.safeParse(
    draftToRequestInput(draft),
  );
  if (parsed.success) return { ok: true, request: parsed.data };

  return {
    ok: false,
    errors: parsed.error.issues.map((issue) => {
      const key = keyForPointer(pointerFromPath(issue.path));
      return {
        key,
        message: key
          ? "This value is not accepted. Check it and try again."
          : "The values together do not match the PromiseGuard contract.",
      };
    }),
  };
};

/** Maps server `fieldErrors` (JSON Pointer paths) onto form controls. */
export const mapServerFieldErrors = (
  fieldErrors: ReadonlyArray<{ path: string }> | undefined,
): FieldError[] =>
  (fieldErrors ?? []).map(({ path }) => {
    const key = keyForPointer(path);
    return {
      key,
      message: key
        ? "The server did not accept this value. Check it and try again."
        : `The server did not accept the value at ${path}.`,
    };
  });

/** Finds which part of the request carries an evidence identifier. */
export const groupOfEvidence = (
  request: PromiseGuardEvaluationRequest,
  evidenceId: string,
): EvidenceGroup | "commitment" | null => {
  const evidence = request.operationalEvidence;
  if (request.commitment.evidenceId === evidenceId) return "commitment";
  if (evidence.inventoryAllocation.evidenceId === evidenceId)
    return "inventory";
  if (evidence.fulfillmentState.evidenceId === evidenceId) return "fulfillment";
  if (evidence.blockingState.evidenceId === evidenceId) return "blocking";
  if (evidence.readyTimeEstimate?.evidenceId === evidenceId) return "estimate";
  return null;
};

/**
 * Which editable control addresses a finding, if any. Missing-fact findings
 * resolve through their approved JSON Pointer, never an invented evidence id.
 */
export const focusKeyForFinding = (
  finding: PromiseGuardFinding,
  request: PromiseGuardEvaluationRequest,
): FieldKey | null => {
  if (finding.impact === "supporting") return null;

  if (finding.trace.kind === "field_path") {
    const [first] = finding.trace.fieldPaths;
    return first ? keyForPointer(first) : null;
  }

  const [firstId] = finding.trace.evidenceIds;
  const group = firstId ? groupOfEvidence(request, firstId) : null;
  const timeGroup = group && group !== "commitment" ? group : null;

  switch (finding.code) {
    case "UNKNOWN_EVIDENCE_VALIDITY":
      return timeGroup ? `${timeGroup}.validityUnknown` : null;
    case "EXPIRED_EVIDENCE":
      return timeGroup ? `${timeGroup}.validUntil` : null;
    case "FUTURE_DATED_EVIDENCE":
      return timeGroup ? `${timeGroup}.observedAt` : null;
    case "INVENTORY_NOT_SECURED":
    case "UNKNOWN_INVENTORY_STATE":
      return "inventory.status";
    case "FULFILLMENT_BLOCKED":
    case "UNKNOWN_FULFILLMENT_STATE":
    case "CONTRADICTORY_OPERATIONAL_STATE":
      return "fulfillment.state";
    case "ACTIVE_BLOCKER_REPORTED":
    case "UNKNOWN_BLOCKER_STATE":
      return "blocking.status";
    case "READY_ESTIMATE_AFTER_DEADLINE":
    case "READY_ESTIMATE_ELAPSED":
      return "estimate.estimatedReadyAt";
    case "DISPATCH_DEADLINE_ELAPSED":
      return "dispatchBy";
    default:
      return null;
  }
};
