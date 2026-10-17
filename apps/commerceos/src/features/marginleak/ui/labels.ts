import type {
  MarginLeakDeterministicData,
  MarginLeakFinancialCategory,
} from "@commerceos/contracts";
import type { MarginLeakPresetId } from "./presets";

export type MarginLeakAssessment = MarginLeakDeterministicData["assessment"];
export type MarginLeakEvidenceCompleteness =
  MarginLeakDeterministicData["evidenceCompleteness"];
export type MarginLeakObservationState =
  MarginLeakDeterministicData["observationState"];
export type MarginLeakVarianceDirection =
  MarginLeakDeterministicData["categoryComparisons"][number]["direction"];
export type MarginLeakCategoryComparison =
  MarginLeakDeterministicData["categoryComparisons"][number];

export type ScenarioOption = {
  id: MarginLeakPresetId;
  ordinal: number;
  badge: string;
  tone: "risk" | "ready" | "waiting";
  title: string;
  description: string;
  intent: string;
};

export const scenarioOptions: readonly ScenarioOption[] = [
  {
    id: "leak_detected",
    ordinal: 1,
    badge: "Leak Detected",
    tone: "risk",
    title: "Confirmed margin leakage",
    description:
      "Complete final evidence where item revenue shortfall, higher discounts, carrier surcharges, and payment fees reduce observed margin from $49.00 to $43.50.",
    intent: "Demonstrates a confirmed $5.50 final leak requiring human review",
  },
  {
    id: "no_leak",
    ordinal: 2,
    badge: "No Leak",
    tone: "ready",
    title: "Favorable cost offset",
    description:
      "Complete final evidence where a $1.00 item revenue dip is more than offset by $4.00 in lower COGS and carrier shipping costs ($52.00 observed vs $49.00 expected).",
    intent: "Demonstrates -$3.00 favorable net variance and $0.00 leakage",
  },
  {
    id: "provisional",
    ordinal: 3,
    badge: "Provisional",
    tone: "waiting",
    title: "Provisional unsettled evidence",
    description:
      "All eight categories have observations showing a +$2.25 adverse variance, but observation finality is marked provisional prior to settlement.",
    intent:
      "Demonstrates withheld leak confirmation (Unconfirmed — provisional evidence)",
  },
  {
    id: "incomplete",
    ordinal: 4,
    badge: "Incomplete",
    tone: "waiting",
    title: "Incomplete financial evidence",
    description:
      "Observed COGS and expected platform fee are missing. Missing inputs are never converted to $0.00, leaving aggregate totals not calculable.",
    intent:
      "Demonstrates null aggregate totals and one-click missing-input recovery",
  },
] as const;

export type CategoryMeta = {
  key: MarginLeakFinancialCategory;
  label: string;
  shortLabel: string;
  role: "revenue" | "deduction";
  signLabel: "+1 · Revenue" | "−1 · Deduction";
  description: string;
};

export const CATEGORY_METADATA: Record<
  MarginLeakFinancialCategory,
  CategoryMeta
> = {
  grossItemRevenue: {
    key: "grossItemRevenue",
    label: "Gross item revenue",
    shortLabel: "Gross item revenue",
    role: "revenue",
    signLabel: "+1 · Revenue",
    description:
      "Pre-discount merchandise revenue attributed to the order (+1 contribution role).",
  },
  shippingRevenue: {
    key: "shippingRevenue",
    label: "Shipping revenue",
    shortLabel: "Shipping revenue",
    role: "revenue",
    signLabel: "+1 · Revenue",
    description:
      "Customer-paid shipping and handling charges (+1 contribution role).",
  },
  discounts: {
    key: "discounts",
    label: "Discounts & promotions",
    shortLabel: "Discounts",
    role: "deduction",
    signLabel: "−1 · Deduction",
    description:
      "Promotional codes, markdowns, and order-level price concessions (−1 deduction role).",
  },
  cogs: {
    key: "cogs",
    label: "Cost of goods sold (COGS)",
    shortLabel: "COGS",
    role: "deduction",
    signLabel: "−1 · Deduction",
    description:
      "Direct landed merchandise cost for fulfilled items (−1 deduction role).",
  },
  shippingCost: {
    key: "shippingCost",
    label: "Carrier shipping cost",
    shortLabel: "Shipping cost",
    role: "deduction",
    signLabel: "−1 · Deduction",
    description:
      "Billed carrier postage, zone surcharges, and dimensional weight fees (−1 deduction role).",
  },
  fulfillmentCost: {
    key: "fulfillmentCost",
    label: "Fulfillment & pick/pack cost",
    shortLabel: "Fulfillment cost",
    role: "deduction",
    signLabel: "−1 · Deduction",
    description:
      "Warehouse handling, packaging materials, and pick/pack labor (−1 deduction role).",
  },
  paymentCost: {
    key: "paymentCost",
    label: "Payment processing fee",
    shortLabel: "Payment fee",
    role: "deduction",
    signLabel: "−1 · Deduction",
    description:
      "Gateway interchange, cross-border, and transaction processing charges (−1 deduction role).",
  },
  platformCost: {
    key: "platformCost",
    label: "Platform / marketplace fee",
    shortLabel: "Platform fee",
    role: "deduction",
    signLabel: "−1 · Deduction",
    description:
      "Commerce platform or channel transaction commission (−1 deduction role).",
  },
};

