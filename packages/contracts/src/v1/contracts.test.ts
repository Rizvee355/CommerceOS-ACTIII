import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  analysisModuleIdSchema,
  analysisResponseEnvelopeSchema,
  capabilitiesResponseSchema,
  errorEnvelopeSchema,
  evidenceRefSchema,
  inferenceMetadataSchema,
  moneySchema,
} from "./index";

const fixture = (name: string): unknown =>
  JSON.parse(
    readFileSync(
      fileURLToPath(new URL(`../../fixtures/v1/${name}`, import.meta.url)),
      "utf8",
    ),
  );

describe("Money", () => {
  it("accepts integer minor units with a real ISO-4217 currency", () => {
    expect(moneySchema.parse({ amountMinor: 12_345, currency: "USD" })).toEqual(
      { amountMinor: 12_345, currency: "USD" },
    );
  });

  it.each([
    {
      candidate: { amountMinor: 12.34, currency: "USD" },
      label: "floating-point amount",
    },
    { candidate: { currency: "USD" }, label: "missing amount" },
    {
      candidate: { amountMinor: 0, currency: "ZZZ" },
      label: "unknown currency",
    },
  ])("rejects $label", ({ candidate }) => {
    expect(moneySchema.safeParse(candidate).success).toBe(false);
  });
});

describe("shared v1 envelopes", () => {
  it("accepts the approved generic analysis fixture", () => {
    expect(
      analysisResponseEnvelopeSchema.parse(fixture("valid/analysis.json")),
    ).toMatchObject({ schemaVersion: "1.0", moduleId: "promiseguard" });
  });

  it("rejects an incompatible schema version", () => {
    expect(
      analysisResponseEnvelopeSchema.safeParse(
        fixture("incompatible/version-2.json"),
      ).success,
    ).toBe(false);
  });

  it("requires server metadata timestamps to be UTC", () => {
    const valid = fixture("valid/analysis.json") as Record<string, unknown>;
    const metadata = valid.metadata as Record<string, unknown>;

    expect(
      analysisResponseEnvelopeSchema.safeParse({
        ...valid,
        metadata: {
          ...metadata,
          respondedAt: "2026-10-15T06:00:00+06:00",
        },
      }).success,
    ).toBe(false);
  });

  it("rejects unknown external fields", () => {
    expect(
      evidenceRefSchema.safeParse({
        evidenceId: "ev-1",
        factPath: "/input/value",
        sourceKind: "validated_input",
        rawCustomerEmail: "person@example.invalid",
      }).success,
    ).toBe(false);
  });

  it("keeps unavailable inference from fabricating an AI recommendation", () => {
    const valid = fixture("valid/analysis.json") as Record<string, unknown>;
    expect(
      analysisResponseEnvelopeSchema.safeParse({
        ...valid,
        analysisStatus: "limited",
        inference: {
          status: "unavailable",
          reasonCode: "timeout",
        },
        aiRecommendation: {
          data: { fabricated: true },
          reasoningSummary: "Do not accept this output.",
          evidenceRefs: [],
        },
      }).success,
    ).toBe(false);
  });

  it("rejects AI evidence references that are not traceable to validated evidence", () => {
    const valid = fixture("valid/analysis.json") as Record<string, unknown>;
    expect(
      analysisResponseEnvelopeSchema.safeParse({
        ...valid,
        aiRecommendation: {
          data: { fixture: "synthetic-only" },
          reasoningSummary: "This reference is intentionally untraceable.",
          evidenceRefs: ["unknown-evidence"],
        },
      }).success,
    ).toBe(false);
  });

  it("requires deterministic policy metadata for human review", () => {
    const valid = fixture("valid/analysis.json") as Record<string, unknown>;
    expect(
      analysisResponseEnvelopeSchema.safeParse({
        ...valid,
        analysisStatus: "needs_review",
        humanReview: {
          required: true,
          reasonCodes: ["policy-review"],
          decidedBy: "model",
          policyVersion: "1.0.0",
        },
      }).success,
    ).toBe(false);
  });
});

describe("inference provenance", () => {
  it("requires synthetic mock provenance to identify the mock provider", () => {
    expect(
      inferenceMetadataSchema.safeParse({
        status: "available",
        providerId: "amd-token-factory",
        modelId: "invented-model",
        adapterVersion: "1.0.0",
        generatedAt: "2026-10-15T00:00:00.000Z",
        durationMs: 4,
        provenance: "synthetic_mock",
      }).success,
    ).toBe(false);
  });
});

describe("error and capability contracts", () => {
  it("rejects raw stack information from an error response", () => {
    expect(
      errorEnvelopeSchema.safeParse({
        ...(fixture("valid/error.json") as object),
        stack: "sensitive stack",
      }).success,
    ).toBe(false);
  });

  it("keeps RescueCart disabled and route-free", () => {
    const parsed = capabilitiesResponseSchema.parse(
      fixture("valid/capabilities.json"),
    );
    expect(parsed.capabilities.find(({ id }) => id === "rescuecart")).toEqual(
      expect.objectContaining({ state: "disabled", routes: [] }),
    );
  });

  it("excludes RescueCart from analysis module identifiers", () => {
    expect(analysisModuleIdSchema.safeParse("rescuecart").success).toBe(false);
  });
});
