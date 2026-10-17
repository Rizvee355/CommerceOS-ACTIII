import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { evaluateMarginLeak } from "./evaluate";
import { marginLeakPrototypeRequestSchema } from "./schema";

const fixture = (name: string): unknown =>
  JSON.parse(
    readFileSync(
      fileURLToPath(new URL(`./fixtures/${name}.json`, import.meta.url)),
      "utf8",
    ),
  );

describe("MarginLeak synthetic financial fixtures", () => {
  it.each([
    {
      name: "leak-detected",
      assessment: "leak_detected",
      completeness: "complete",
      expectedMargin: 4_900,
      observedMargin: 4_350,
      netVariance: 550,
      leakAmount: 550,
    },
    {
      name: "no-leak",
      assessment: "no_leak_detected",
      completeness: "complete",
      expectedMargin: 4_900,
      observedMargin: 5_200,
      netVariance: -300,
      leakAmount: 0,
    },
    {
      name: "provisional",
      assessment: "indeterminate",
      completeness: "complete",
      expectedMargin: 4_900,
      observedMargin: 4_675,
      netVariance: 225,
      leakAmount: null,
    },
  ])(
    "validates and evaluates the $name scenario",
    ({
      name,
      assessment,
      completeness,
      expectedMargin,
      observedMargin,
      netVariance,
      leakAmount,
    }) => {
      const request = marginLeakPrototypeRequestSchema.parse(fixture(name));
      const result = evaluateMarginLeak(request);

      expect(request.scenario.synthetic).toBe(true);
      expect(result).toMatchObject({
        assessment,
        completeness,
        totals: {
          expectedContributionMargin: {
            amountMinor: expectedMargin,
            currency: "USD",
          },
          observedContributionMargin: {
            amountMinor: observedMargin,
            currency: "USD",
          },
          netContributionVariance: {
            amountMinor: netVariance,
            currency: "USD",
          },
          leakAmount:
            leakAmount === null
              ? null
              : { amountMinor: leakAmount, currency: "USD" },
        },
      });
    },
  );

  it("validates incomplete evidence without inventing aggregate amounts", () => {
    const request = marginLeakPrototypeRequestSchema.parse(
      fixture("indeterminate"),
    );
    const result = evaluateMarginLeak(request);

    expect(result).toMatchObject({
      assessment: "indeterminate",
      completeness: "incomplete",
      missingInputs: [
        "/financials/cogs/observed",
        "/financials/platformCost/expected",
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
  });
});
