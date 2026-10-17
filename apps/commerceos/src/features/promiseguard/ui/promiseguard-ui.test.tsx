// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createPromiseGuardPreset } from "../domain/presets";
import { AiPanel } from "./ai-panel";
import { AnalysisProgress } from "./analysis-progress";
import { AssessmentBanner } from "./assessment-banner";
import { ErrorSummary } from "./error-summary";
import { FindingsList } from "./findings-list";
import { HumanReviewPanel } from "./human-review-panel";
import { ScenarioPicker } from "./scenario-picker";

describe("PromiseGuard UI components", () => {
  const asOf = new Date("2026-10-15T12:00:00.000Z");
  const supportedReq = createPromiseGuardPreset("supported", asOf);

  afterEach(() => {
    cleanup();
  });

  it("renders AssessmentBanner with truthful status and disclaimer", () => {
    const mockDeterministic = {
      rulesetVersion: "pg-rules-v1.0",
      evidenceRefs: [],
      data: {
        assessment: "supported" as const,
        decisionScope: "dispatch_readiness_not_delivery_guarantee" as const,
        evidenceCompleteness: "complete" as const,
        findings: [],
        derived: {
          deadlineState: "open" as const,
          readyByDeadline: true,
        },
      },
    };

    render(
      <AssessmentBanner
        assessment="supported"
        analysisStatus="complete"
        deterministic={mockDeterministic}
      />,
    );

    expect(screen.getByText("Supported")).toBeInTheDocument();
    expect(
      screen.getByText("Current evidence supports dispatch readiness"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/It is not a guarantee of dispatch or delivery/i),
    ).toBeInTheDocument();
  });

  it("renders HumanReviewPanel truthfully based on policy", () => {
    const { rerender } = render(
      <HumanReviewPanel
        humanReview={{
          required: true,
          reasonCodes: ["PROMISEGUARD_AT_RISK"],
          decidedBy: "deterministic_policy",
          policyVersion: "review-policy-v1",
        }}
      />,
    );

    expect(screen.getByText("Review Required")).toBeInTheDocument();
    expect(screen.getByText("The assessment is at risk")).toBeInTheDocument();

    rerender(
      <HumanReviewPanel
        humanReview={{
          required: false,
          reasonCodes: [],
          decidedBy: "deterministic_policy",
          policyVersion: "review-policy-v1",
        }}
      />,
    );

    expect(screen.getByText("No Review Required")).toBeInTheDocument();
  });

  it("renders AiPanel honestly when inference is unavailable", () => {
    render(
      <AiPanel
        inference={{
          status: "unavailable",
          reasonCode: "configuration",
        }}
      />,
    );

    expect(screen.getByText("Inference Offline")).toBeInTheDocument();
    expect(
      screen.getByText("AI assistance is not enabled in this environment."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Truthful Inference Guarantee/i),
    ).toBeInTheDocument();
  });

  it("renders AiPanel with mitigations and provenance when inference is available", () => {
    render(
      <AiPanel
        inference={{
          status: "available",
          providerId: "deterministic-mock",
          modelId: "mock-model",
          adapterVersion: "1.0",
          generatedAt: "2026-10-15T12:00:00.000Z",
          durationMs: 42,
          provenance: "synthetic_mock",
        }}
        aiRecommendation={{
          data: {
            operationalSummary:
              "Inventory is allocated but transit is constrained.",
            actions: [
              {
                actionCode: "verify_inventory_allocation",
                priority: 1,
                explanation: "Double check warehouse reservation.",
                evidenceIds: ["ev-inventory-001"],
              },
            ],
          },
          reasoningSummary: "Deterministic rules flagged no blocker.",
          evidenceRefs: ["ev-inventory-001"],
        }}
      />,
    );

    expect(screen.getByText("Synthetic Mock")).toBeInTheDocument();
    expect(
      screen.getByText("Inventory is allocated but transit is constrained."),
    ).toBeInTheDocument();
    expect(screen.getByText("Verify inventory allocation")).toBeInTheDocument();
    expect(
      screen.getByText("Double check warehouse reservation."),
    ).toBeInTheDocument();
  });

  it("renders AiPanel with neutral branding for live providers while G0 verification is blocked", () => {
    render(
      <AiPanel
        inference={{
          status: "available",
          providerId: "amd-token-factory",
          modelId: "meta/llama-3-70b-instruct",
          adapterVersion: "1.0",
          generatedAt: "2026-10-15T12:00:00.000Z",
          durationMs: 88,
          provenance: "live",
        }}
      />,
    );

    expect(screen.getByText("Live Inference Provider")).toBeInTheDocument();
    expect(screen.queryByText(/AMD Instinct/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Synthetic Mock")).not.toBeInTheDocument();
  });

  it("regression: ensures arbitrary amd-* provider ID cannot trigger AMD branding", () => {
    render(
      <AiPanel
        inference={{
          status: "available",
          providerId: "amd-arbitrary-unverified-adapter",
          modelId: "custom-model",
          adapterVersion: "1.0",
          generatedAt: "2026-10-15T12:00:00.000Z",
          durationMs: 72,
          provenance: "live",
        }}
      />,
    );

    expect(screen.getByText("Live Inference Provider")).toBeInTheDocument();
    expect(screen.queryByText(/AMD Instinct/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Synthetic Mock")).not.toBeInTheDocument();
  });

  it("renders AiPanel with neutral branding for unknown or other live providers", () => {
    render(
      <AiPanel
        inference={{
          status: "available",
          providerId: "custom-cloud-inference",
          modelId: "generic-v1",
          adapterVersion: "1.0",
          generatedAt: "2026-10-15T12:00:00.000Z",
          durationMs: 95,
          provenance: "live",
        }}
      />,
    );

    expect(screen.getByText("Live Inference Provider")).toBeInTheDocument();
    expect(screen.queryByText(/AMD Instinct/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Synthetic Mock")).not.toBeInTheDocument();
  });

  it("renders FindingsList and triggers onFocusField when action button is clicked", () => {
    const onFocus = vi.fn();

    render(
      <FindingsList
        findings={[
          {
            code: "INVENTORY_NOT_SECURED",
            impact: "adverse",
            trace: {
              kind: "evidence",
              evidenceIds: [
                supportedReq.operationalEvidence.inventoryAllocation.evidenceId,
              ],
            },
          },
        ]}
        request={supportedReq}
        onFocusField={onFocus}
      />,
    );

    expect(screen.getByText("Adverse Findings (1)")).toBeInTheDocument();
    const editBtn = screen.getByRole("button", {
      name: /Edit related fact/i,
    });
    fireEvent.click(editBtn);

    expect(onFocus).toHaveBeenCalledWith("inventory.status");
  });

  it("renders ErrorSummary and allows jumping to field", () => {
    const onFieldClick = vi.fn();

    render(
      <ErrorSummary
        generalMessage="Submission rejected."
        fieldErrors={[
          {
            key: "fulfillmentRef",
            message: "Enter a valid reference.",
          },
        ]}
        onFieldClick={onFieldClick}
      />,
    );

    expect(screen.getByText("Submission rejected.")).toBeInTheDocument();
    const link = screen.getByRole("link", {
      name: /Fulfillment reference: Enter a valid reference./i,
    });
    fireEvent.click(link);
    expect(onFieldClick).toHaveBeenCalledWith("fulfillmentRef");
  });

  it("renders ScenarioPicker and invokes onSelect", () => {
    const onSelect = vi.fn();

    render(<ScenarioPicker selectedId="supported" onSelect={onSelect} />);

    const atRiskCard = screen.getByRole("radio", {
      name: /Adverse evidence/i,
    });
    fireEvent.click(atRiskCard);
    expect(onSelect).toHaveBeenCalledWith("at_risk");
  });

  it("renders AnalysisProgress with cancel button", () => {
    const onCancel = vi.fn();

    render(<AnalysisProgress onCancel={onCancel} />);

    expect(
      screen.getByText(/Evaluating evidence and orchestrating analysis.../i),
    ).toBeInTheDocument();

    const cancelBtn = screen.getByRole("button", {
      name: /Cancel evaluation/i,
    });
    fireEvent.click(cancelBtn);
    expect(onCancel).toHaveBeenCalled();
  });
});
