import {
  capabilitiesResponseSchema,
  errorEnvelopeSchema,
  promiseGuardEvaluationResponseSchema,
} from "@commerceos/contracts";
import type { InferenceProvider } from "@commerceos/inference";
import { describe, expect, it } from "vitest";

import { createPromiseGuardPreset } from "../../../../../features/promiseguard/domain/presets";
import { createCapabilitiesResponse } from "../../../../../server/api/responses";
import { createPromiseGuardAnalyzeHandler } from "./route";

const asOf = new Date("2026-10-15T09:00:00.000Z");

const dependencies = (inferenceProvider: InferenceProvider | null = null) => ({
  getInferenceProvider: () => inferenceProvider,
  now: () => new Date(asOf),
  randomUUID: (() => {
    const ids = [
      "52dd0dc8-dcd2-4131-85ec-c14a9af75e88",
      "90c3d1ef-97ee-454d-92ce-5e16609ae170",
    ];
    return () => ids.shift() ?? "be558114-c9ee-4aac-a1c9-6e4f0a35623b";
  })(),
});

const requestFor = (body: string, contentType = "application/json") =>
  new Request("http://localhost/api/v1/promiseguard/analyze", {
    method: "POST",
    headers: { "content-type": contentType },
    body,
  });

describe("POST /api/v1/promiseguard/analyze", () => {
  it("returns a G2-compatible deterministic response with disabled inference", async () => {
    const handler = createPromiseGuardAnalyzeHandler(dependencies());
    const response = await handler(
      requestFor(JSON.stringify(createPromiseGuardPreset("supported", asOf))),
    );
    const body: unknown = await response.json();

    expect(response.status).toBe(200);
    expect(promiseGuardEvaluationResponseSchema.safeParse(body).success).toBe(
      true,
    );
    expect(body).toMatchObject({
      analysisStatus: "limited",
      deterministic: { data: { assessment: "supported" } },
      inference: { status: "unavailable", reasonCode: "configuration" },
    });
  });

  it("distinguishes unsupported media, oversized payloads, malformed JSON, and invalid schemas", async () => {
    const handler = createPromiseGuardAnalyzeHandler(dependencies());

    const unsupported = await handler(requestFor("{}", "text/plain"));
    expect(unsupported.status).toBe(415);

    const oversized = await handler(
      requestFor(JSON.stringify("😀".repeat(5_000))),
    );
    expect(oversized.status).toBe(413);

    const malformed = await handler(requestFor("{"));
    expect(malformed.status).toBe(400);

    const invalid = await handler(
      requestFor(
        JSON.stringify({
          ...createPromiseGuardPreset("supported", asOf),
          customerEmail: "person@example.invalid",
        }),
      ),
    );
    const invalidBody = await invalid.json();
    expect(invalid.status).toBe(422);
    expect(errorEnvelopeSchema.safeParse(invalidBody).success).toBe(true);
    expect(JSON.stringify(invalidBody)).not.toContain("person@example.invalid");
    expect(JSON.stringify(invalidBody)).not.toContain("customerEmail");
  });

  it("rejects a declared oversized request before reading malformed JSON", async () => {
    const handler = createPromiseGuardAnalyzeHandler(dependencies());
    const request = requestFor("{");
    request.headers.set("content-length", "16385");

    const response = await handler(request);
    expect(response.status).toBe(413);
    expect((await response.json()).error.code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("cancels an undeclared streamed body as soon as it exceeds 16 KiB", async () => {
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
    const request = new Request(
      "http://localhost/api/v1/promiseguard/analyze",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
        duplex: "half",
      } as RequestInit & { duplex: "half" },
    );

    const response =
      await createPromiseGuardAnalyzeHandler(dependencies())(request);

    expect(response.status).toBe(413);
    expect(cancelled).toBe(true);
    expect(pulls).toBeLessThan(64);
  });

  it("sanitizes unexpected provider failures", async () => {
    const provider: InferenceProvider = {
      providerId: "failing-provider",
      async generateStructured() {
        throw new Error("secret provider payload token=do-not-leak");
      },
    };
    const handler = createPromiseGuardAnalyzeHandler(dependencies(provider));
    const response = await handler(
      requestFor(JSON.stringify(createPromiseGuardPreset("supported", asOf))),
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(errorEnvelopeSchema.safeParse(body).success).toBe(true);
    expect(JSON.stringify(body)).not.toContain("do-not-leak");
    expect(JSON.stringify(body)).not.toContain("failing-provider");
  });

  it("leaves PromiseGuard stubbed until the Antigravity-owned UX is integrated", () => {
    const capabilities = capabilitiesResponseSchema.parse(
      createCapabilitiesResponse(dependencies()),
    );
    expect(capabilities.capabilities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "promiseguard",
          state: "stub",
          routes: [],
        }),
        expect.objectContaining({ id: "marginleak", state: "planned" }),
        expect.objectContaining({
          id: "rescuecart",
          state: "disabled",
          routes: [],
        }),
      ]),
    );
  });
});
