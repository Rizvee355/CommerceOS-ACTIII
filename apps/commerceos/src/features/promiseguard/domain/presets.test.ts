import { promiseGuardEvaluationRequestSchema } from "@commerceos/contracts";
import { describe, expect, it } from "vitest";

import { evaluatePromiseGuard } from "./evaluate";
import { createPromiseGuardPreset } from "./presets";

describe("PromiseGuard relative synthetic presets", () => {
  it.each([
    ["supported", "supported"],
    ["at_risk", "at_risk"],
    ["indeterminate", "indeterminate"],
  ] as const)("builds a current %s preset", (presetId, assessment) => {
    const asOf = new Date("2035-04-20T10:00:00.000Z");
    const request = createPromiseGuardPreset(presetId, asOf);

    expect(promiseGuardEvaluationRequestSchema.safeParse(request).success).toBe(
      true,
    );
    expect(request.commitment.dispatchBy.startsWith("2035-04-20")).toBe(true);
    expect(
      evaluatePromiseGuard(request, asOf).deterministic.data.assessment,
    ).toBe(assessment);
  });
});
