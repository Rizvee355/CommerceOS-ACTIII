import {
  CONTRIBUTION_ROLES,
  FINANCIAL_CATEGORIES,
  type FinancialCategory,
  type MarginLeakEvaluationInput,
} from "./schema";

export const MARGIN_LEAK_RULESET_VERSION =
  "marginleak-contribution-g4a.1" as const;
export const MARGIN_LEAK_REVIEW_POLICY_VERSION =
  "marginleak-review-g4a.1" as const;

type Money = {
  amountMinor: number;
  currency: string;
};

type VarianceDirection = "adverse" | "favorable" | "neutral";

type ComponentBreakdown = {
  category: FinancialCategory;
  role: "revenue" | "deduction";
  expected: Money;
  observed: Money;
  direction: VarianceDirection;
  varianceAmount: Money;
  expectedEvidenceId: string;
  observedEvidenceId: string;
};

type VarianceFinding = {
  code: "ADVERSE_COMPONENT_VARIANCE" | "FAVORABLE_COMPONENT_VARIANCE";
  impact: "adverse" | "favorable";
  category: FinancialCategory;
  amount: Money;
  evidenceIds: [string, string];
};

type MissingInputFinding = {
  code: "MISSING_FINANCIAL_INPUT";
  impact: "uncertain";
  fieldPath: string;
};

type ProvisionalInputFinding = {
  code: "PROVISIONAL_FINANCIAL_INPUTS";
  impact: "uncertain";
  fieldPath: "/observationState";
};

type MarginLeakFinding =
  VarianceFinding | MissingInputFinding | ProvisionalInputFinding;

type MarginLeakResult = {
  assessment: "leak_detected" | "no_leak_detected" | "indeterminate";
  completeness: "complete" | "incomplete";
  currency: string;
  observationState: "final" | "provisional";
  rulesetVersion: typeof MARGIN_LEAK_RULESET_VERSION;
  componentBreakdown: ComponentBreakdown[];
  findings: MarginLeakFinding[];
  missingInputs: string[];
  totals: {
    expectedContributionMargin: Money | null;
    observedContributionMargin: Money | null;
    netContributionVariance: Money | null;
    leakAmount: Money | null;
  };
  humanReview: {
    required: boolean;
    reasonCodes: string[];
    decidedBy: "deterministic_policy";
    policyVersion: typeof MARGIN_LEAK_REVIEW_POLICY_VERSION;
  };
};

const exactInteger = (value: number, label: string): number => {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${label} exceeds exact safe-integer arithmetic.`);
  }
  return value;
};

const money = (amountMinor: number, currency: string): Money => ({
  amountMinor: exactInteger(amountMinor, "Money amount"),
  currency,
});

const emptyTotals = (): MarginLeakResult["totals"] => ({
  expectedContributionMargin: null,
  observedContributionMargin: null,
  netContributionVariance: null,
  leakAmount: null,
});

export const evaluateMarginLeak = (
  request: MarginLeakEvaluationInput,
): MarginLeakResult => {
  let expectedContributionMargin = 0;
  let observedContributionMargin = 0;
  const findings: MarginLeakFinding[] = [];
  const missingInputs: string[] = [];
  const componentBreakdown: ComponentBreakdown[] = [];

  for (const category of FINANCIAL_CATEGORIES) {
    const component = request.financials[category];
    const expected = component?.expected;
    const observed = component?.observed;

    if (!expected) missingInputs.push(`/financials/${category}/expected`);
    if (!observed) missingInputs.push(`/financials/${category}/observed`);
    if (!expected || !observed) continue;

    const sign = CONTRIBUTION_ROLES[category];
    const expectedContribution = exactInteger(
      expected.amountMinor * sign,
      `${category} expected contribution`,
    );
    const observedContribution = exactInteger(
      observed.amountMinor * sign,
      `${category} observed contribution`,
    );

    expectedContributionMargin = exactInteger(
      expectedContributionMargin + expectedContribution,
      "Expected contribution margin",
    );
    observedContributionMargin = exactInteger(
      observedContributionMargin + observedContribution,
      "Observed contribution margin",
    );

    const signedVariance = exactInteger(
      expectedContribution - observedContribution,
      `${category} variance`,
    );
    const direction: VarianceDirection =
      signedVariance > 0
        ? "adverse"
        : signedVariance < 0
          ? "favorable"
          : "neutral";
    const varianceAmount = money(Math.abs(signedVariance), request.currency);

    if (direction !== "neutral") {
      findings.push({
        code:
          direction === "adverse"
            ? "ADVERSE_COMPONENT_VARIANCE"
            : "FAVORABLE_COMPONENT_VARIANCE",
        impact: direction,
        category,
        amount: varianceAmount,
        evidenceIds: [expected.evidenceId, observed.evidenceId],
      });
    }

    componentBreakdown.push({
      category,
      role: sign === 1 ? "revenue" : "deduction",
      expected: money(expected.amountMinor, request.currency),
      observed: money(observed.amountMinor, request.currency),
      direction,
      varianceAmount,
      expectedEvidenceId: expected.evidenceId,
      observedEvidenceId: observed.evidenceId,
    });
  }

  findings.push(
    ...missingInputs.map((fieldPath): MissingInputFinding => ({
      code: "MISSING_FINANCIAL_INPUT",
      impact: "uncertain",
      fieldPath,
    })),
  );

  const incomplete = missingInputs.length > 0;
  const provisional = request.observationState === "provisional";
  if (provisional) {
    findings.push({
      code: "PROVISIONAL_FINANCIAL_INPUTS",
      impact: "uncertain",
      fieldPath: "/observationState",
    });
  }

  let totals = emptyTotals();
  let netContributionVariance: number | null = null;
  if (!incomplete) {
    netContributionVariance = exactInteger(
      expectedContributionMargin - observedContributionMargin,
      "Net contribution variance",
    );
    totals = {
      expectedContributionMargin: money(
        expectedContributionMargin,
        request.currency,
      ),
      observedContributionMargin: money(
        observedContributionMargin,
        request.currency,
      ),
      netContributionVariance: money(netContributionVariance, request.currency),
      leakAmount: provisional
        ? null
        : money(Math.max(netContributionVariance, 0), request.currency),
    };
  }

  const assessment =
    incomplete || provisional
      ? "indeterminate"
      : netContributionVariance! > 0
        ? "leak_detected"
        : "no_leak_detected";
  const reasonCodes = [
    ...(incomplete ? ["MARGINLEAK_EVIDENCE_INCOMPLETE"] : []),
    ...(provisional ? ["MARGINLEAK_PROVISIONAL_INPUTS"] : []),
    ...(!incomplete && !provisional && assessment === "leak_detected"
      ? ["MARGINLEAK_LEAK_DETECTED"]
      : []),
  ];

  return {
    assessment,
    completeness: incomplete ? "incomplete" : "complete",
    currency: request.currency,
    observationState: request.observationState,
    rulesetVersion: MARGIN_LEAK_RULESET_VERSION,
    componentBreakdown,
    findings,
    missingInputs,
    totals,
    humanReview: {
      required: reasonCodes.length > 0,
      reasonCodes,
      decidedBy: "deterministic_policy",
      policyVersion: MARGIN_LEAK_REVIEW_POLICY_VERSION,
    },
  };
};
