import {
  MARGIN_LEAK_FINANCIAL_CATEGORIES,
  marginLeakEvaluationRequestSchema,
  type MarginLeakEvaluationRequest,
} from "@commerceos/contracts";

import indeterminateFixture from "../domain/fixtures/indeterminate.json";
import leakDetectedFixture from "../domain/fixtures/leak-detected.json";
import noLeakFixture from "../domain/fixtures/no-leak.json";
import provisionalFixture from "../domain/fixtures/provisional.json";

export const MARGIN_LEAK_PRESET_IDS = [
  "leak_detected",
  "no_leak",
  "provisional",
  "incomplete",
] as const;

export type MarginLeakPresetId = (typeof MARGIN_LEAK_PRESET_IDS)[number];

type RawDomainFixture = {
  prototypeVersion?: string;
  scope?: string;
  moduleId: string;
  scenario: { scenarioId: string; synthetic: boolean };
  orderRef: string;
  currency: string;
  observationState: string;
  financials: Record<string, unknown>;
};

const RAW_FIXTURES: Record<MarginLeakPresetId, RawDomainFixture> = {
  leak_detected: leakDetectedFixture as RawDomainFixture,
  no_leak: noLeakFixture as RawDomainFixture,
  provisional: provisionalFixture as RawDomainFixture,
  incomplete: indeterminateFixture as RawDomainFixture,
};

/**
 * Adapts the G4A domain fixtures (which contain prototype-only `prototypeVersion`
 * and `scope` fields) into the strict G4B HTTP contract (`schemaVersion: "1.0"`).
 */
export const createMarginLeakPreset = (
  presetId: MarginLeakPresetId,
): MarginLeakEvaluationRequest => {
  const raw = RAW_FIXTURES[presetId];
  return marginLeakEvaluationRequestSchema.parse({
    schemaVersion: "1.0",
    moduleId: "marginleak",
    scenario: {
      scenarioId: raw.scenario.scenarioId,
      synthetic: true,
    },
    orderRef: raw.orderRef,
    currency: raw.currency,
    observationState: raw.observationState,
    financials: structuredClone(raw.financials),
  });
};

/**
 * Creates a valid synthetic loss-leader request where both expected (-$2.00) and
 * observed (-$1.00) contribution margins are negative, but observed margin beats
 * expected margin by $1.00 (netContributionVariance = -100, leakAmount = 0,
 * assessment = "no_leak_detected").
 *
 * Used by the optional loss-leader demonstration helper without altering the
 * four canonical scenario presets.
 */
export const createLossLeaderPresetRequest =
  (): MarginLeakEvaluationRequest => {
    const base = createMarginLeakPreset("no_leak");
    const cloned = structuredClone(base);
    cloned.scenario = {
      scenarioId: "ml-loss-leader-no-leak",
      synthetic: true,
    };
    cloned.orderRef = "ORDER-SYN-LOSS-LEADER";

    for (const category of MARGIN_LEAK_FINANCIAL_CATEGORIES) {
      const comp = cloned.financials[category];
      if (comp?.expected && comp?.observed) {
        comp.observed.amountMinor = comp.expected.amountMinor;
      }
    }

    // Expected margin: (10000 + 1000) - (5600 + 4000 + 800 + 300 + 300 + 200) = -200 (-$2.00)
    // Observed margin: (10000 + 1000) - (5500 + 4000 + 800 + 300 + 300 + 200) = -100 (-$1.00)
    // Net contribution variance: -200 - (-100) = -100 (-$1.00 favorable), leakAmount = 0
    if (cloned.financials.discounts?.expected) {
      cloned.financials.discounts.expected.amountMinor = 5600;
    }
    if (cloned.financials.discounts?.observed) {
      cloned.financials.discounts.observed.amountMinor = 5500;
    }

    return marginLeakEvaluationRequestSchema.parse(cloned);
  };
