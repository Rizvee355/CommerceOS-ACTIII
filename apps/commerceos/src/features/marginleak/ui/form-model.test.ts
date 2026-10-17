import { describe, expect, it } from "vitest";
import {
  MARGIN_LEAK_MAX_COMPONENT_AMOUNT_MINOR,
  marginLeakEvaluationRequestSchema,
  type ErrorEnvelope,
} from "@commerceos/contracts";
import {
  formatLeakAmountDisplay,
  formatMoneyExact,
  formatMoneySubtext,
  formatSignedVarianceHeadline,
  formatUtcTimestamp,
} from "./format";
import {
  fieldDomId,
  mapServerFieldErrors,
  presetToDraft,
  resolveFindingTargetField,
  validateMarginLeakDraft,
} from "./form-model";
import { parseEvidencePathLabel } from "./labels";
import {
  createLossLeaderPresetRequest,
  createMarginLeakPreset,
  MARGIN_LEAK_PRESET_IDS,
} from "./presets";

describe("MarginLeak presets and BigInt currency formatting", () => {
  it("validates all four canonical presets and the loss-leader helper against marginLeakEvaluationRequestSchema", () => {
    for (const presetId of MARGIN_LEAK_PRESET_IDS) {
      const preset = createMarginLeakPreset(presetId);
      const parsed = marginLeakEvaluationRequestSchema.safeParse(preset);
      expect(parsed.success).toBe(true);
    }

    const lossLeader = createLossLeaderPresetRequest();
    expect(
      marginLeakEvaluationRequestSchema.safeParse(lossLeader).success,
    ).toBe(true);
  });

  it("formats USD and non-USD minor units using exact BigInt arithmetic without floating-point drift", () => {
    expect(formatMoneyExact(0, "USD")).toBe("$0.00");
    expect(formatMoneyExact(550, "USD", { explicitPlus: true })).toBe("+$5.50");
    expect(formatMoneyExact(-300, "USD", { explicitPlus: true })).toBe(
      "-$3.00",
    );
    expect(
      formatMoneyExact(MARGIN_LEAK_MAX_COMPONENT_AMOUNT_MINOR, "USD"),
    ).toBe("$5,629,499,534,213.11");
    expect(formatMoneyExact(1250, "JPY")).toBe("1,250 minor units (JPY)");
    expect(formatMoneySubtext(4900, "USD")).toBe("4,900 USD minor units (¢)");
    expect(formatMoneySubtext(4900, "JPY")).toContain("scale depends on JPY");
  });

  it("renders mandatory semantic direction text for signed netContributionVariance", () => {
    const adverse = formatSignedVarianceHeadline({
      amountMinor: 550,
      currency: "USD",
    });
    expect(adverse.primary).toBe("+$5.50 · Adverse to expected margin");
    expect(adverse.tone).toBe("risk");

    const favorable = formatSignedVarianceHeadline({
      amountMinor: -300,
      currency: "USD",
    });
    expect(favorable.primary).toBe("-$3.00 · Favorable to expected margin");
    expect(favorable.tone).toBe("ready");

    const aligned = formatSignedVarianceHeadline({
      amountMinor: 0,
      currency: "USD",
    });
    expect(aligned.primary).toBe("$0.00 · Aligned with expected margin");
    expect(aligned.tone).toBe("neutral");
  });

  it("distinguishes null leakAmount in provisional vs incomplete evidence from $0.00", () => {
    const provisionalNull = formatLeakAmountDisplay(
      null,
      "complete",
      "provisional",
    );
    expect(provisionalNull.primary).toBe("Unconfirmed — provisional evidence");
    expect(provisionalNull.isNull).toBe(true);

    const incompleteNull = formatLeakAmountDisplay(null, "incomplete", "final");
    expect(incompleteNull.primary).toBe("Not calculable — evidence incomplete");
    expect(incompleteNull.isNull).toBe(true);

    const zeroLeak = formatLeakAmountDisplay(
      { amountMinor: 0, currency: "USD" },
      "complete",
      "final",
    );
    expect(zeroLeak.primary).toBe("$0.00");
    expect(zeroLeak.isNull).toBe(false);

    const confirmedLeak = formatLeakAmountDisplay(
      { amountMinor: 550, currency: "USD" },
      "complete",
      "final",
    );
    expect(confirmedLeak.primary).toBe("$5.50");
    expect(confirmedLeak.tone).toBe("risk");
  });

  it("formats UTC timestamps and parses evidence paths", () => {
    expect(formatUtcTimestamp("2026-10-16T08:00:00.000Z")).toContain("UTC");
    expect(parseEvidencePathLabel("/financials/cogs/observed").humanLabel).toBe(
      "Observed Cost of goods sold (COGS)",
    );
    expect(parseEvidencePathLabel("/observationState").humanLabel).toBe(
      "Observation finality state",
    );
  });
});

