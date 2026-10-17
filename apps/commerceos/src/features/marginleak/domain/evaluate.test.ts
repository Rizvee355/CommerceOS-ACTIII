import { describe, expect, it } from "vitest";

import { evaluateMarginLeak } from "./evaluate";
import {
  FINANCIAL_CATEGORIES,
  MAX_COMPONENT_AMOUNT_MINOR,
  marginLeakPrototypeRequestSchema,
  type FinancialCategory,
} from "./schema";

type AmountPair = { expected: number; observed: number };
type Amounts = Record<FinancialCategory, AmountPair>;

const expectedAmounts: Record<FinancialCategory, number> = {
  grossItemRevenue: 10_000,
  shippingRevenue: 1_000,
  discounts: 500,
  cogs: 4_000,
  shippingCost: 800,
  fulfillmentCost: 300,
  paymentCost: 300,
  platformCost: 200,
};

const requestWith = (
  observedOverrides: Partial<Record<FinancialCategory, number>>,
  expectedOverrides: Partial<Record<FinancialCategory, number>> = {},
) => {
  const amounts = Object.fromEntries(
    FINANCIAL_CATEGORIES.map((category) => {
      const expected = expectedOverrides[category] ?? expectedAmounts[category];
      return [
        category,
        {
          expected,
          observed: observedOverrides[category] ?? expected,
        },
      ];
    }),
  ) as Amounts;

  return marginLeakPrototypeRequestSchema.parse({
    prototypeVersion: "g4a.1",
    moduleId: "marginleak",
    scope: "single_order_contribution_margin_variance",
    scenario: { scenarioId: "ml-evaluator", synthetic: true },
    orderRef: "ORDER-SYN-EVAL",
    currency: "USD",
    observationState: "final",
    financials: Object.fromEntries(
      FINANCIAL_CATEGORIES.map((category) => [
        category,
        {
          expected: {
            amountMinor: amounts[category].expected,
            currency: "USD",
            evidenceId: `ev-${category}-expected`,
            source: {
              kind: "synthetic_fixture",
              label: `Expected ${category}`,
              recordedAt: "2026-10-16T08:00:00.000Z",
            },
          },
          observed: {
            amountMinor: amounts[category].observed,
            currency: "USD",
            evidenceId: `ev-${category}-observed`,
            source: {
              kind: "synthetic_fixture",
              label: `Observed ${category}`,
              recordedAt: "2026-10-16T09:00:00.000Z",
            },
          },
        },
      ]),
    ),
  });
};

const zeroAmounts = (): Record<FinancialCategory, number> =>
  Object.fromEntries(
    FINANCIAL_CATEGORIES.map((category) => [category, 0]),
  ) as Record<FinancialCategory, number>;

const contributionMarginBigInt = (
  amounts: Record<FinancialCategory, number>,
): bigint =>
  BigInt(amounts.grossItemRevenue) +
  BigInt(amounts.shippingRevenue) -
  BigInt(amounts.discounts) -
  BigInt(amounts.cogs) -
  BigInt(amounts.shippingCost) -
  BigInt(amounts.fulfillmentCost) -
  BigInt(amounts.paymentCost) -
  BigInt(amounts.platformCost);

