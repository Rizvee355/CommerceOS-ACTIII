import type { Money } from "@commerceos/contracts";
import type {
  MarginLeakEvidenceCompleteness,
  MarginLeakObservationState,
} from "./labels";

/**
 * Exact BigInt-based minor-unit formatting.
 *
 * Avoids floating-point division (amountMinor / 100) so very large safe
 * integers up to MARGIN_LEAK_MAX_COMPONENT_AMOUNT_MINOR (562,949,953,421,311)
 * never suffer IEEE-754 rounding drift.
 *
 * Only USD uses a two-decimal "$" representation in the synthetic demo; other
 * ISO-4217 currency codes render exact minor-unit integers without assuming
 * USD's 2-decimal scale.
 */
const formatIntegerWithCommas = (value: bigint): string => {
  const isNegative = value < 0n;
  const digits = (isNegative ? -value : value).toString();
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return isNegative ? `-${grouped}` : grouped;
};

export const formatMoneyExact = (
  amountMinor: number,
  currency: string,
  options?: { explicitPlus?: boolean },
): string => {
  if (!Number.isSafeInteger(amountMinor)) {
    return `${amountMinor} (${currency})`;
  }

  const big = BigInt(amountMinor);
  const isNegative = big < 0n;
  const abs = isNegative ? -big : big;
  const signPrefix = isNegative
    ? "-"
    : options?.explicitPlus && big > 0n
      ? "+"
      : "";

  if (currency.toUpperCase() === "USD") {
    const dollars = abs / 100n;
    const cents = abs % 100n;
    const dollarsFormatted = formatIntegerWithCommas(dollars);
    const centsFormatted = cents.toString().padStart(2, "0");
    return `${signPrefix}$${dollarsFormatted}.${centsFormatted}`;
  }

  return `${signPrefix}${formatIntegerWithCommas(abs)} minor units (${currency.toUpperCase()})`;
};

export const formatMoneySubtext = (
  amountMinor: number,
  currency: string,
): string => {
  if (!Number.isSafeInteger(amountMinor)) return "";
  const big = BigInt(amountMinor);
  const formattedInt = formatIntegerWithCommas(big);
  if (currency.toUpperCase() === "USD") {
    return `${formattedInt} USD minor units (¢)`;
  }
  return `Exact minor-unit integer · scale depends on ${currency.toUpperCase()}`;
};

/**
 * Formats signed netContributionVariance (expectedContributionMargin - observedContributionMargin)
 * with mandatory semantic direction text so positive variance is never misread as beneficial
 * and negative variance is never misread as harmful.
 */
export const formatSignedVarianceHeadline = (
  variance: Money,
): {
  primary: string;
  directionBadge: string;
  tone: "risk" | "ready" | "neutral";
  explanation: string;
} => {
  const { amountMinor, currency } = variance;
  const formatted = formatMoneyExact(amountMinor, currency, {
    explicitPlus: true,
  });

  if (amountMinor > 0) {
    return {
      primary: `${formatted} · Adverse to expected margin`,
      directionBadge: "Adverse shortfall",
      tone: "risk",
      explanation: `Expected margin exceeded observed margin by ${formatMoneyExact(amountMinor, currency)}.`,
    };
  }

  if (amountMinor < 0) {
    return {
      primary: `${formatted} · Favorable to expected margin`,
      directionBadge: "Favorable surplus",
      tone: "ready",
      explanation: `Observed margin beat expected margin by ${formatMoneyExact(Math.abs(amountMinor), currency)}.`,
    };
  }

  return {
    primary: `${formatted} · Aligned with expected margin`,
    directionBadge: "Aligned (0 variance)",
    tone: "neutral",
    explanation:
      "Observed contribution margin exactly matched expected contribution margin.",
  };
};

/**
 * Formats confirmed leakAmount, strictly distinguishing null (provisional vs incomplete)
 * from $0.00.
 */
export const formatLeakAmountDisplay = (
  leakAmount: Money | null,
  completeness: MarginLeakEvidenceCompleteness,
  observationState: MarginLeakObservationState,
): {
  primary: string;
  subtext: string;
  tone: "risk" | "ready" | "waiting";
  isNull: boolean;
} => {
  if (leakAmount === null) {
    if (completeness === "incomplete") {
      return {
        primary: "Not calculable — evidence incomplete",
        subtext:
          "Missing financial observations are never substituted with $0.00.",
        tone: "waiting",
        isNull: true,
      };
    }
    return {
      primary: "Unconfirmed — provisional evidence",
      subtext:
        "Provisional variance cannot be booked as confirmed leakage before final settlement.",
      tone: "waiting",
      isNull: true,
    };
  }

  if (leakAmount.amountMinor > 0) {
    return {
      primary: formatMoneyExact(leakAmount.amountMinor, leakAmount.currency),
      subtext: `${formatMoneySubtext(leakAmount.amountMinor, leakAmount.currency)} · Final confirmed variance (not guaranteed recoverable cash)`,
      tone: "risk",
      isNull: false,
    };
  }

  return {
    primary: formatMoneyExact(0, leakAmount.currency),
    subtext: `0 minor units · No confirmed margin leakage (${observationState})`,
    tone: "ready",
    isNull: false,
  };
};

export const formatUtcTimestamp = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return (
    new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone: "UTC",
    }).format(date) + " UTC"
  );
};