export const assessmentBannerCopy: Record<
  MarginLeakAssessment,
  {
    badge: string;
    tone: "risk" | "ready" | "waiting";
    icon: string;
    headline: string;
    subheadline: string;
  }
> = {
  leak_detected: {
    badge: "Leak Detected",
    tone: "risk",
    icon: "▲",
    headline:
      "Final order evidence confirms an adverse contribution-margin leak",
    subheadline:
      "Observed contribution margin fell below expected contribution margin across complete, final financial observations. Confirmed leakage is a deterministic historical variance—not a guarantee of automatic cash recovery.",
  },
  no_leak_detected: {
    badge: "No Leak Detected",
    tone: "ready",
    icon: "✓",
    headline:
      "Observed contribution margin meets or exceeds expected order economics",
    subheadline:
      "Complete final evidence shows zero net margin leakage. Favorable component savings can offset isolated adverse movements, and a negative contribution margin is not treated as leakage when it matches or beats expectations.",
  },
  indeterminate: {
    badge: "Indeterminate",
    tone: "waiting",
    icon: "◆",
    headline:
      "Margin leakage cannot be confirmed from the current financial evidence",
    subheadline:
      "Either one or more financial observations are missing, or the order's observations remain provisional prior to final settlement. MarginLeak never substitutes $0.00 for missing evidence or books provisional variance as confirmed leakage.",
  },
};

export const completenessLabels: Record<
  MarginLeakEvidenceCompleteness,
  string
> = {
  complete: "Complete (16/16 observations)",
  incomplete: "Incomplete (missing observations)",
};

export const observationStateLabels: Record<
  MarginLeakObservationState,
  string
> = {
  final: "Final (settled)",
  provisional: "Provisional (unsettled)",
};

export const directionLabels: Record<
  MarginLeakVarianceDirection,
  { label: string; tone: "risk" | "ready" | "neutral"; icon: string }
> = {
  adverse: {
    label: "Adverse to margin",
    tone: "risk",
    icon: "▲",
  },
  favorable: {
    label: "Favorable to margin",
    tone: "ready",
    icon: "▼",
  },
  neutral: {
    label: "Aligned (0 variance)",
    tone: "neutral",
    icon: "—",
  },
};

export const reviewReasonLabels: Record<
  string,
  { title: string; explanation: string }
> = {
  MARGINLEAK_LEAK_DETECTED: {
    title: "Confirmed Contribution-Margin Leak",
    explanation:
      "Complete final order evidence shows a positive net contribution variance (expected margin exceeded observed margin). Audit the adverse category drivers before closing order reconciliation.",
  },
  MARGINLEAK_PROVISIONAL_INPUTS: {
    title: "Provisional Financial Inputs",
    explanation:
      "Order observations are marked provisional. Confirmed leak amount is withheld until carrier bills, discounts, and gateway fees reach final settlement.",
  },
  MARGINLEAK_EVIDENCE_INCOMPLETE: {
    title: "Incomplete Financial Evidence",
    explanation:
      "One or more expected or observed category amounts are missing. Aggregate contribution totals are withheld until all 16 observations are supplied.",
  },
};

export const parseEvidencePathLabel = (
  factPath: string,
): {
  category?: MarginLeakFinancialCategory;
  side?: "expected" | "observed";
  humanLabel: string;
} => {
  const match =
    /^\/financials\/(grossItemRevenue|shippingRevenue|discounts|cogs|shippingCost|fulfillmentCost|paymentCost|platformCost)\/(expected|observed)$/.exec(
      factPath,
    );
  if (!match) {
    if (factPath === "/observationState") {
      return { humanLabel: "Observation finality state" };
    }
    return { humanLabel: factPath };
  }
  const category = match[1] as MarginLeakFinancialCategory;
  const side = match[2] as "expected" | "observed";
  const meta = CATEGORY_METADATA[category];
  const sideLabel = side === "expected" ? "Expected" : "Observed";
  return {
    category,
    side,
    humanLabel: `${sideLabel} ${meta.label}`,
  };
};
