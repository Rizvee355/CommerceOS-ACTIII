import {
  capabilitiesResponseSchema,
  errorEnvelopeSchema,
  healthResponseSchema,
} from "@commerceos/contracts";
import { describe, expect, it } from "vitest";

import {
  createApiErrorResponse,
  createCapabilitiesResponse,
  createErrorResponse,
  createHealthResponse,
  type ServerContextFactory,
} from "./responses";

const contextFactory: ServerContextFactory = {
  now: () => new Date("2026-10-15T01:02:03.000Z"),
  randomUUID: (() => {
    const ids = [
      "52dd0dc8-dcd2-4131-85ec-c14a9af75e88",
      "90c3d1ef-97ee-454d-92ce-5e16609ae170",
    ];
    return () => ids.shift() ?? "be558114-c9ee-4aac-a1c9-6e4f0a35623b";
  })(),
};

describe("foundation API responses", () => {
  it("creates schema-valid health metadata on the server", () => {
    const response = createHealthResponse(contextFactory);

    expect(healthResponseSchema.parse(response)).toEqual(
      expect.objectContaining({
        requestId: "52dd0dc8-dcd2-4131-85ec-c14a9af75e88",
        traceId: "90c3d1ef-97ee-454d-92ce-5e16609ae170",
        timestamp: "2026-10-15T01:02:03.000Z",
        service: "commerceos",
        status: "ok",
      }),
    );
  });

  it("reports truthful module capability states without product routes", () => {
    const response = capabilitiesResponseSchema.parse(
      createCapabilitiesResponse(contextFactory),
    );

    expect(response.capabilities).toEqual([
      expect.objectContaining({
        id: "promiseguard",
        state: "stub",
        routes: [],
      }),
      expect.objectContaining({
        id: "marginleak",
        state: "planned",
        routes: [],
      }),
      expect.objectContaining({
        id: "rescuecart",
        state: "disabled",
        routes: [],
      }),
    ]);
  });

  it("sanitizes internal errors into the standard envelope", () => {
    const response = createErrorResponse(
      new Error("database password=do-not-leak"),
      contextFactory,
    );
    const parsed = errorEnvelopeSchema.parse(response);

    expect(parsed.error).toEqual({
      code: "INTERNAL_ERROR",
      category: "internal",
      message: "The request could not be completed.",
      retryable: false,
    });
    expect(JSON.stringify(parsed)).not.toContain("do-not-leak");
  });

  it("creates a sanitized validation envelope with approved field paths", () => {
    const response = createApiErrorResponse(
      {
        code: "INVALID_REQUEST",
        category: "validation",
        message: "The request did not match the PromiseGuard contract.",
        retryable: false,
        fieldErrors: [
          {
            path: "/operationalEvidence/readyTimeEstimate",
            code: "INVALID_FIELD",
            message: "The field is invalid.",
          },
        ],
      },
      contextFactory,
    );

    expect(errorEnvelopeSchema.parse(response).error).toEqual({
      code: "INVALID_REQUEST",
      category: "validation",
      message: "The request did not match the PromiseGuard contract.",
      retryable: false,
      fieldErrors: [
        {
          path: "/operationalEvidence/readyTimeEstimate",
          code: "INVALID_FIELD",
          message: "The field is invalid.",
        },
      ],
    });
  });
});
