import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const g3dReviewDir =
  process.env.G3D_SCREENSHOT_DIR ||
  path.resolve(process.cwd(), "artifacts", "g3d-review");

const saveScreenshot = async (page: Page, filename: string) => {
  fs.mkdirSync(g3dReviewDir, { recursive: true });
  const targetPath = path.join(g3dReviewDir, filename);
  await page.screenshot({ path: targetPath, fullPage: true });
};

const assertNoHorizontalOverflow = async (page: Page) => {
  const result = await page.evaluate(() => {
    const docWidth = document.documentElement.clientWidth || window.innerWidth;
    const scrollWidth = document.documentElement.scrollWidth;

    const isInsideScrollContainer = (el: Element): boolean => {
      let parent = el.parentElement;
      while (
        parent &&
        parent !== document.body &&
        parent !== document.documentElement
      ) {
        const style = window.getComputedStyle(parent);
        const overflowX = style.overflowX;
        if (
          overflowX === "auto" ||
          overflowX === "scroll" ||
          overflowX === "hidden"
        ) {
          return true;
        }
        parent = parent.parentElement;
      }
      return false;
    };

    const elements = Array.from(document.querySelectorAll("*"));
    const overflowing = elements
      .filter((el) => {
        if (isInsideScrollContainer(el)) return false;
        const rect = el.getBoundingClientRect();
        return rect.right > docWidth + 1.5;
      })
      .map((el) => ({
        tag: el.tagName,
        className: typeof el.className === "string" ? el.className : "",
        id: el.id,
        parent: el.parentElement
          ? `${el.parentElement.tagName}.${el.parentElement.className}`
          : "",
        text: (el.textContent || "").slice(0, 50),
        right: Math.round(el.getBoundingClientRect().right),
        width: Math.round(el.getBoundingClientRect().width),
      }));

    return {
      docWidth,
      scrollWidth,
      overflowing,
    };
  });

  expect(
    result.overflowing,
    `Horizontal overflow detected at ${result.docWidth}px: ${JSON.stringify(result.overflowing.slice(0, 3))}`,
  ).toHaveLength(0);
  expect(result.scrollWidth).toBeLessThanOrEqual(result.docWidth + 1);
};

test.describe("Visual verification & responsive layout audits", () => {
  test("First-load experience, keyboard focus ring, and recoverable validation error state", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/promiseguard");

    await expect(
      page.getByRole("heading", { name: "Review and edit the evidence" }),
    ).toBeVisible();
    await assertNoHorizontalOverflow(page);
    await saveScreenshot(page, "01-first-load-desktop.png");

    // Keyboard focus demonstration
    const preset1 = page.getByRole("radio", { name: /Aligned evidence/i });
    await preset1.focus();
    await page.keyboard.press("ArrowRight");
    const preset2 = page.getByRole("radio", { name: /Adverse evidence/i });
    await expect(preset2).toBeChecked();
    await saveScreenshot(page, "09-keyboard-focus-demo.png");

    // Recoverable validation error state demonstration
    const refInput = page.getByLabel(/Fulfillment reference/i);
    await refInput.fill("");
    await page.getByRole("button", { name: /Run analysis/i }).click();
    await expect(
      page.getByRole("heading", {
        name: "There is a problem with your submission",
      }),
    ).toBeVisible();
    await assertNoHorizontalOverflow(page);
    await saveScreenshot(page, "08-recoverable-error-state.png");
  });

  test("Scenario 1 (Supported): captures desktop and mobile results without overflow across viewports", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/promiseguard");

    await page.getByRole("button", { name: /Run analysis/i }).click();
    await expect(
      page.getByRole("heading", { name: "Evaluation Results" }),
    ).toBeVisible();
    await expect(page.getByText("Supported", { exact: true })).toBeVisible();

    await assertNoHorizontalOverflow(page);
    await saveScreenshot(page, "02-scenario-1-supported-desktop.png");

    // Verify all 7 required viewports (1440, 1280, 1024, 768, 390, 360, 320)
    for (const width of [1440, 1024, 768, 390, 360, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await assertNoHorizontalOverflow(page);
      if (width === 390) {
        await saveScreenshot(page, "03-scenario-1-supported-mobile.png");
      }
    }
  });

  test("Scenario 2 (At Risk): captures desktop and mobile results without overflow", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/promiseguard");

    await page.getByRole("radio", { name: /Adverse evidence/i }).click();
    await page.getByRole("button", { name: /Run analysis/i }).click();

    await expect(
      page.getByRole("heading", { name: "Evaluation Results" }),
    ).toBeVisible();
    await expect(page.getByText("At risk", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Adverse Findings/i }),
    ).toBeVisible();

    await assertNoHorizontalOverflow(page);
    await saveScreenshot(page, "04-scenario-2-at-risk-desktop.png");

    await page.setViewportSize({ width: 390, height: 844 });
    await assertNoHorizontalOverflow(page);
    await saveScreenshot(page, "05-scenario-2-at-risk-mobile.png");

    await page.setViewportSize({ width: 320, height: 844 });
    await assertNoHorizontalOverflow(page);
  });

  test("Scenario 3 (Indeterminate): captures desktop and mobile results without overflow", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/promiseguard");

    await page.getByRole("radio", { name: /Incomplete evidence/i }).click();
    await page.getByRole("button", { name: /Run analysis/i }).click();

    await expect(
      page.getByRole("heading", { name: "Evaluation Results" }),
    ).toBeVisible();
    await expect(
      page.getByText("Indeterminate", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Uncertain or Missing Evidence/i }),
    ).toBeVisible();

    await assertNoHorizontalOverflow(page);
    await saveScreenshot(page, "06-scenario-3-indeterminate-desktop.png");

    await page.setViewportSize({ width: 390, height: 844 });
    await assertNoHorizontalOverflow(page);
    await saveScreenshot(page, "07-scenario-3-indeterminate-mobile.png");

    await page.setViewportSize({ width: 320, height: 844 });
    await assertNoHorizontalOverflow(page);
  });
});
