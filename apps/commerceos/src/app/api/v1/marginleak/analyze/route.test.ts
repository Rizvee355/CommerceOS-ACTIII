import {
  capabilitiesResponseSchema,
  errorEnvelopeSchema,
  marginLeakEvaluationRequestSchema,
  marginLeakEvaluationResponseSchema,
  type MarginLeakEvaluationRequest,
} from "@commerceos/contracts";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";

import { analyzeMarginLeak } from "../../../../../features/marginleak/server/analyze";
import { createCapabilitiesResponse } from "../../../../../server/api/responses";
import { createMarginLeakAnalyzeHandler } from "./route";

const fixture = (): MarginLeakEvaluationRequest =>
  marginLeakEvaluationRequestSchema.parse(
    JSON.parse(
      readFileSync(
        fileURLToPath(
          new URL(
            "../../../../../../../../packages/contracts/fixtures/v1/marginleak/valid/no-leak-request.json",
            import.meta.url,
          ),
        ),
        "utf8",
      ),
    ),
  );

const dependencies = (
  analyze: typeof analyzeMarginLeak = analyzeMarginLeak,
) => ({
  analyze,
  now: () => new Date("2026-10-17T00:02:00.000Z"),
  randomUUID: (() => {
    const ids = [
      "52dd0dc8-dcd2-4131-85ec-c14a9af75e88",
      "90c3d1ef-97ee-454d-92ce-5e16609ae170",
    ];
    return () => ids.shift() ?? "be558114-c9ee-4aac-a1c9-6e4f0a35623b";
  })(),
});

const requestFor = (body: string, contentType = "application/json") =>
  new Request("http://localhost/api/v1/marginleak/analyze", {
    method: "POST",
    headers: { "content-type": contentType },
    body,
  });

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/v1/marginleak/analyze", () => {
  it("denies production preview access before parsing regardless of flags or request fields", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("MARGINLEAK_PREVIEW_ENABLED", "true");
    const orderRef = fixture().orderRef;
    const response = await createMarginLeakAnalyzeHandler(dependencies())(
      requestFor(
        JSON.stringify({
          ...fixture(),
          previewAccess: true,
        }),
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(errorEnvelopeSchema.safeParse(body).success).toBe(true);
    expect(body).toMatchObject({
      error: {
        code: "MARGINLEAK_PREVIEW_UNAVAILABLE",
        category: "authorization",
        retryable: false,
      },
    });
    expect(JSON.stringify(body)).not.toContain(orderRef);
    expect(JSON.stringify(body)).not.toContain("MARGINLEAK_PREVIEW_ENABLED");
  });

  it("runs a complete synthetic request through the real evaluator", async () => {
    const response = await createMarginLeakAnalyzeHandler(dependencies())(
      requestFor(JSON.stringify(fixture())),
    );
    const body: unknown = await response.json();

    expect(response.status).toBe(200);
    expect(marginLeakEvaluationResponseSchema.safeParse(body).success).toBe(
      true,
    );
    expect(body).toMatchObject({
      moduleId: "marginleak",
      analysisStatus: "complete",
      deterministic: {
        data: {
          assessment: "no_leak_detected",
          totals: {
            netContributionVariance: {
              amountMinor: -300,
              currency: "USD",
            },
            leakAmount: { amountMinor: 0, currency: "USD" },
          },
        },
      },
      humanReview: { required: false },
    });
  });

  it.each([
    {
      name: "leak detected",
      prepare(request: MarginLeakEvaluationRequest) {
        request.financials.grossItemRevenue!.observed!.amountMinor = 9_000;
      },
      expected: { assessment: "leak_detected", leakAmount: 600 },
    },
    {
      name: "incomplete evidence",
      prepare(request: MarginLeakEvaluationRequest) {
        delete request.financials.cogs!.observed;
      },
      expected: { assessment: "indeterminate", leakAmount: null },
    },
    {
      name: "provisional evidence",
      prepare(request: MarginLeakEvaluationRequest) {
        request.observationState = "provisional";
      },
      expected: { assessment: "indeterminate", leakAmount: null },
    },
  ])(
    "returns the deterministic $name outcome",
    async ({ prepare, expected }) => {
      const input = fixture();
      prepare(input);

      const response = await createMarginLeakAnalyzeHandler(dependencies())(
        requestFor(JSON.stringify(input)),
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.deterministic.data.assessment).toBe(expected.assessment);
      expect(
        body.deterministic.data.totals.leakAmount?.amountMinor ?? null,
      ).toBe(expected.leakAmount);
    },
  );

  it("distinguishes unsupported media, malformed JSON, invalid schemas, and oversized bodies", async () => {
    const handler = createMarginLeakAnalyzeHandler(dependencies());

    const unsupported = await handler(requestFor("{}", "text/plain"));
    expect(unsupported.status).toBe(415);

    const malformed = await handler(requestFor("{"));
    expect(malformed.status).toBe(400);

    const invalid = await handler(
      requestFor(
        JSON.stringify({
          ...fixture(),
          customerEmail: "person@example.invalid",
        }),
      ),
    );
    const invalidBody = await invalid.json();
    expect(invalid.status).toBe(422);
    expect(errorEnvelopeSchema.safeParse(invalidBody).success).toBe(true);
    expect(JSON.stringify(invalidBody)).not.toContain("person@example.invalid");
    expect(JSON.stringify(invalidBody)).not.toContain("customerEmail");

    const oversized = await handler(
      requestFor(JSON.stringify("😀".repeat(5_000))),
    );
    expect(oversized.status).toBe(413);
  });

  it("rejects declared and streamed oversize bodies before complete consumption", async () => {
    const handler = createMarginLeakAnalyzeHandler(dependencies());
    const declared = requestFor("{");
    declared.headers.set("content-length", "16385");
    const declaredResponse = await handler(declared);
    expect(declaredResponse.status).toBe(413);

    let pulls = 0;
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls += 1;
        controller.enqueue(new Uint8Array(8 * 1024));
        if (pulls === 64) controller.close();
      },
      cancel() {
        cancelled = true;
      },
    });
    const streamed = new Request("http://localhost/api/v1/marginleak/analyze", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      duplex: "half",
    } as RequestInit & { duplex: "half" });
    const streamedResponse = await handler(streamed);
    expect(streamedResponse.status).toBe(413);
    expect(cancelled).toBe(true);
    expect(pulls).toBeLessThan(64);
  });

  it("sanitizes unexpected evaluator failures", async () => {
    const failingAnalyze: typeof analyzeMarginLeak = () => {
      throw new Error("financial payload secret=do-not-leak");
    };
    const response = await createMarginLeakAnalyzeHandler(
      dependencies(failingAnalyze),
    )(requestFor(JSON.stringify(fixture())));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(errorEnvelopeSchema.safeParse(body).success).toBe(true);
    expect(JSON.stringify(body)).not.toContain("do-not-leak");
    expect(JSON.stringify(body)).not.toContain("financial payload");
  });

  it("keeps MarginLeak planned despite the review-only route", () => {
    const capabilities = capabilitiesResponseSchema.parse(
      createCapabilitiesResponse(dependencies()),
    );

    expect(capabilities.capabilities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "marginleak",
          state: "planned",
          routes: [],
        }),
      ]),
    );
  });
});
