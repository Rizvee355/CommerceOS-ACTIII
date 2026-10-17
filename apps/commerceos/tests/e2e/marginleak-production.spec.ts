import { expect, test } from "@playwright/test";
import { createMarginLeakPreset } from "../../src/features/marginleak/ui/presets";

test.describe("MarginLeak production fail-closed boundaries", () => {
  test("Overview and header report MarginLeak as Planned and expose no navigation link to /marginleak", async ({
    page,
  }) => {
    await page.goto("/");

    const headerNav = page.getByRole("navigation", { name: "Primary" });
    await expect(headerNav).toContainText("MarginLeak");
    await expect(headerNav).toContainText("Planned");
    await expect(headerNav.locator('a[href="/marginleak"]')).toHaveCount(0);

    const capabilitiesRes = await page.request.get("/api/v1/capabilities");
    expect(capabilitiesRes.status()).toBe(200);
    const capabilitiesJson = (await capabilitiesRes.json()) as {
      capabilities: Array<{ id: string; state: string; routes: string[] }>;
    };
    const marginLeakCap = capabilitiesJson.capabilities.find(
      (c) => c.id === "marginleak",
    );
    expect(marginLeakCap).toEqual({
      id: "marginleak",
      label: "MarginLeak",
      description: expect.any(String),
      state: "planned",
      routes: [],
    });
  });

  test("/marginleak fails closed on the server in production (HTTP 404) and exposes no interactive workspace", async ({
    page,
  }) => {
    const response = await page.goto("/marginleak");
    expect(response?.status()).toBe(404);

    await expect(
      page.getByRole("button", { name: /Run Margin Analysis/i }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", {
        name: /Contribution-Margin Variance & Leakage Intelligence/i,
      }),
    ).toHaveCount(0);
  });

  test("POST /api/v1/marginleak/analyze returns HTTP 403 MARGINLEAK_PREVIEW_UNAVAILABLE in production", async ({
    request,
  }) => {
    const payload = createMarginLeakPreset("leak_detected");
    const response = await request.post("/api/v1/marginleak/analyze", {
      data: payload,
    });
    expect(response.status()).toBe(403);
    const body = (await response.json()) as {
      error: { code: string; category: string; retryable: boolean };
    };
    expect(body.error.code).toBe("MARGINLEAK_PREVIEW_UNAVAILABLE");
    expect(body.error.category).toBe("authorization");
    expect(body.error.retryable).toBe(false);
  });

  test("PromiseGuard remains unaffected in production", async ({ page }) => {
    const response = await page.goto("/promiseguard");
    expect(response?.status()).toBe(200);
    await expect(
      page.getByRole("heading", { name: /Dispatch Readiness Intelligence/i }),
    ).toBeVisible();
  });
});
