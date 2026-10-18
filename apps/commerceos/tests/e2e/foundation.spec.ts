import { expect, test } from "@playwright/test";

test("foundation shell and approved APIs are available", async ({
  page,
  request,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Commerce intelligence, one system." }),
  ).toBeVisible();
  await expect(page.getByTestId("capability-promiseguard")).toContainText(
    "Stub",
  );
  await expect(page.getByTestId("capability-marginleak")).toContainText(
    "Planned",
  );
  await expect(page.getByTestId("capability-rescuecart")).toContainText(
    "Disabled",
  );
  const amdStatus = page
    .getByRole("heading", {
      name: "AMD Token Factory — Integration Verified",
    })
    .locator("..");
  await expect(amdStatus).toBeVisible();
  await expect(amdStatus.getByText("AMD API")).toBeVisible();
  await expect(amdStatus.getByText("Verified", { exact: true })).toBeVisible();
  await expect(
    amdStatus.getByText("PromiseGuard AI Integration"),
  ).toBeVisible();
  await expect(
    amdStatus.getByText("Verified in controlled testing"),
  ).toBeVisible();
  await expect(amdStatus.getByText("Public AI Availability")).toBeVisible();
  await expect(amdStatus.getByText("Disabled", { exact: true })).toBeVisible();
  await expect(
    page.getByText(/Public live inference remains disabled/i),
  ).toBeVisible();

  const health = await request.get("/api/v1/health");
  expect(health.status()).toBe(200);
  expect(await health.json()).toMatchObject({
    schemaVersion: "1.0",
    service: "commerceos",
    status: "ok",
  });

  const capabilities = await request.get("/api/v1/capabilities");
  expect(capabilities.status()).toBe(200);
  expect(await capabilities.json()).toMatchObject({
    schemaVersion: "1.0",
    capabilities: [
      { id: "promiseguard", state: "stub", routes: [] },
      { id: "marginleak", state: "planned", routes: [] },
      { id: "rescuecart", state: "disabled", routes: [] },
    ],
  });
});
