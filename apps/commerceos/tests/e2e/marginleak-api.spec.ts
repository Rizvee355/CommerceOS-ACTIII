import { errorEnvelopeSchema } from "@commerceos/contracts";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

const requestFixture = JSON.parse(
  readFileSync(
    resolve(
      process.cwd(),
      "packages/contracts/fixtures/v1/marginleak/valid/no-leak-request.json",
    ),
    "utf8",
  ),
);

test("MarginLeak synthetic preview is denied by the production server", async ({
  request,
}) => {
  const response = await request.post("/api/v1/marginleak/analyze", {
    data: requestFixture,
  });
  const body: unknown = await response.json();

  expect(response.status()).toBe(403);
  expect(errorEnvelopeSchema.safeParse(body).success).toBe(true);
  expect(body).toMatchObject({
    error: {
      code: "MARGINLEAK_PREVIEW_UNAVAILABLE",
      category: "authorization",
      retryable: false,
    },
  });
  expect(JSON.stringify(body)).not.toContain(requestFixture.orderRef);
});

test("MarginLeak preview rejects unsupported GET requests", async ({
  request,
}) => {
  const response = await request.get("/api/v1/marginleak/analyze");

  expect(response.status()).toBe(405);
});
