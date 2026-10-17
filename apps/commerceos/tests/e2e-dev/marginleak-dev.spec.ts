import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const SCREENSHOT_DIR = path.resolve(process.cwd(), "artifacts/g4c-review");

const ensureScreenshotDir = () => {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
};

const assertZeroHorizontalOverflow = async (
  page: Page,
  viewportLabel: string,
) => {
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(
    metrics.scrollWidth,
    `Expected zero horizontal overflow at ${viewportLabel} (scrollWidth=${metrics.scrollWidth}, innerWidth=${metrics.innerWidth})`,
  ).toBeLessThanOrEqual(metrics.innerWidth);
};

test.describe("MarginLeak development synthetic preview end-to-end & visual evidence", () => {
  test("verifies all 10 required user flows across 8 viewport widths and captures 11 screenshots + 2 contact sheets", async ({
    page,
  }) => {
    ensureScreenshotDir();

    const desktopResultBuffers: {
      title: string;
      subtitle: string;
      badge: string;
      tone: "risk" | "ready" | "waiting";
      base64: string;
    }[] = [];

    const mobileResultBuffers: {
      title: string;
      subtitle: string;
      badge: string;
      tone: "risk" | "ready" | "waiting";
      base64: string;
    }[] = [];

    // 1. Desktop (1440x900) — Scenario 1: Confirmed leak & keyboard skip-link check
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/marginleak");

    // Keyboard flow: Tab to skip link and verify it focuses
    await page.keyboard.press("Tab");
    const skipLink = page.getByRole("link", { name: /Skip to main content/i });
    await expect(skipLink).toBeFocused();

    await expect(
      page.getByText("PLANNED · SYNTHETIC DEVELOPMENT PREVIEW"),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: /Contribution-Margin Variance & Leakage Intelligence/i,
      }),
    ).toBeVisible();

    // Verify primary nav does not mark Overview or PromiseGuard as aria-current="page"
    await expect(
      page.locator('.primary-nav [aria-current="page"]'),
    ).toHaveCount(0);

    await page
      .getByRole("button", { name: /Run Margin Analysis/i })
      .first()
      .click();

    const resultsHeading = page.getByRole("heading", {
      name: /Contribution-margin evaluation results/i,
    });
    await expect(resultsHeading).toBeVisible();
    await expect(resultsHeading).toBeFocused();

    await expect(page.locator('[data-kpi="expected-margin"]')).toContainText(
      "$49.00",
    );
    await expect(page.locator('[data-kpi="observed-margin"]')).toContainText(
      "$43.50",
    );
    await expect(page.locator('[data-kpi="net-variance"]')).toContainText(
      "+$5.50 · Adverse to expected margin",
    );
    await expect(page.locator('[data-kpi="leak-amount"]')).toContainText(
      "$5.50",
    );
    await expect(page.locator(".ml-ai-boundary-card")).toContainText(
      "marginleak-contribution-g4a.1",
    );
    await expect(page.locator(".ml-ai-boundary-card")).not.toContainText(
      "marginleak-deterministic-v1",
    );
    await assertZeroHorizontalOverflow(page, "1440px Scenario 1");

    await page.screenshot({
      path: path.join(
        SCREENSHOT_DIR,
        "01-scenario-1-leak-detected-desktop.png",
      ),
      fullPage: true,
    });

    const s1DesktopCrop = await page
      .locator("section.ml-results-container")
      .screenshot();
    desktopResultBuffers.push({
      title: "1. Scenario 1 — Confirmed Margin Leak (Desktop 1440px)",
      subtitle:
        "Expected $49.00 vs Observed $43.50 · Net Variance +$5.50 Adverse · Confirmed Leak $5.50 · Human Review Required",
      badge: "LEAK_DETECTED · COMPLETE · FINAL",
      tone: "risk",
      base64: s1DesktopCrop.toString("base64"),
    });

    // 2. Mobile (375x812) — Scenario 1: Confirmed leak
    await page.setViewportSize({ width: 375, height: 812 });
    await assertZeroHorizontalOverflow(page, "375px Scenario 1");
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "02-scenario-1-leak-detected-mobile.png"),
      fullPage: true,
    });

    const s1MobileCrop = await page
      .locator("section.ml-results-container")
      .screenshot();
    mobileResultBuffers.push({
      title: "Scenario 1: Confirmed Leak (375px)",
      subtitle:
        "Expected $49.00 · Observed $43.50 · +$5.50 Adverse · Leak $5.50",
      badge: "LEAK_DETECTED",
      tone: "risk",
      base64: s1MobileCrop.toString("base64"),
    });

    // Verify all 8 required viewport widths on Scenario 1 (320, 360, 375, 390, 768, 1024, 1280, 1440)
    for (const width of [320, 360, 375, 390, 768, 1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 860 });
      await assertZeroHorizontalOverflow(page, `${width}px Scenario 1`);
    }

    // 3. Desktop (1440x900) — Scenario 2: No leak / favorable offset
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByText("Favorable cost offset", { exact: true }).click();

    // Switching scenario immediately clears previous results
    await expect(resultsHeading).toHaveCount(0);

    await page
      .getByRole("button", { name: /Run Margin Analysis/i })
      .first()
      .click();
    await expect(resultsHeading).toBeVisible();
    await expect(page.locator('[data-kpi="net-variance"]')).toContainText(
      "-$3.00 · Favorable to expected margin",
    );
    await expect(page.locator('[data-kpi="leak-amount"]')).toContainText(
      "$0.00",
    );
    await expect(page.getByText("No Review Required")).toBeVisible();
    await assertZeroHorizontalOverflow(page, "1440px Scenario 2");

    await page.screenshot({
      path: path.join(
        SCREENSHOT_DIR,
        "03-scenario-2-no-leak-favorable-offset-desktop.png",
      ),
      fullPage: true,
    });

    const s2DesktopCrop = await page
      .locator("section.ml-results-container")
      .screenshot();
    desktopResultBuffers.push({
      title: "2. Scenario 2 — Favorable Cost Offset / No Leak (Desktop 1440px)",
      subtitle:
        "Expected $49.00 vs Observed $52.00 · Net Variance -$3.00 Favorable · Confirmed Leak $0.00 · No Review Required",
      badge: "NO_LEAK_DETECTED · COMPLETE · FINAL",
      tone: "ready",
      base64: s2DesktopCrop.toString("base64"),
    });

    // 4. Mobile (375x812) — Scenario 2: No leak / favorable offset
    await page.setViewportSize({ width: 375, height: 812 });
    await assertZeroHorizontalOverflow(page, "375px Scenario 2");
    await page.screenshot({
      path: path.join(
        SCREENSHOT_DIR,
        "04-scenario-2-no-leak-favorable-offset-mobile.png",
      ),
      fullPage: true,
    });

    const s2MobileCrop = await page
      .locator("section.ml-results-container")
      .screenshot();
    mobileResultBuffers.push({
      title: "Scenario 2: Favorable Offset (375px)",
      subtitle:
        "Expected $49.00 · Observed $52.00 · -$3.00 Favorable · Leak $0.00",
      badge: "NO_LEAK_DETECTED",
      tone: "ready",
      base64: s2MobileCrop.toString("base64"),
    });

    // 5. Desktop (1440x900) — Scenario 3: Provisional evidence
    await page.setViewportSize({ width: 1440, height: 900 });
    await page
      .getByText("Provisional unsettled evidence", { exact: true })
      .click();
    await expect(resultsHeading).toHaveCount(0);

    await page
      .getByRole("button", { name: /Run Margin Analysis/i })
      .first()
      .click();
    await expect(resultsHeading).toBeVisible();
    await expect(page.locator('[data-kpi="net-variance"]')).toContainText(
      "+$2.25 · Adverse to expected margin",
    );
    await expect(page.locator('[data-kpi="leak-amount"]')).toContainText(
      "Unconfirmed — provisional evidence",
    );
    await expect(page.getByText("MARGINLEAK_PROVISIONAL_INPUTS")).toBeVisible();
    await assertZeroHorizontalOverflow(page, "1440px Scenario 3");

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "05-scenario-3-provisional-desktop.png"),
      fullPage: true,
    });

    const s3DesktopCrop = await page
      .locator("section.ml-results-container")
      .screenshot();
    desktopResultBuffers.push({
      title: "3. Scenario 3 — Provisional Unsettled Evidence (Desktop 1440px)",
      subtitle:
        "Expected $49.00 vs Observed $46.75 · Net Variance +$2.25 Adverse · Leak Withheld (Unconfirmed — provisional evidence)",
      badge: "INDETERMINATE · COMPLETE · PROVISIONAL",
      tone: "waiting",
      base64: s3DesktopCrop.toString("base64"),
    });

    // 6. Mobile (375x812) — Scenario 3: Provisional evidence
    await page.setViewportSize({ width: 375, height: 812 });
    await assertZeroHorizontalOverflow(page, "375px Scenario 3");
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "06-scenario-3-provisional-mobile.png"),
      fullPage: true,
    });

    const s3MobileCrop = await page
      .locator("section.ml-results-container")
      .screenshot();
    mobileResultBuffers.push({
      title: "Scenario 3: Provisional (375px)",
      subtitle:
        "Expected $49.00 · Observed $46.75 · +$2.25 Adverse · Unconfirmed Leak",
      badge: "INDETERMINATE (PROVISIONAL)",
      tone: "waiting",
      base64: s3MobileCrop.toString("base64"),
    });

    // 7. Desktop (1440x900) — Scenario 4: Incomplete evidence
    await page.setViewportSize({ width: 1440, height: 900 });
    await page
      .getByText("Incomplete financial evidence", { exact: true })
      .click();
    await expect(resultsHeading).toHaveCount(0);

    await page
      .getByRole("button", { name: /Run Margin Analysis/i })
      .first()
      .click();
    await expect(resultsHeading).toBeVisible();
    await expect(page.locator('[data-kpi="leak-amount"]')).toContainText(
      "Not calculable — evidence incomplete",
    );
    await expect(
      page.getByText("MARGINLEAK_EVIDENCE_INCOMPLETE"),
    ).toBeVisible();
    await assertZeroHorizontalOverflow(page, "1440px Scenario 4");

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "07-scenario-4-incomplete-desktop.png"),
      fullPage: true,
    });

    const s4DesktopCrop = await page
      .locator("section.ml-results-container")
      .screenshot();
    desktopResultBuffers.push({
      title: "4. Scenario 4 — Incomplete Financial Evidence (Desktop 1440px)",
      subtitle:
        "Missing Observed COGS & Expected Platform Fee · All 4 Aggregate Totals Withheld (Not calculable — never $0.00)",
      badge: "INDETERMINATE · INCOMPLETE (14/16) · FINAL",
      tone: "waiting",
      base64: s4DesktopCrop.toString("base64"),
    });

    // 8. Mobile (375x812) — Scenario 4: Incomplete evidence
    await page.setViewportSize({ width: 375, height: 812 });
    await assertZeroHorizontalOverflow(page, "375px Scenario 4");
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "08-scenario-4-incomplete-mobile.png"),
      fullPage: true,
    });

    const s4MobileCrop = await page
      .locator("section.ml-results-container")
      .screenshot();
    mobileResultBuffers.push({
      title: "Scenario 4: Incomplete (375px)",
      subtitle:
        "Missing COGS & Platform Fee · Totals Withheld (Not calculable)",
      badge: "INDETERMINATE (INCOMPLETE)",
      tone: "waiting",
      base64: s4MobileCrop.toString("base64"),
    });

    // Flow 6: Missing-evidence recovery flow on Scenario 4
    await page.setViewportSize({ width: 1440, height: 900 });
    await page
      .getByRole("button", { name: /Supply Observed COGS/i })
      .first()
      .click();
    const cogsObservedCheckbox = page.locator(
      "#ml-field-financials-cogs-observed-included",
    );
    await expect(cogsObservedCheckbox).toBeFocused();
    await cogsObservedCheckbox.check();
    await page
      .locator("#ml-field-financials-platformCost-expected-included")
      .check();
    await expect(resultsHeading).toHaveCount(0);

    await page
      .getByRole("button", { name: /Run Margin Analysis/i })
      .first()
      .click();
    await expect(resultsHeading).toBeVisible();
    await expect(page.getByText("Complete (16/16 observations)")).toBeVisible();

    // 9. Desktop (1440x900) — Negative-margin non-leak loss-leader example
    await page
      .getByRole("button", {
        name: /Load loss-leader example \(-\$1\.00 margin\)/i,
      })
      .click();
    await expect(resultsHeading).toHaveCount(0);
    await expect(
      page.getByText(/Negative-margin loss-leader helper loaded:/i),
    ).toBeVisible();

    await page
      .getByRole("button", { name: /Run Margin Analysis/i })
      .first()
      .click();
    await expect(resultsHeading).toBeVisible();
    await expect(page.locator('[data-kpi="expected-margin"]')).toContainText(
      "-$2.00",
    );
    await expect(page.locator('[data-kpi="expected-margin"]')).toContainText(
      "Synthetic loss-leader scenario baseline (negative expected contribution margin)",
    );
    await expect(page.locator('[data-kpi="observed-margin"]')).toContainText(
      "-$1.00",
    );
    await expect(page.locator('[data-kpi="observed-margin"]')).toContainText(
      "Negative contribution margin · Not a leak when matching or beating expected margin",
    );
    await expect(page.locator('[data-kpi="net-variance"]')).toContainText(
      "-$1.00 · Favorable to expected margin",
    );
    await expect(page.locator('[data-kpi="leak-amount"]')).toContainText(
      "$0.00",
    );
    await assertZeroHorizontalOverflow(page, "1440px Negative Margin");

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "09-negative-margin-no-leak-desktop.png"),
      fullPage: true,
    });

    const s5DesktopCrop = await page
      .locator("section.ml-results-container")
      .screenshot();
    desktopResultBuffers.push({
      title:
        "5. Negative-Margin Loss-Leader Example — No Leak (Desktop 1440px)",
      subtitle:
        "Expected -$2.00 vs Observed -$1.00 · Net Variance -$1.00 Favorable · Confirmed Leak $0.00 (Negative margin != leak)",
      badge: "NO_LEAK_DETECTED · LOSS-LEADER BASELINE",
      tone: "ready",
      base64: s5DesktopCrop.toString("base64"),
    });

    // 10. Desktop (1440x900) — Validation error summary & recovery
    await page.getByLabel("Order reference").fill("");
    await page.getByLabel("ISO-4217 currency code").fill("US");

    // Verify editing cleared the loss-leader banner
    await expect(
      page.getByText(/Negative-margin loss-leader helper loaded:/i),
    ).toHaveCount(0);

    await page
      .getByRole("button", { name: /Run Margin Analysis/i })
      .first()
      .click();

    const errorAlert = page.locator("#ml-error-summary");
    await expect(errorAlert).toBeVisible();
    await expect(errorAlert).toBeFocused();
    await assertZeroHorizontalOverflow(page, "1440px Validation Error");

    await page.screenshot({
      path: path.join(
        SCREENSHOT_DIR,
        "10-validation-error-summary-desktop.png",
      ),
      fullPage: true,
    });

    const validationErrorCrop = await errorAlert.screenshot();

    // Reset preset and test Flow 8: Network failure and retry flow
    await page
      .getByRole("button", { name: /Reset to scenario/i })
      .first()
      .click();
    await expect(errorAlert).toHaveCount(0);

    let failNetworkOnce = true;
    await page.route("**/api/v1/marginleak/analyze", async (route) => {
      if (failNetworkOnce) {
        failNetworkOnce = false;
        await route.abort("failed");
        return;
      }
      await route.continue();
    });

    await page
      .getByRole("button", { name: /Run Margin Analysis/i })
      .first()
      .click();
    await expect(
      page.getByText(/Unable to reach MarginLeak evaluation endpoint/i),
    ).toBeVisible();
    await page.getByRole("button", { name: /Retry Margin Analysis/i }).click();
    await expect(resultsHeading).toBeVisible();
    await page.unroute("**/api/v1/marginleak/analyze");

    // 11. Desktop (1440x900) — HTTP 403 restricted preview state
    await page.route("**/api/v1/marginleak/analyze", async (route) => {
      await route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({
          schemaVersion: "1.0",
          requestId: "33333333-3333-4333-8333-333333333333",
          traceId: "44444444-4444-4444-8444-444444444444",
          timestamp: "2026-10-16T10:00:00.000Z",
          error: {
            code: "MARGINLEAK_PREVIEW_UNAVAILABLE",
            category: "authorization",
            message: "The MarginLeak synthetic preview is unavailable.",
            retryable: false,
          },
        }),
      });
    });

    await page
      .getByRole("button", { name: /Run Margin Analysis/i })
      .first()
      .click();

    const restrictedPanel = page.locator("#ml-restricted-state");
    await expect(restrictedPanel).toBeVisible();
    await expect(restrictedPanel).toBeFocused();
    await expect(restrictedPanel).toContainText(
      "MARGINLEAK_PREVIEW_UNAVAILABLE",
    );
    await assertZeroHorizontalOverflow(page, "1440px Restricted 403");

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "11-restricted-preview-403-desktop.png"),
      fullPage: true,
    });

    const restricted403Crop = await restrictedPanel.screenshot();

    // Assemble A: Desktop Contact Sheet (g4c-desktop-review.png) — 2-column native-scale board
    await page.setViewportSize({ width: 2460, height: 1200 });
    await page.setContent(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            * { box-sizing: border-box; }
            body {
              margin: 0;
              padding: 32px;
              background: #0d1b2d;
              color: #f6f8fa;
              font-family: "Segoe UI", system-ui, sans-serif;
            }
            .sheet-header {
              display: flex;
              align-items: center;
              justify-content: space-between;
              padding-bottom: 20px;
              margin-bottom: 28px;
              border-bottom: 2px solid #2f435c;
            }
            .sheet-header h1 {
              margin: 0 0 6px;
              font-size: 28px;
              letter-spacing: -0.02em;
            }
            .sheet-header p {
              margin: 0;
              color: #b9c6d3;
              font-size: 15px;
            }
            .sheet-tag {
              padding: 8px 16px;
              background: #1259c9;
              color: #fff;
              border-radius: 999px;
              font-family: Consolas, monospace;
              font-size: 14px;
              font-weight: 700;
            }
            .panel-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 24px;
              align-items: start;
            }
            .panel {
              background: #16263b;
              border: 2px solid #2f435c;
              border-radius: 12px;
              overflow: hidden;
            }
            .panel-bar {
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: 12px;
              padding: 14px 20px;
              background: #1d314b;
              border-bottom: 1px solid #2f435c;
            }
            .panel-bar h2 {
              margin: 0 0 4px;
              font-size: 18px;
              color: #ffffff;
            }
            .panel-bar p {
              margin: 0;
              font-size: 13px;
              color: #d9e1e8;
            }
            .badge {
              flex-shrink: 0;
              padding: 6px 12px;
              border-radius: 999px;
              font-family: Consolas, monospace;
              font-size: 12px;
              font-weight: 700;
            }
            .badge-risk { background: #fee4e2; color: #b42318; }
            .badge-ready { background: #e5f7f0; color: #066b4c; }
            .badge-waiting { background: #fff2d8; color: #8f5200; }
            .panel-img-wrap {
              padding: 16px;
              background: #f6f8fa;
              display: flex;
              flex-direction: column;
              gap: 16px;
            }
            .panel-img-wrap img {
              display: block;
              width: 100%;
              height: auto;
              border-radius: 8px;
            }
          </style>
        </head>
        <body>
          <header class="sheet-header">
            <div>
              <h1>CommerceOS G4C MarginLeak — Desktop Visual Review Contact Sheet (Native 1:1 Panel Scale)</h1>
              <p>All 4 Canonical Synthetic Scenarios + Negative-Margin Loss-Leader + Validation Error & HTTP 403 Restricted Preview States (1440px Desktop)</p>
            </div>
            <span class="sheet-tag">G4C DESKTOP EVIDENCE · 6 STATES</span>
          </header>
          <div class="panel-grid">
            ${desktopResultBuffers
              .map(
                (item) => `
              <section class="panel">
                <div class="panel-bar">
                  <div>
                    <h2>${item.title}</h2>
                    <p>${item.subtitle}</p>
                  </div>
                  <span class="badge badge-${item.tone}">${item.badge}</span>
                </div>
                <div class="panel-img-wrap">
                  <img src="data:image/png;base64,${item.base64}" alt="${item.title}" />
                </div>
              </section>
            `,
              )
              .join("")}
            <section class="panel">
              <div class="panel-bar">
                <div>
                  <h2>6. Guardrails — Validation Error Summary &amp; HTTP 403 Restricted Preview (Desktop 1440px)</h2>
                  <p>Top: Accessible validation error summary with field jump links · Bottom: Non-retryable HTTP 403 MARGINLEAK_PREVIEW_UNAVAILABLE state</p>
                </div>
                <span class="badge badge-waiting">VALIDATION &amp; 403 GUARDRAILS</span>
              </div>
              <div class="panel-img-wrap">
                <img src="data:image/png;base64,${validationErrorCrop.toString("base64")}" alt="Validation Error Summary" />
                <img src="data:image/png;base64,${restricted403Crop.toString("base64")}" alt="HTTP 403 Restricted Preview State" />
              </div>
            </section>
          </div>
        </body>
      </html>
    `);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "g4c-desktop-review.png"),
      fullPage: true,
    });

    // Assemble B: Mobile Contact Sheet (g4c-mobile-review.png)
    await page.setViewportSize({ width: 1680, height: 1200 });
    await page.setContent(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            * { box-sizing: border-box; }
            body {
              margin: 0;
              padding: 28px;
              background: #0d1b2d;
              color: #f6f8fa;
              font-family: "Segoe UI", system-ui, sans-serif;
            }
            .sheet-header {
              display: flex;
              align-items: center;
              justify-content: space-between;
              padding-bottom: 18px;
              margin-bottom: 24px;
              border-bottom: 2px solid #2f435c;
            }
            .sheet-header h1 {
              margin: 0 0 6px;
              font-size: 24px;
            }
            .sheet-header p {
              margin: 0;
              color: #b9c6d3;
              font-size: 14px;
            }
            .sheet-tag {
              padding: 8px 14px;
              background: #1259c9;
              color: #fff;
              border-radius: 999px;
              font-family: Consolas, monospace;
              font-size: 13px;
              font-weight: 700;
            }
            .mobile-grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 20px;
              align-items: start;
            }
            .mobile-col {
              background: #16263b;
              border: 2px solid #2f435c;
              border-radius: 12px;
              overflow: hidden;
            }
            .mobile-bar {
              padding: 14px 16px;
              background: #1d314b;
              border-bottom: 1px solid #2f435c;
            }
            .mobile-bar h2 {
              margin: 8px 0 4px;
              font-size: 16px;
              color: #ffffff;
            }
            .mobile-bar p {
              margin: 0;
              font-size: 12px;
              color: #d9e1e8;
              line-height: 1.4;
            }
            .badge {
              display: inline-block;
              padding: 4px 10px;
              border-radius: 999px;
              font-family: Consolas, monospace;
              font-size: 11px;
              font-weight: 700;
            }
            .badge-risk { background: #fee4e2; color: #b42318; }
            .badge-ready { background: #e5f7f0; color: #066b4c; }
            .badge-waiting { background: #fff2d8; color: #8f5200; }
            .mobile-img-wrap {
              padding: 10px;
              background: #f6f8fa;
            }
            .mobile-img-wrap img {
              display: block;
              width: 100%;
              height: auto;
              border-radius: 6px;
            }
          </style>
        </head>
        <body>
          <header class="sheet-header">
            <div>
              <h1>CommerceOS G4C MarginLeak — Mobile Visual Review Contact Sheet (375×812)</h1>
              <p>Side-by-Side Native-Width Mobile Comparison of All 4 Synthetic Scenarios (Single-Column KPI Cards & Stacked Category Cards)</p>
            </div>
            <span class="sheet-tag">G4C MOBILE EVIDENCE · 4 SCENARIOS</span>
          </header>
          <div class="mobile-grid">
            ${mobileResultBuffers
              .map(
                (item) => `
              <section class="mobile-col">
                <div class="mobile-bar">
                  <span class="badge badge-${item.tone}">${item.badge}</span>
                  <h2>${item.title}</h2>
                  <p>${item.subtitle}</p>
                </div>
                <div class="mobile-img-wrap">
                  <img src="data:image/png;base64,${item.base64}" alt="${item.title}" />
                </div>
              </section>
            `,
              )
              .join("")}
          </div>
        </body>
      </html>
    `);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "g4c-mobile-review.png"),
      fullPage: true,
    });
  });
});
