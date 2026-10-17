import {
  MARGIN_LEAK_FINANCIAL_CATEGORIES,
  MARGIN_LEAK_MAX_COMPONENT_AMOUNT_MINOR,
  marginLeakEvaluationRequestSchema,
  type ErrorEnvelope,
  type MarginLeakEvaluationRequest,
  type MarginLeakFinancialCategory,
  type MarginLeakFinding,
} from "@commerceos/contracts";
import { CATEGORY_METADATA, type MarginLeakObservationState } from "./labels";
import type { MarginLeakPresetId } from "./presets";

export type ObservationSide = "expected" | "observed";

export type ObservationDraft = {
  included: boolean;
  amountMinor: string;
  evidenceId: string;
  sourceLabel: string;
  recordedAt: string;
};

export type CategoryDraft = {
  expected: ObservationDraft;
  observed: ObservationDraft;
};

export type MarginLeakDraft = {
  presetId: MarginLeakPresetId;
  scenarioId: string;
  orderRef: string;
  currency: string;
  observationState: MarginLeakObservationState;
  financials: Record<MarginLeakFinancialCategory, CategoryDraft>;
};

export type MarginLeakFieldKey =
  | "orderRef"
  | "currency"
  | "observationState"
  | `financials.${MarginLeakFinancialCategory}.${ObservationSide}.included`
  | `financials.${MarginLeakFinancialCategory}.${ObservationSide}.amountMinor`
  | `financials.${MarginLeakFinancialCategory}.${ObservationSide}.evidenceId`
  | `financials.${MarginLeakFinancialCategory}.${ObservationSide}.sourceLabel`
  | `financials.${MarginLeakFinancialCategory}.${ObservationSide}.recordedAt`;

export type MarginLeakFieldError = {
  key: MarginLeakFieldKey;
  label: string;
  message: string;
};

export type ValidationResult =
  | { ok: true; request: MarginLeakEvaluationRequest }
  | { ok: false; errors: MarginLeakFieldError[] };

export const fieldDomId = (key: MarginLeakFieldKey): string =>
  `ml-field-${key.replaceAll(".", "-")}`;

const DEFAULT_MISSING_FALLBACKS: Record<
  MarginLeakFinancialCategory,
  { expectedAmount: string; observedAmount: string; slug: string }
> = {
  grossItemRevenue: {
    expectedAmount: "10000",
    observedAmount: "10000",
    slug: "gross",
  },
  shippingRevenue: {
    expectedAmount: "1000",
    observedAmount: "1000",
    slug: "shipping-revenue",
  },
  discounts: {
    expectedAmount: "500",
    observedAmount: "500",
    slug: "discounts",
  },
  cogs: {
    expectedAmount: "4000",
    observedAmount: "4000",
    slug: "cogs",
  },
  shippingCost: {
    expectedAmount: "800",
    observedAmount: "800",
    slug: "shipping-cost",
  },
  fulfillmentCost: {
    expectedAmount: "300",
    observedAmount: "300",
    slug: "fulfillment",
  },
  paymentCost: {
    expectedAmount: "300",
    observedAmount: "300",
    slug: "payment",
  },
  platformCost: {
    expectedAmount: "200",
    observedAmount: "200",
    slug: "platform",
  },
};

const prefixForPreset = (presetId: MarginLeakPresetId): string => {
  switch (presetId) {
    case "leak_detected":
      return "ld";
    case "no_leak":
      return "nl";
    case "provisional":
      return "pr";
    case "incomplete":
      return "in";
  }
};

export const presetToDraft = (
  request: MarginLeakEvaluationRequest,
  presetId: MarginLeakPresetId,
): MarginLeakDraft => {
  const prefix = prefixForPreset(presetId);
  const financials = {} as Record<MarginLeakFinancialCategory, CategoryDraft>;

  for (const category of MARGIN_LEAK_FINANCIAL_CATEGORIES) {
    const comp = request.financials[category];
    const fallback = DEFAULT_MISSING_FALLBACKS[category];
    const meta = CATEGORY_METADATA[category];

    const exp = comp?.expected;
    const obs = comp?.observed;

    financials[category] = {
      expected: exp
        ? {
            included: true,
            amountMinor: String(exp.amountMinor),
            evidenceId: exp.evidenceId,
            sourceLabel: exp.source.label,
            recordedAt: exp.source.recordedAt,
          }
        : {
            included: false,
            amountMinor: fallback.expectedAmount,
            evidenceId: `${prefix}-${fallback.slug}-expected`,
            sourceLabel: `Expected ${meta.shortLabel.toLowerCase()}`,
            recordedAt: "2026-10-16T08:00:00.000Z",
          },
      observed: obs
        ? {
            included: true,
            amountMinor: String(obs.amountMinor),
            evidenceId: obs.evidenceId,
            sourceLabel: obs.source.label,
            recordedAt: obs.source.recordedAt,
          }
        : {
            included: false,
            amountMinor: fallback.observedAmount,
            evidenceId: `${prefix}-${fallback.slug}-observed`,
            sourceLabel: `Observed ${meta.shortLabel.toLowerCase()}`,
            recordedAt: "2026-10-16T09:00:00.000Z",
          },
    };
  }

  return {
    presetId,
    scenarioId: request.scenario.scenarioId,
    orderRef: request.orderRef,
    currency: request.currency,
    observationState: request.observationState,
    financials,
  };
};

