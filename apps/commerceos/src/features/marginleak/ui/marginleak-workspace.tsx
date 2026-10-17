"use client";

import { useEffect, useRef, useState } from "react";
import type {
  ErrorEnvelope,
  MarginLeakEvaluationResponse,
  MarginLeakFinancialCategory,
} from "@commerceos/contracts";
import { AnalysisProgress } from "./analysis-progress";
import { requestMarginLeakAnalysis } from "./client";
import { ErrorSummary, RestrictedPreviewState } from "./error-summary";
import { FinancialEvidenceForm } from "./financial-evidence-form";
import {
  fieldDomId,
  mapServerFieldErrors,
  presetToDraft,
  validateMarginLeakDraft,
  type MarginLeakDraft,
  type MarginLeakFieldError,
  type MarginLeakFieldKey,
  type ObservationDraft,
  type ObservationSide,
} from "./form-model";
import type { MarginLeakObservationState } from "./labels";
import {
  createLossLeaderPresetRequest,
  createMarginLeakPreset,
  type MarginLeakPresetId,
} from "./presets";
import { ResultView } from "./result-view";
import { ScenarioPicker } from "./scenario-picker";

type WorkspaceStatus =
  | "idle"
  | "validation_error"
  | "submitting"
  | "result"
  | "restricted_preview"
  | "api_error"
  | "network_error"
  | "contract_error";

type ApiErrorState = {
  title: string;
  description: string;
  envelope?: ErrorEnvelope;
  retryable: boolean;
};

type MarginLeakWorkspaceProps = {
  fetchImpl?: typeof fetch;
};

const focusElementSafely = (el: HTMLElement | null) => {
  if (!el) return;
  const detailsParent = el.closest("details");
  if (detailsParent && !detailsParent.open) {
    detailsParent.setAttribute("open", "");
  }
  el.focus();
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (typeof el.scrollIntoView === "function") {
    el.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "nearest",
    });
  }
};

