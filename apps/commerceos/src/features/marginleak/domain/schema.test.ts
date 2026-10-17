import { describe, expect, it } from "vitest";

import {
  FINANCIAL_CATEGORIES,
  MAX_COMPONENT_AMOUNT_MINOR,
  marginLeakPrototypeRequestSchema,
} from "./schema";

type Candidate = Record<string, unknown>;

const completeCandidate = (): Candidate => {
  const financials = Object.fromEntries(
    FINANCIAL_CATEGORIES.map((category, categoryIndex) => [
      category,
      {
        expected: {
          amountMinor: 10_000 + categoryIndex,
          currency: "USD",
          evidenceId: `ev-${category}-expected`,
          source: {
            kind: "synthetic_fixture",
            label: `Expected ${category}`,
            recordedAt: "2026-10-16T08:00:00.000Z",
          },
        },
        observed: {
          amountMinor: 10_100 + categoryIndex,
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
  );

  return {
    prototypeVersion: "g4a.1",
    moduleId: "marginleak",
    scope: "single_order_contribution_margin_variance",
    scenario: { scenarioId: "ml-complete", synthetic: true },
    orderRef: "ORDER-SYN-001",
    currency: "USD",
    observationState: "final",
    financials,
  };
};

const observationAt = (
  candidate: Candidate,
  category: string,
  side: "expected" | "observed",
): Record<string, unknown> => {
  const financials = candidate.financials as Record<
    string,
    Record<string, Record<string, unknown>>
  >;
  return financials[category]![side]!;
};

describe("MarginLeak G4A local request schema", () => {
  it("accepts a strict complete synthetic single-currency request", () => {
    const parsed = marginLeakPrototypeRequestSchema.parse(completeCandidate());

    expect(parsed).toMatchObject({
      prototypeVersion: "g4a.1",
      moduleId: "marginleak",
      currency: "USD",
      observationState: "final",
    });
    expect(Object.keys(parsed.financials)).toEqual(FINANCIAL_CATEGORIES);
  });

  it("pins the exact component boundary and rejects one minor unit above it", () => {
    expect(MAX_COMPONENT_AMOUNT_MINOR).toBe(562_949_953_421_311);

    const permitted = completeCandidate();
    observationAt(permitted, "grossItemRevenue", "expected").amountMinor =
      MAX_COMPONENT_AMOUNT_MINOR;
    expect(marginLeakPrototypeRequestSchema.safeParse(permitted).success).toBe(
      true,
    );

    const rejected = completeCandidate();
    observationAt(rejected, "grossItemRevenue", "expected").amountMinor =
      MAX_COMPONENT_AMOUNT_MINOR + 1;
    expect(marginLeakPrototypeRequestSchema.safeParse(rejected).success).toBe(
      false,
    );
  });

  it.each([
    {
      label: "floating-point component amount",
      mutate: (candidate: Candidate) => {
        observationAt(candidate, "cogs", "observed").amountMinor = 125.5;
      },
    },
    {
      label: "negative component magnitude",
      mutate: (candidate: Candidate) => {
        observationAt(candidate, "discounts", "expected").amountMinor = -1;
      },
    },
    {
      label: "unknown external field",
      mutate: (candidate: Candidate) => {
        candidate.customerEmail = "customer@example.invalid";
      },
    },
    {
      label: "mixed component currency",
      mutate: (candidate: Candidate) => {
        observationAt(candidate, "shippingCost", "observed").currency = "EUR";
      },
    },
    {
      label: "duplicate evidence identifier",
      mutate: (candidate: Candidate) => {
        observationAt(candidate, "platformCost", "observed").evidenceId =
          "ev-cogs-observed";
      },
    },
    {
      label: "non-UTC evidence timestamp",
      mutate: (candidate: Candidate) => {
        const source = observationAt(candidate, "cogs", "observed")
          .source as Record<string, unknown>;
        source.recordedAt = "2026-10-16T15:00:00+06:00";
      },
    },
    {
      label: "non-synthetic scenario",
      mutate: (candidate: Candidate) => {
        const scenario = candidate.scenario as Record<string, unknown>;
        scenario.synthetic = false;
      },
    },
    {
      label: "amount above the exact aggregation bound",
      mutate: (candidate: Candidate) => {
        observationAt(candidate, "grossItemRevenue", "expected").amountMinor =
          MAX_COMPONENT_AMOUNT_MINOR + 1;
      },
    },
  ])("rejects $label", ({ mutate }) => {
    const candidate = completeCandidate();
    mutate(candidate);

    expect(marginLeakPrototypeRequestSchema.safeParse(candidate).success).toBe(
      false,
    );
  });

  it("accepts absent component sides as missing domain evidence", () => {
    const candidate = completeCandidate();
    const financials = candidate.financials as Record<string, unknown>;
    delete financials.platformCost;
    delete observationAt(candidate, "cogs", "observed").amountMinor;

    expect(marginLeakPrototypeRequestSchema.safeParse(candidate).success).toBe(
      false,
    );

    const cogs = (financials.cogs as Record<string, unknown>) ?? {};
    delete cogs.observed;

    const parsed = marginLeakPrototypeRequestSchema.parse(candidate);
    expect(parsed.financials.platformCost).toBeUndefined();
    expect(parsed.financials.cogs?.observed).toBeUndefined();
  });
});