const OPAQUE_ID_REGEX = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;
const CURRENCY_REGEX = /^[A-Z]{3}$/;
const UTC_ISO_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?Z$/;

const isValidUtcIso = (value: string): boolean => {
  if (!UTC_ISO_REGEX.test(value)) return false;
  const parsed = Date.parse(value);
  return !Number.isNaN(parsed);
};

export const validateMarginLeakDraft = (
  draft: MarginLeakDraft,
): ValidationResult => {
  const errors: MarginLeakFieldError[] = [];

  const orderRef = draft.orderRef.trim();
  if (!orderRef) {
    errors.push({
      key: "orderRef",
      label: "Order reference",
      message: "Enter an order reference.",
    });
  } else if (!OPAQUE_ID_REGEX.test(orderRef)) {
    errors.push({
      key: "orderRef",
      label: "Order reference",
      message:
        "Order reference must be 1–64 characters using letters, numbers, '.', '_', ':', or '-'.",
    });
  }

  const currency = draft.currency.trim();
  if (!CURRENCY_REGEX.test(currency)) {
    errors.push({
      key: "currency",
      label: "Order currency",
      message:
        "Currency must be a 3-letter uppercase ISO-4217 code (for example, USD).",
    });
  }

  const seenEvidenceIds = new Set<string>();
  const financialsPayload: MarginLeakEvaluationRequest["financials"] = {};

  for (const category of MARGIN_LEAK_FINANCIAL_CATEGORIES) {
    const catDraft = draft.financials[category];
    const meta = CATEGORY_METADATA[category];
    const catPayload: {
      expected?: NonNullable<
        MarginLeakEvaluationRequest["financials"][MarginLeakFinancialCategory]
      >["expected"];
      observed?: NonNullable<
        MarginLeakEvaluationRequest["financials"][MarginLeakFinancialCategory]
      >["observed"];
    } = {};

    for (const side of ["expected", "observed"] as const) {
      const obs = catDraft[side];
      if (!obs.included) continue;

      const sideTitle = side === "expected" ? "Expected" : "Observed";
      const amountKey: MarginLeakFieldKey = `financials.${category}.${side}.amountMinor`;
      const evIdKey: MarginLeakFieldKey = `financials.${category}.${side}.evidenceId`;
      const labelKey: MarginLeakFieldKey = `financials.${category}.${side}.sourceLabel`;
      const timeKey: MarginLeakFieldKey = `financials.${category}.${side}.recordedAt`;

      const rawAmount = obs.amountMinor.trim();
      let parsedAmount = -1;
      if (rawAmount === "" || !/^\d+$/.test(rawAmount)) {
        errors.push({
          key: amountKey,
          label: `${meta.label} (${sideTitle} amount)`,
          message:
            "Enter a non-negative whole integer in minor currency units (for example, 0 or 4000).",
        });
      } else {
        const numeric = Number(rawAmount);
        if (
          !Number.isSafeInteger(numeric) ||
          numeric < 0 ||
          numeric > MARGIN_LEAK_MAX_COMPONENT_AMOUNT_MINOR
        ) {
          errors.push({
            key: amountKey,
            label: `${meta.label} (${sideTitle} amount)`,
            message: `Amount must be an exact integer between 0 and ${MARGIN_LEAK_MAX_COMPONENT_AMOUNT_MINOR.toLocaleString("en-US")}.`,
          });
        } else {
          parsedAmount = numeric;
        }
      }

      const evId = obs.evidenceId.trim();
      if (!evId || !OPAQUE_ID_REGEX.test(evId)) {
        errors.push({
          key: evIdKey,
          label: `${meta.label} (${sideTitle} evidence ID)`,
          message:
            "Enter a valid evidence identifier (1–64 alphanumeric/._:- characters).",
        });
      } else if (seenEvidenceIds.has(evId)) {
        errors.push({
          key: evIdKey,
          label: `${meta.label} (${sideTitle} evidence ID)`,
          message: `Duplicate evidence identifier "${evId}". Every observation must have a unique evidence ID.`,
        });
      } else {
        seenEvidenceIds.add(evId);
      }

      const sourceLabel = obs.sourceLabel.trim();
      if (!sourceLabel || sourceLabel.length > 160) {
        errors.push({
          key: labelKey,
          label: `${meta.label} (${sideTitle} source label)`,
          message: "Enter a source label between 1 and 160 characters.",
        });
      }

      const recordedAt = obs.recordedAt.trim();
      if (!isValidUtcIso(recordedAt)) {
        errors.push({
          key: timeKey,
          label: `${meta.label} (${sideTitle} recorded timestamp)`,
          message:
            "Enter a valid UTC ISO-8601 timestamp ending in Z (for example, 2026-10-16T08:00:00.000Z).",
        });
      }

      if (
        parsedAmount >= 0 &&
        evId &&
        sourceLabel &&
        isValidUtcIso(recordedAt)
      ) {
        catPayload[side] = {
          amountMinor: parsedAmount,
          currency,
          evidenceId: evId,
          source: {
            kind: "synthetic_fixture",
            label: sourceLabel,
            recordedAt,
          },
        };
      }
    }

    if (catPayload.expected || catPayload.observed) {
      financialsPayload[category] = catPayload;
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const candidate: MarginLeakEvaluationRequest = {
    schemaVersion: "1.0",
    moduleId: "marginleak",
    scenario: {
      scenarioId: draft.scenarioId,
      synthetic: true,
    },
    orderRef,
    currency,
    observationState: draft.observationState,
    financials: financialsPayload,
  };

  const parsed = marginLeakEvaluationRequestSchema.safeParse(candidate);
  if (!parsed.success) {
    const schemaErrors: MarginLeakFieldError[] = parsed.error.issues.map(
      (issue) => {
        const pathStr = `/${issue.path.map(String).join("/")}`;
        const mapped = mapServerPathToFieldKey(pathStr);
        return {
          key: mapped.key,
          label: mapped.label,
          message: issue.message,
        };
      },
    );
    return { ok: false, errors: schemaErrors };
  }

  return { ok: true, request: parsed.data };
};

export const mapServerPathToFieldKey = (
  path: string,
): { key: MarginLeakFieldKey; label: string } => {
  if (path.startsWith("/orderRef")) {
    return { key: "orderRef", label: "Order reference" };
  }
  if (path.startsWith("/currency")) {
    return { key: "currency", label: "Order currency" };
  }
  if (path.startsWith("/observationState")) {
    return { key: "observationState", label: "Observation finality" };
  }

  const match =
    /^\/financials\/(grossItemRevenue|shippingRevenue|discounts|cogs|shippingCost|fulfillmentCost|paymentCost|platformCost)\/(expected|observed)(?:\/(.+))?$/.exec(
      path,
    );
  if (match) {
    const category = match[1] as MarginLeakFinancialCategory;
    const side = match[2] as ObservationSide;
    const rest = match[3] ?? "";
    const meta = CATEGORY_METADATA[category];
    const sideTitle = side === "expected" ? "Expected" : "Observed";

    if (rest.startsWith("evidenceId")) {
      return {
        key: `financials.${category}.${side}.evidenceId`,
        label: `${meta.label} (${sideTitle} evidence ID)`,
      };
    }
    if (rest.startsWith("source/label")) {
      return {
        key: `financials.${category}.${side}.sourceLabel`,
        label: `${meta.label} (${sideTitle} source label)`,
      };
    }
    if (rest.startsWith("source/recordedAt")) {
      return {
        key: `financials.${category}.${side}.recordedAt`,
        label: `${meta.label} (${sideTitle} recorded timestamp)`,
      };
    }
    return {
      key: `financials.${category}.${side}.amountMinor`,
      label: `${meta.label} (${sideTitle} amount)`,
    };
  }

  return { key: "orderRef", label: "Order submission" };
};

export const mapServerFieldErrors = (
  envelope: ErrorEnvelope,
): MarginLeakFieldError[] => {
  const fieldErrors = envelope.error.fieldErrors ?? [];
  return fieldErrors.map((fe) => {
    const mapped = mapServerPathToFieldKey(fe.path);
    return {
      key: mapped.key,
      label: mapped.label,
      message: fe.message,
    };
  });
};

export const resolveFindingTargetField = (
  finding: MarginLeakFinding,
): { key: MarginLeakFieldKey; actionLabel: string } => {
  if (finding.code === "PROVISIONAL_FINANCIAL_INPUTS") {
    return {
      key: "observationState",
      actionLabel: "Review observation finality",
    };
  }

  if (finding.code === "MISSING_FINANCIAL_INPUT") {
    const match =
      /^\/financials\/(grossItemRevenue|shippingRevenue|discounts|cogs|shippingCost|fulfillmentCost|paymentCost|platformCost)\/(expected|observed)$/.exec(
        finding.fieldPath,
      );
    if (match) {
      const category = match[1] as MarginLeakFinancialCategory;
      const side = match[2] as ObservationSide;
      const meta = CATEGORY_METADATA[category];
      const sideTitle = side === "expected" ? "Expected" : "Observed";
      return {
        key: `financials.${category}.${side}.included`,
        actionLabel: `Supply ${sideTitle} ${meta.shortLabel}`,
      };
    }
    return {
      key: "orderRef",
      actionLabel: "Review financial inputs",
    };
  }

  const meta = CATEGORY_METADATA[finding.category];
  return {
    key: `financials.${finding.category}.observed.amountMinor`,
    actionLabel: `Edit ${meta.shortLabel} amounts`,
  };
};
