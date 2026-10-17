// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMarginLeakAnalyzeHandler } from "../../../app/api/v1/marginleak/analyze/route";
import { MarginLeakWorkspace } from "./marginleak-workspace";

const createRealRouteFetch = (): typeof fetch => {
  const handler = createMarginLeakAnalyzeHandler();
  return async (input, init) => {
    const url =
      typeof input === "string"
        ? `http://localhost${input}`
        : input instanceof URL
          ? input.toString()
          : input.url;
    const req = new Request(url, init);
    return handler(req);
  };
};

describe("MarginLeakWorkspace integration with real server route handler", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("evaluates Scenario 1 (Confirmed leak) and displays exact signed variance, confirmed leak, and governance metadata", async () => {
    render(<MarginLeakWorkspace fetchImpl={createRealRouteFetch()} />);

    fireEvent.click(
      screen.getAllByRole("button", { name: /Run Margin Analysis/i })[0]!,
    );

    const resultsHeading = await screen.findByRole("heading", {
      name: /Contribution-margin evaluation results/i,
    });
    expect(resultsHeading).toBeTruthy();

    expect(
      screen.getByText(
        "Final order evidence confirms an adverse contribution-margin leak",
      ),
    ).toBeTruthy();

    const expectedCard = document.querySelector(
      '[data-kpi="expected-margin"]',
    ) as HTMLElement;
    const observedCard = document.querySelector(
      '[data-kpi="observed-margin"]',
    ) as HTMLElement;
    const varianceCard = document.querySelector(
      '[data-kpi="net-variance"]',
    ) as HTMLElement;
    const leakCard = document.querySelector(
      '[data-kpi="leak-amount"]',
    ) as HTMLElement;

    expect(within(expectedCard).getByText("$49.00")).toBeTruthy();
    expect(within(observedCard).getByText("$43.50")).toBeTruthy();
    expect(
      within(varianceCard).getByText("+$5.50 · Adverse to expected margin"),
    ).toBeTruthy();
    expect(within(leakCard).getByText("$5.50")).toBeTruthy();
    expect(screen.getByText("Human Review Required")).toBeTruthy();
    expect(screen.getByText("MARGINLEAK_LEAK_DETECTED")).toBeTruthy();
    expect(screen.getByText("Deterministic-Only Contract (G4)")).toBeTruthy();

    const aiBoundaryCard = document.querySelector(
      ".ml-ai-boundary-card",
    ) as HTMLElement;
    expect(aiBoundaryCard).toBeTruthy();
    expect(
      within(aiBoundaryCard).getByText("marginleak-contribution-g4a.1"),
    ).toBeTruthy();
    expect(aiBoundaryCard.textContent).not.toContain(
      "marginleak-deterministic-v1",
    );
    expect(
      within(aiBoundaryCard).getByText(
        /optional, disabled-by-default advisory AI recommendation slots/i,
      ),
    ).toBeTruthy();
  });

  it("evaluates Scenario 2 (No leak / favorable offset) with negative signed variance and $0.00 leak", async () => {
    render(<MarginLeakWorkspace fetchImpl={createRealRouteFetch()} />);

    fireEvent.click(screen.getByLabelText(/Favorable cost offset/i));
    fireEvent.click(
      screen.getAllByRole("button", { name: /Run Margin Analysis/i })[0]!,
    );

    await screen.findByRole("heading", {
      name: /Contribution-margin evaluation results/i,
    });

    const varianceCard = document.querySelector(
      '[data-kpi="net-variance"]',
    ) as HTMLElement;
    const leakCard = document.querySelector(
      '[data-kpi="leak-amount"]',
    ) as HTMLElement;

    expect(
      within(varianceCard).getByText("-$3.00 · Favorable to expected margin"),
    ).toBeTruthy();
    expect(within(leakCard).getByText("$0.00")).toBeTruthy();
    expect(screen.getByText("No Review Required")).toBeTruthy();
  });

  it("evaluates Scenario 3 (Provisional evidence) and renders Unconfirmed — provisional evidence for null leakAmount", async () => {
    render(<MarginLeakWorkspace fetchImpl={createRealRouteFetch()} />);

    fireEvent.click(screen.getByLabelText(/Provisional unsettled evidence/i));
    fireEvent.click(
      screen.getAllByRole("button", { name: /Run Margin Analysis/i })[0]!,
    );

    await screen.findByRole("heading", {
      name: /Contribution-margin evaluation results/i,
    });

    const varianceCard = document.querySelector(
      '[data-kpi="net-variance"]',
    ) as HTMLElement;
    const leakCard = document.querySelector(
      '[data-kpi="leak-amount"]',
    ) as HTMLElement;

    expect(
      within(varianceCard).getByText("+$2.25 · Adverse to expected margin"),
    ).toBeTruthy();
    expect(
      within(leakCard).getByText("Unconfirmed — provisional evidence"),
    ).toBeTruthy();
    expect(screen.getByText("MARGINLEAK_PROVISIONAL_INPUTS")).toBeTruthy();
  });

  it("evaluates Scenario 4 (Incomplete evidence), withholds aggregate totals, and recovers when missing observations are supplied", async () => {
    render(<MarginLeakWorkspace fetchImpl={createRealRouteFetch()} />);

    fireEvent.click(screen.getByLabelText(/Incomplete financial evidence/i));
    fireEvent.click(
      screen.getAllByRole("button", { name: /Run Margin Analysis/i })[0]!,
    );

    await screen.findByRole("heading", {
      name: /Contribution-margin evaluation results/i,
    });

    const leakCard = document.querySelector(
      '[data-kpi="leak-amount"]',
    ) as HTMLElement;
    expect(
      within(leakCard).getByText("Not calculable — evidence incomplete"),
    ).toBeTruthy();
    expect(screen.getByText("MARGINLEAK_EVIDENCE_INCOMPLETE")).toBeTruthy();

    // Jump to missing Observed COGS input from finding
    const supplyCogsBtn = screen.getAllByRole("button", {
      name: /Supply Observed COGS/i,
    })[0]!;
    fireEvent.click(supplyCogsBtn);

    const cogsObservedCheck = document.getElementById(
      "ml-field-financials-cogs-observed-included",
    ) as HTMLInputElement;
    expect(document.activeElement).toBe(cogsObservedCheck);

    // Supply both missing observations (Observed COGS and Expected Platform fee)
    fireEvent.click(cogsObservedCheck);
    const platformExpectedCheck = document.getElementById(
      "ml-field-financials-platformCost-expected-included",
    ) as HTMLInputElement;
    fireEvent.click(platformExpectedCheck);

    // Previous result must be immediately cleared on edit
    expect(
      screen.queryByRole("heading", {
        name: /Contribution-margin evaluation results/i,
      }),
    ).toBeNull();

    // Re-run analysis and confirm complete assessment
    fireEvent.click(
      screen.getAllByRole("button", { name: /Run Margin Analysis/i })[0]!,
    );

    await screen.findByRole("heading", {
      name: /Contribution-margin evaluation results/i,
    });

    expect(screen.getByText(/Complete \(16\/16 observations\)/i)).toBeTruthy();
  });

  it("evaluates the negative-margin loss-leader helper (-$2.00 expected, -$1.00 observed) as no_leak_detected with $0.00 leak and clears the helper banner when edited", async () => {
    render(<MarginLeakWorkspace fetchImpl={createRealRouteFetch()} />);

    fireEvent.click(
      screen.getByRole("button", {
        name: /Load loss-leader example \(-\$1\.00 margin\)/i,
      }),
    );

    expect(
      screen.getByText(/Negative-margin loss-leader helper loaded:/i),
    ).toBeTruthy();

    fireEvent.click(
      screen.getAllByRole("button", { name: /Run Margin Analysis/i })[0]!,
    );

    await screen.findByRole("heading", {
      name: /Contribution-margin evaluation results/i,
    });

    const expectedCard = document.querySelector(
      '[data-kpi="expected-margin"]',
    ) as HTMLElement;
    const observedCard = document.querySelector(
      '[data-kpi="observed-margin"]',
    ) as HTMLElement;
    const varianceCard = document.querySelector(
      '[data-kpi="net-variance"]',
    ) as HTMLElement;
    const leakCard = document.querySelector(
      '[data-kpi="leak-amount"]',
    ) as HTMLElement;

    expect(within(expectedCard).getByText("-$2.00")).toBeTruthy();
    expect(
      within(expectedCard).getByText(
        "Synthetic loss-leader scenario baseline (negative expected contribution margin)",
      ),
    ).toBeTruthy();
    expect(within(observedCard).getByText("-$1.00")).toBeTruthy();
    expect(
      within(observedCard).getByText(
        /Negative contribution margin · Not a leak when matching or beating expected margin/i,
      ),
    ).toBeTruthy();
    expect(
      within(varianceCard).getByText("-$1.00 · Favorable to expected margin"),
    ).toBeTruthy();
    expect(within(leakCard).getByText("$0.00")).toBeTruthy();

    // Editing a financial input clears the loss-leader helper banner and does not claim planned loss-leader
    const grossExpectedInput = document.getElementById(
      "ml-field-financials-grossItemRevenue-expected-amountMinor",
    ) as HTMLInputElement;
    fireEvent.change(grossExpectedInput, { target: { value: "9900" } });

    expect(
      screen.queryByText(/Negative-margin loss-leader helper loaded:/i),
    ).toBeNull();

    fireEvent.click(
      screen.getAllByRole("button", { name: /Run Margin Analysis/i })[0]!,
    );

    await screen.findByRole("heading", {
      name: /Contribution-margin evaluation results/i,
    });

    const updatedExpectedCard = document.querySelector(
      '[data-kpi="expected-margin"]',
    ) as HTMLElement;
    expect(within(updatedExpectedCard).getByText("-$3.00")).toBeTruthy();
    expect(
      within(updatedExpectedCard).getByText(
        "Negative expected contribution margin (expected deductions exceed expected revenue)",
      ),
    ).toBeTruthy();
    expect(updatedExpectedCard.textContent).not.toContain("loss-leader");
  });

  it("clears stale evaluation results immediately upon editing any input or resetting the scenario", async () => {
    render(<MarginLeakWorkspace fetchImpl={createRealRouteFetch()} />);

    fireEvent.click(
      screen.getAllByRole("button", { name: /Run Margin Analysis/i })[0]!,
    );
    await screen.findByRole("heading", {
      name: /Contribution-margin evaluation results/i,
    });

    const orderRefInput = screen.getByLabelText(/Order reference/i);
    fireEvent.change(orderRefInput, { target: { value: "ORD-EDITED-99" } });

    expect(
      screen.queryByRole("heading", {
        name: /Contribution-margin evaluation results/i,
      }),
    ).toBeNull();
  });

  it("renders HTTP 403 MARGINLEAK_PREVIEW_UNAVAILABLE restricted state without exposing dev server launch commands", async () => {
    vi.stubEnv("NODE_ENV", "production");
    render(<MarginLeakWorkspace fetchImpl={createRealRouteFetch()} />);

    fireEvent.click(
      screen.getAllByRole("button", { name: /Run Margin Analysis/i })[0]!,
    );

    const restrictedHeading = await screen.findByRole("heading", {
      name: /Synthetic MarginLeak preview is disabled in this runtime/i,
    });
    expect(restrictedHeading).toBeTruthy();
    expect(screen.getByText("MARGINLEAK_PREVIEW_UNAVAILABLE")).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: /Retry Margin Analysis/i }),
    ).toBeNull();
    expect(document.body.textContent).not.toContain("pnpm dev");
    expect(document.body.textContent).not.toContain("next dev");
  });

  it("validates inputs client-side, focuses error summary, and jumps to provenance fields inside details", async () => {
    render(<MarginLeakWorkspace fetchImpl={createRealRouteFetch()} />);

    const duplicateEvInput = document.getElementById(
      "ml-field-financials-grossItemRevenue-observed-evidenceId",
    ) as HTMLInputElement;
    fireEvent.change(duplicateEvInput, {
      target: { value: "ld-gross-expected" },
    });

    fireEvent.click(
      screen.getAllByRole("button", { name: /Run Margin Analysis/i })[0]!,
    );

    const alert = await screen.findByRole("alert");
    expect(alert).toBeTruthy();

    const jumpBtn = within(alert).getByRole("button", {
      name: /Duplicate evidence identifier/i,
    });
    fireEvent.click(jumpBtn);

    expect(document.activeElement).toBe(duplicateEvInput);
  });

  it("recovers from network failure via Retry and supports cancelling an in-flight request", async () => {
    let callCount = 0;
    const realFetch = createRealRouteFetch();
    const flakyFetch: typeof fetch = async (input, init) => {
      callCount += 1;
      if (callCount === 1) {
        throw new Error("Simulated network disconnect");
      }
      return realFetch(input, init);
    };

    render(<MarginLeakWorkspace fetchImpl={flakyFetch} />);

    fireEvent.click(
      screen.getAllByRole("button", { name: /Run Margin Analysis/i })[0]!,
    );

    await screen.findByText(/Unable to reach MarginLeak evaluation endpoint/i);
    const retryBtn = screen.getByRole("button", {
      name: /Retry Margin Analysis/i,
    });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", {
          name: /Contribution-margin evaluation results/i,
        }),
      ).toBeTruthy();
    });
  });
});