describe("MarginLeak deterministic evaluator", () => {
  it("identifies an exact source-backed contribution-margin leak", () => {
    const request = requestWith({
      grossItemRevenue: 9_800,
      discounts: 600,
      shippingCost: 1_000,
      paymentCost: 350,
    });

    const result = evaluateMarginLeak(request);

    expect(result).toMatchObject({
      assessment: "leak_detected",
      completeness: "complete",
      currency: "USD",
      observationState: "final",
      rulesetVersion: "marginleak-contribution-g4a.1",
      totals: {
        expectedContributionMargin: { amountMinor: 4_900, currency: "USD" },
        observedContributionMargin: { amountMinor: 4_350, currency: "USD" },
        netContributionVariance: { amountMinor: 550, currency: "USD" },
        leakAmount: { amountMinor: 550, currency: "USD" },
      },
      humanReview: {
        required: true,
        reasonCodes: ["MARGINLEAK_LEAK_DETECTED"],
        decidedBy: "deterministic_policy",
        policyVersion: "marginleak-review-g4a.1",
      },
    });
    expect(result.componentBreakdown.map(({ category }) => category)).toEqual(
      FINANCIAL_CATEGORIES,
    );

    const grossRevenue = result.componentBreakdown.find(
      ({ category }) => category === "grossItemRevenue",
    );
    expect(grossRevenue).toEqual({
      category: "grossItemRevenue",
      role: "revenue",
      expected: { amountMinor: 10_000, currency: "USD" },
      observed: { amountMinor: 9_800, currency: "USD" },
      direction: "adverse",
      varianceAmount: { amountMinor: 200, currency: "USD" },
      expectedEvidenceId: "ev-grossItemRevenue-expected",
      observedEvidenceId: "ev-grossItemRevenue-observed",
    });

    const shippingRevenue = result.componentBreakdown.find(
      ({ category }) => category === "shippingRevenue",
    );
    expect(shippingRevenue?.direction).toBe("neutral");
    expect(shippingRevenue?.varianceAmount.amountMinor).toBe(0);

    expect(result.findings).toContainEqual({
      code: "ADVERSE_COMPONENT_VARIANCE",
      impact: "adverse",
      category: "paymentCost",
      amount: { amountMinor: 50, currency: "USD" },
      evidenceIds: ["ev-paymentCost-expected", "ev-paymentCost-observed"],
    });
  });

  it("reports no net leak when favorable costs offset adverse revenue", () => {
    const request = requestWith({
      grossItemRevenue: 9_900,
      cogs: 3_700,
      shippingCost: 700,
    });

    const result = evaluateMarginLeak(request);

    expect(result.assessment).toBe("no_leak_detected");
    expect(result.totals).toEqual({
      expectedContributionMargin: { amountMinor: 4_900, currency: "USD" },
      observedContributionMargin: { amountMinor: 5_200, currency: "USD" },
      netContributionVariance: { amountMinor: -300, currency: "USD" },
      leakAmount: { amountMinor: 0, currency: "USD" },
    });
    expect(result.humanReview).toMatchObject({
      required: false,
      reasonCodes: [],
    });
    expect(
      result.componentBreakdown.find(({ category }) => category === "cogs"),
    ).toMatchObject({
      role: "deduction",
      direction: "favorable",
      varianceAmount: { amountMinor: 300, currency: "USD" },
    });
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        code: "FAVORABLE_COMPONENT_VARIANCE",
        impact: "favorable",
        category: "shippingCost",
        amount: { amountMinor: 100, currency: "USD" },
      }),
    );
  });

  it("confirms an adverse variance of exactly one minor unit", () => {
    const result = evaluateMarginLeak(
      requestWith({ grossItemRevenue: expectedAmounts.grossItemRevenue - 1 }),
    );

    expect(result).toMatchObject({
      assessment: "leak_detected",
      totals: {
        expectedContributionMargin: { amountMinor: 4_900, currency: "USD" },
        observedContributionMargin: { amountMinor: 4_899, currency: "USD" },
        netContributionVariance: { amountMinor: 1, currency: "USD" },
        leakAmount: { amountMinor: 1, currency: "USD" },
      },
    });
  });

  it("detects unfavorable variance when both contribution margins are negative", () => {
    const expected = {
      ...zeroAmounts(),
      grossItemRevenue: 1_000,
      cogs: 1_200,
    };
    const observed = {
      ...zeroAmounts(),
      grossItemRevenue: 1_000,
      cogs: 1_300,
    };

    const result = evaluateMarginLeak(requestWith(observed, expected));

    expect(result).toMatchObject({
      assessment: "leak_detected",
      totals: {
        expectedContributionMargin: { amountMinor: -200, currency: "USD" },
        observedContributionMargin: { amountMinor: -300, currency: "USD" },
        netContributionVariance: { amountMinor: 100, currency: "USD" },
        leakAmount: { amountMinor: 100, currency: "USD" },
      },
      humanReview: {
        required: true,
        reasonCodes: ["MARGINLEAK_LEAK_DETECTED"],
      },
    });
  });

  it("does not call a negative contribution margin leakage when variance is favorable", () => {
    const expected = {
      ...zeroAmounts(),
      grossItemRevenue: 1_000,
      cogs: 1_300,
    };
    const observed = {
      ...zeroAmounts(),
      grossItemRevenue: 1_000,
      cogs: 1_200,
    };

    const result = evaluateMarginLeak(requestWith(observed, expected));

    expect(result).toMatchObject({
      assessment: "no_leak_detected",
      totals: {
        expectedContributionMargin: { amountMinor: -300, currency: "USD" },
        observedContributionMargin: { amountMinor: -200, currency: "USD" },
        netContributionVariance: { amountMinor: -100, currency: "USD" },
        leakAmount: { amountMinor: 0, currency: "USD" },
      },
      humanReview: { required: false, reasonCodes: [] },
    });
  });

  it("matches independent BigInt arithmetic at both permitted derived extremes", () => {
    const positive = {
      ...zeroAmounts(),
      grossItemRevenue: MAX_COMPONENT_AMOUNT_MINOR,
      shippingRevenue: MAX_COMPONENT_AMOUNT_MINOR,
    };
    const negative = {
      ...Object.fromEntries(
        FINANCIAL_CATEGORIES.map((category) => [
          category,
          MAX_COMPONENT_AMOUNT_MINOR,
        ]),
      ),
      grossItemRevenue: 0,
      shippingRevenue: 0,
    } as Record<FinancialCategory, number>;

    const positiveBigInt = contributionMarginBigInt(positive);
    const negativeBigInt = contributionMarginBigInt(negative);
    const adverseVarianceBigInt = positiveBigInt - negativeBigInt;
    const favorableVarianceBigInt = negativeBigInt - positiveBigInt;

    expect(MAX_COMPONENT_AMOUNT_MINOR).toBe(562_949_953_421_311);
    expect(adverseVarianceBigInt).toBeLessThanOrEqual(
      BigInt(Number.MAX_SAFE_INTEGER),
    );
    expect(favorableVarianceBigInt).toBeGreaterThanOrEqual(
      BigInt(Number.MIN_SAFE_INTEGER),
    );

    const adverse = evaluateMarginLeak(requestWith(negative, positive));
    expect(adverse).toMatchObject({
      assessment: "leak_detected",
      totals: {
        expectedContributionMargin: {
          amountMinor: Number(positiveBigInt),
          currency: "USD",
        },
        observedContributionMargin: {
          amountMinor: Number(negativeBigInt),
          currency: "USD",
        },
        netContributionVariance: {
          amountMinor: Number(adverseVarianceBigInt),
          currency: "USD",
        },
        leakAmount: {
          amountMinor: Number(adverseVarianceBigInt),
          currency: "USD",
        },
      },
    });

    const favorable = evaluateMarginLeak(requestWith(positive, negative));
    expect(favorable).toMatchObject({
      assessment: "no_leak_detected",
      totals: {
        expectedContributionMargin: {
          amountMinor: Number(negativeBigInt),
          currency: "USD",
        },
        observedContributionMargin: {
          amountMinor: Number(positiveBigInt),
          currency: "USD",
        },
        netContributionVariance: {
          amountMinor: Number(favorableVarianceBigInt),
          currency: "USD",
        },
        leakAmount: { amountMinor: 0, currency: "USD" },
      },
    });
  });

  it("classifies an exact zero variance as no leak", () => {
    const result = evaluateMarginLeak(requestWith({}));

    expect(result.assessment).toBe("no_leak_detected");
    expect(result.totals.netContributionVariance).toEqual({
      amountMinor: 0,
      currency: "USD",
    });
    expect(result.totals.leakAmount).toEqual({
      amountMinor: 0,
      currency: "USD",
    });
    expect(
      result.componentBreakdown.every(
        ({ direction }) => direction === "neutral",
      ),
    ).toBe(true);
  });

  it("keeps an incomplete order indeterminate without aggregate totals", () => {
    const request = requestWith({
      grossItemRevenue: 9_700,
      shippingCost: 1_100,
    });
    delete request.financials.cogs?.observed;
    delete request.financials.platformCost;

    const result = evaluateMarginLeak(request);

    expect(result).toMatchObject({
      assessment: "indeterminate",
      completeness: "incomplete",
      missingInputs: [
        "/financials/cogs/observed",
        "/financials/platformCost/expected",
        "/financials/platformCost/observed",
      ],
      totals: {
        expectedContributionMargin: null,
        observedContributionMargin: null,
        netContributionVariance: null,
        leakAmount: null,
      },
      humanReview: {
        required: true,
        reasonCodes: ["MARGINLEAK_EVIDENCE_INCOMPLETE"],
      },
    });
    expect(result.componentBreakdown).toHaveLength(6);
    expect(result.componentBreakdown).toContainEqual(
      expect.objectContaining({
        category: "grossItemRevenue",
        direction: "adverse",
        expectedEvidenceId: "ev-grossItemRevenue-expected",
        observedEvidenceId: "ev-grossItemRevenue-observed",
      }),
    );

    const missingFindings = result.findings.filter(
      ({ code }) => code === "MISSING_FINANCIAL_INPUT",
    );
    const missingPaths = result.findings.flatMap((finding) =>
      finding.code === "MISSING_FINANCIAL_INPUT" ? [finding.fieldPath] : [],
    );
    expect(missingPaths).toEqual(result.missingInputs);
    expect(
      missingFindings.every((finding) => !("evidenceIds" in finding)),
    ).toBe(true);
  });

  it("retains provisional variance without claiming confirmed leakage", () => {
    const request = requestWith({
      discounts: 650,
      paymentCost: 375,
    });
    request.observationState = "provisional";

    const result = evaluateMarginLeak(request);

    expect(result).toMatchObject({
      assessment: "indeterminate",
      completeness: "complete",
      totals: {
        expectedContributionMargin: { amountMinor: 4_900, currency: "USD" },
        observedContributionMargin: { amountMinor: 4_675, currency: "USD" },
        netContributionVariance: { amountMinor: 225, currency: "USD" },
        leakAmount: null,
      },
      humanReview: {
        required: true,
        reasonCodes: ["MARGINLEAK_PROVISIONAL_INPUTS"],
      },
    });
    expect(result.findings).toContainEqual({
      code: "PROVISIONAL_FINANCIAL_INPUTS",
      impact: "uncertain",
      fieldPath: "/observationState",
    });
  });
});