export function MarginLeakWorkspace({ fetchImpl }: MarginLeakWorkspaceProps) {
  const [selectedPreset, setSelectedPreset] =
    useState<MarginLeakPresetId>("leak_detected");
  const [draft, setDraft] = useState<MarginLeakDraft>(() =>
    presetToDraft(createMarginLeakPreset("leak_detected"), "leak_detected"),
  );
  const [isDirty, setIsDirty] = useState(false);
  const [isLossLeaderLoaded, setIsLossLeaderLoaded] = useState(false);
  const [status, setStatus] = useState<WorkspaceStatus>("idle");
  const [fieldErrors, setFieldErrors] = useState<MarginLeakFieldError[]>([]);
  const [result, setResult] = useState<MarginLeakEvaluationResponse | null>(
    null,
  );
  const [restrictedEnvelope, setRestrictedEnvelope] =
    useState<ErrorEnvelope | null>(null);
  const [apiError, setApiError] = useState<ApiErrorState | null>(null);
  const [statusAnnouncement, setStatusAnnouncement] = useState<string>("");

  const abortControllerRef = useRef<AbortController | null>(null);
  const requestSeqRef = useRef(0);

  const errorSummaryRef = useRef<HTMLDivElement | null>(null);
  const restrictedRef = useRef<HTMLDivElement | null>(null);
  const resultHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const [focusTarget, setFocusTarget] = useState<{
    kind: "result" | "error" | "restricted";
    seq: number;
  } | null>(null);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!focusTarget) return;
    if (focusTarget.kind === "result") {
      focusElementSafely(resultHeadingRef.current);
    } else if (focusTarget.kind === "error") {
      focusElementSafely(errorSummaryRef.current);
    } else if (focusTarget.kind === "restricted") {
      focusElementSafely(restrictedRef.current);
    }
  }, [focusTarget]);

  const invalidateInFlightAndResults = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    requestSeqRef.current += 1;
    setResult(null);
    setRestrictedEnvelope(null);
    setApiError(null);
  };

  const handleJumpToField = (key: MarginLeakFieldKey) => {
    const domId = fieldDomId(key);
    const el = document.getElementById(domId);
    focusElementSafely(el);
  };

  const handleSelectPreset = (presetId: MarginLeakPresetId) => {
    invalidateInFlightAndResults();
    const nextRequest = createMarginLeakPreset(presetId);
    setSelectedPreset(presetId);
    setDraft(presetToDraft(nextRequest, presetId));
    setIsDirty(false);
    setIsLossLeaderLoaded(false);
    setFieldErrors([]);
    setStatus("idle");
    setStatusAnnouncement(
      `Loaded synthetic scenario ${presetId}. Previous results cleared.`,
    );
  };

  const handleResetPreset = () => {
    invalidateInFlightAndResults();
    const nextRequest = createMarginLeakPreset(selectedPreset);
    setDraft(presetToDraft(nextRequest, selectedPreset));
    setIsDirty(false);
    setIsLossLeaderLoaded(false);
    setFieldErrors([]);
    setStatus("idle");
    setStatusAnnouncement(
      `Reset financial inputs to scenario ${selectedPreset}.`,
    );
  };

  const handleLoadLossLeader = () => {
    invalidateInFlightAndResults();
    const lossLeaderReq = createLossLeaderPresetRequest();
    setSelectedPreset("no_leak");
    setDraft(presetToDraft(lossLeaderReq, "no_leak"));
    setIsDirty(true);
    setIsLossLeaderLoaded(true);
    setFieldErrors([]);
    setStatus("idle");
    setStatusAnnouncement(
      "Loaded negative-margin loss-leader example (-$2.00 expected, -$1.00 observed).",
    );
  };

  const activePresetScenarioId =
    createMarginLeakPreset(selectedPreset).scenario.scenarioId;

  const handleUpdateOrderRef = (value: string) => {
    invalidateInFlightAndResults();
    setDraft((prev) => ({
      ...prev,
      scenarioId: activePresetScenarioId,
      orderRef: value,
    }));
    setIsDirty(true);
    setIsLossLeaderLoaded(false);
    setFieldErrors((prev) => prev.filter((e) => e.key !== "orderRef"));
    setStatus("idle");
  };

  const handleUpdateCurrency = (value: string) => {
    invalidateInFlightAndResults();
    setDraft((prev) => ({
      ...prev,
      scenarioId: activePresetScenarioId,
      currency: value,
    }));
    setIsDirty(true);
    setIsLossLeaderLoaded(false);
    setFieldErrors((prev) => prev.filter((e) => e.key !== "currency"));
    setStatus("idle");
  };

  const handleUpdateObservationState = (value: MarginLeakObservationState) => {
    invalidateInFlightAndResults();
    setDraft((prev) => ({
      ...prev,
      scenarioId: activePresetScenarioId,
      observationState: value,
    }));
    setIsDirty(true);
    setIsLossLeaderLoaded(false);
    setFieldErrors((prev) => prev.filter((e) => e.key !== "observationState"));
    setStatus("idle");
  };

  const handleUpdateObservation = (
    category: MarginLeakFinancialCategory,
    side: ObservationSide,
    patch: Partial<ObservationDraft>,
  ) => {
    invalidateInFlightAndResults();
    setDraft((prev) => ({
      ...prev,
      scenarioId: activePresetScenarioId,
      financials: {
        ...prev.financials,
        [category]: {
          ...prev.financials[category],
          [side]: {
            ...prev.financials[category][side],
            ...patch,
          },
        },
      },
    }));
    setIsDirty(true);
    setIsLossLeaderLoaded(false);
    const prefix = `financials.${category}.${side}.`;
    setFieldErrors((prev) => prev.filter((e) => !e.key.startsWith(prefix)));
    setStatus("idle");
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    requestSeqRef.current += 1;
    setStatus("idle");
    setStatusAnnouncement("Margin analysis cancelled.");
  };

  const handleSubmit = async () => {
    invalidateInFlightAndResults();

    const validation = validateMarginLeakDraft(draft);
    if (!validation.ok) {
      setFieldErrors(validation.errors);
      setStatus("validation_error");
      setApiError({
        title: `Fix ${validation.errors.length} financial input issue${validation.errors.length === 1 ? "" : "s"} before analyzing`,
        description:
          "MarginLeak requires valid integer minor-unit amounts, unique evidence IDs, and matching ISO-4217 currency codes across all included observations.",
        retryable: false,
      });
      setStatusAnnouncement(
        `Validation failed with ${validation.errors.length} error${validation.errors.length === 1 ? "" : "s"}.`,
      );
      setFocusTarget((prev) => ({
        kind: "error",
        seq: (prev?.seq ?? 0) + 1,
      }));
      return;
    }

    setFieldErrors([]);
    setStatus("submitting");
    setStatusAnnouncement(
      `Submitting order ${validation.request.orderRef} for deterministic margin analysis.`,
    );

    const controller = new AbortController();
    abortControllerRef.current = controller;
    const seq = requestSeqRef.current;

    const outcome = await requestMarginLeakAnalysis(validation.request, {
      signal: controller.signal,
      fetchImpl,
    });

    if (seq !== requestSeqRef.current) {
      return;
    }

    abortControllerRef.current = null;

    if (outcome.ok) {
      setResult(outcome.data);
      setStatus("result");
      setStatusAnnouncement(
        `Analysis complete for order ${outcome.data.deterministic.data.orderRef}: ${outcome.data.deterministic.data.assessment}.`,
      );
      setFocusTarget((prev) => ({
        kind: "result",
        seq: (prev?.seq ?? 0) + 1,
      }));
      return;
    }

    if (outcome.kind === "cancelled") {
      setStatus("idle");
      return;
    }

    if (outcome.kind === "restricted_preview") {
      setRestrictedEnvelope(outcome.envelope);
      setStatus("restricted_preview");
      setStatusAnnouncement(
        "MarginLeak synthetic preview is disabled in this runtime (HTTP 403).",
      );
      setFocusTarget((prev) => ({
        kind: "restricted",
        seq: (prev?.seq ?? 0) + 1,
      }));
      return;
    }

    if (outcome.kind === "api_error") {
      const mappedErrors = mapServerFieldErrors(outcome.envelope);
      setFieldErrors(mappedErrors);
      setStatus("api_error");
      setApiError({
        title: `Server rejected margin analysis (HTTP ${outcome.httpStatus})`,
        description: outcome.envelope.error.message,
        envelope: outcome.envelope,
        retryable: outcome.envelope.error.retryable,
      });
      setStatusAnnouncement(
        `Server returned error: ${outcome.envelope.error.message}`,
      );
      setFocusTarget((prev) => ({
        kind: "error",
        seq: (prev?.seq ?? 0) + 1,
      }));
      return;
    }

    if (outcome.kind === "contract_mismatch") {
      setStatus("contract_error");
      setApiError({
        title: "Response failed MarginLeak v1.0 contract verification",
        description: outcome.message,
        retryable: false,
      });
      setStatusAnnouncement("Contract verification error.");
      setFocusTarget((prev) => ({
        kind: "error",
        seq: (prev?.seq ?? 0) + 1,
      }));
      return;
    }

    setStatus("network_error");
    setApiError({
      title: "Unable to reach MarginLeak evaluation endpoint",
      description: outcome.message,
      retryable: true,
    });
    setStatusAnnouncement(`Network error: ${outcome.message}`);
    setFocusTarget((prev) => ({
      kind: "error",
      seq: (prev?.seq ?? 0) + 1,
    }));
  };

  return (
    <div className="ml-workspace">
      <div className="sr-only" role="status" aria-live="polite">
        {statusAnnouncement}
      </div>

      <ScenarioPicker
        selectedPreset={selectedPreset}
        disabled={status === "submitting"}
        onSelectPreset={handleSelectPreset}
      />

      {(status === "validation_error" ||
        status === "api_error" ||
        status === "network_error" ||
        status === "contract_error") &&
        apiError && (
          <ErrorSummary
            summaryRef={errorSummaryRef}
            title={apiError.title}
            description={apiError.description}
            fieldErrors={fieldErrors}
            envelope={apiError.envelope}
            retryable={apiError.retryable}
            onFocusField={handleJumpToField}
            onRetry={apiError.retryable ? handleSubmit : undefined}
          />
        )}

      {status === "restricted_preview" && restrictedEnvelope && (
        <RestrictedPreviewState
          restrictedRef={restrictedRef}
          envelope={restrictedEnvelope}
        />
      )}

      <FinancialEvidenceForm
        draft={draft}
        fieldErrors={fieldErrors}
        isDirty={isDirty}
        isLossLeaderLoaded={isLossLeaderLoaded}
        isSubmitting={status === "submitting"}
        onUpdateOrderRef={handleUpdateOrderRef}
        onUpdateCurrency={handleUpdateCurrency}
        onUpdateObservationState={handleUpdateObservationState}
        onUpdateObservation={handleUpdateObservation}
        onResetPreset={handleResetPreset}
        onLoadLossLeader={handleLoadLossLeader}
        onSubmit={handleSubmit}
      />

      {status === "submitting" && (
        <AnalysisProgress
          orderRef={draft.orderRef}
          scenarioId={draft.scenarioId}
          onCancel={handleCancel}
        />
      )}

      {status === "idle" && !result && (
        <section className="ml-idle-callout" aria-labelledby="ml-idle-heading">
          <p className="eyebrow">Ready For Evaluation</p>
          <h3 id="ml-idle-heading" className="ml-idle-title">
            Submit financial observations to calculate deterministic
            contribution-margin variance
          </h3>
          <p className="ml-idle-copy">
            Click <strong>Run Margin Analysis</strong> above to send the
            selected synthetic order fixture to{" "}
            <code>POST /api/v1/marginleak/analyze</code>. Any edit to order
            context, category amounts, or included observations immediately
            clears previous results so stale figures never remain on screen.
          </p>
        </section>
      )}

      {status === "result" && result && (
        <ResultView
          headingRef={resultHeadingRef}
          response={result}
          onJumpToField={handleJumpToField}
        />
      )}
    </div>
  );
}