describe("validateMarginLeakDraft and error mapping", () => {
  it("converts presets to drafts and validates cleanly", () => {
    const draft = presetToDraft(
      createMarginLeakPreset("leak_detected"),
      "leak_detected",
    );
    const result = validateMarginLeakDraft(draft);
    expect(result.ok).toBe(true);
  });

  it("rejects negative, decimal, over-bound, duplicate evidenceId, and invalid timestamp inputs", () => {
    const draft = presetToDraft(
      createMarginLeakPreset("leak_detected"),
      "leak_detected",
    );
    draft.orderRef = "   ";
    draft.currency = "us";
    draft.financials.grossItemRevenue.expected.amountMinor = "12.50";
    draft.financials.shippingRevenue.expected.amountMinor = String(
      MARGIN_LEAK_MAX_COMPONENT_AMOUNT_MINOR + 1,
    );
    draft.financials.discounts.observed.evidenceId =
      draft.financials.discounts.expected.evidenceId;
    draft.financials.cogs.expected.recordedAt = "2026-10-16T08:00:00+02:00";

    const result = validateMarginLeakDraft(draft);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const keys = result.errors.map((e) => e.key);
      expect(keys).toContain("orderRef");
      expect(keys).toContain("currency");
      expect(keys).toContain(
        "financials.grossItemRevenue.expected.amountMinor",
      );
      expect(keys).toContain("financials.shippingRevenue.expected.amountMinor");
      expect(keys).toContain("financials.discounts.observed.evidenceId");
      expect(keys).toContain("financials.cogs.expected.recordedAt");
    }
  });

  it("maps server fieldErrors and resolves finding jump targets", () => {
    const envelope: ErrorEnvelope = {
      schemaVersion: "1.0",
      requestId: "11111111-1111-4111-8111-111111111111",
      traceId: "22222222-2222-4222-8222-222222222222",
      timestamp: "2026-10-16T10:00:00.000Z",
      error: {
        code: "INVALID_REQUEST",
        category: "validation",
        message: "Invalid financial payload",
        retryable: false,
        fieldErrors: [
          {
            path: "/financials/shippingCost/observed/amountMinor",
            code: "too_big",
            message: "Amount exceeds safe bound",
          },
          {
            path: "/financials/cogs/expected/evidenceId",
            code: "duplicate",
            message: "Duplicate evidence ID",
          },
        ],
      },
    };

    const mapped = mapServerFieldErrors(envelope);
    expect(mapped).toHaveLength(2);
    expect(mapped[0]?.key).toBe("financials.shippingCost.observed.amountMinor");
    expect(mapped[1]?.key).toBe("financials.cogs.expected.evidenceId");
    expect(fieldDomId(mapped[0]!.key)).toBe(
      "ml-field-financials-shippingCost-observed-amountMinor",
    );

    expect(
      resolveFindingTargetField({
        code: "MISSING_FINANCIAL_INPUT",
        impact: "uncertain",
        fieldPath: "/financials/cogs/observed",
      }).key,
    ).toBe("financials.cogs.observed.included");

    expect(
      resolveFindingTargetField({
        code: "PROVISIONAL_FINANCIAL_INPUTS",
        impact: "uncertain",
        fieldPath: "/observationState",
      }).key,
    ).toBe("observationState");
  });
});
