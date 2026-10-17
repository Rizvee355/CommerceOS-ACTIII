import { z } from "zod";

export const MARGIN_LEAK_FINANCIAL_CATEGORIES = [
  "grossItemRevenue",
  "shippingRevenue",
  "discounts",
  "cogs",
  "shippingCost",
  "fulfillmentCost",
  "paymentCost",
  "platformCost",
] as const;

export type MarginLeakFinancialCategory =
  (typeof MARGIN_LEAK_FINANCIAL_CATEGORIES)[number];

export const MARGIN_LEAK_CONTRIBUTION_ROLES = {
  grossItemRevenue: 1,
  shippingRevenue: 1,
  discounts: -1,
  cogs: -1,
  shippingCost: -1,
  fulfillmentCost: -1,
  paymentCost: -1,
  platformCost: -1,
} as const satisfies Record<MarginLeakFinancialCategory, 1 | -1>;

export const MARGIN_LEAK_MAX_COMPONENT_AMOUNT_MINOR = Math.floor(
  Number.MAX_SAFE_INTEGER / (MARGIN_LEAK_FINANCIAL_CATEGORIES.length * 2),
);

export const marginLeakObservationStateSchema = z.enum([
  "final",
  "provisional",
]);

export const marginLeakAssessmentSchema = z.enum([
  "leak_detected",
  "no_leak_detected",
  "indeterminate",
]);

export const marginLeakEvidenceCompletenessSchema = z.enum([
  "complete",
  "incomplete",
]);

export const marginLeakVarianceDirectionSchema = z.enum([
  "adverse",
  "favorable",
  "neutral",
]);
