"use client";

import type {
  PromiseGuardEvaluationRequest,
  PromiseGuardEvaluationResponse,
} from "@commerceos/contracts";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createPromiseGuardPreset,
  type PromiseGuardPresetId,
} from "../domain/presets";
import { AnalysisProgress } from "./analysis-progress";
import { fetchServerTime, requestPromiseGuardAnalysis } from "./client";
import { ErrorSummary } from "./error-summary";
import { EvidenceForm } from "./evidence-form";
import {
  fieldDomId,
  mapServerFieldErrors,
  presetToDraft,
  validateDraft,
  type FieldError,
  type FieldKey,
  type PromiseGuardDraft,
} from "./form-model";
import { ResultView } from "./result-view";
import { ScenarioPicker } from "./scenario-picker";

export type ClockSyncState =
  | { status: "syncing" }
  | { status: "synced"; timestamp: string; asOf: Date }
  | { status: "error"; message: string };

const prefersReducedMotion = (): boolean => {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
};

const safeScrollIntoView = (
  el: HTMLElement | null,
  block: ScrollLogicalPosition = "start",
) => {
  if (typeof el?.scrollIntoView === "function") {
    el.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block,
    });
  }
};

export const PromiseGuardWorkspace = () => {
  const [selectedPreset, setSelectedPreset] =
    useState<PromiseGuardPresetId>("supported");
  const [clockSyncState, setClockSyncState] = useState<ClockSyncState>({
    status: "syncing",
  });
  const [serverTimestamp, setServerTimestamp] = useState<string | null>(null);
  const [draft, setDraft] = useState<PromiseGuardDraft | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldError[]>([]);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeRequest, setActiveRequest] =
    useState<PromiseGuardEvaluationRequest | null>(null);
  const [activeResponse, setActiveResponse] =
    useState<PromiseGuardEvaluationResponse | null>(null);
  const [liveAnnouncement, setLiveAnnouncement] = useState<string>("");

  const abortControllerRef = useRef<AbortController | null>(null);
  const clockAbortRef = useRef<AbortController | null>(null);
  const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const errorSummaryRef = useRef<HTMLDivElement | null>(null);
  const formHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const resultsHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const clockRequestIdRef = useRef(0);
  const analysisRequestIdRef = useRef(0);
  const pendingPresetRef = useRef<PromiseGuardPresetId | null>("supported");

  const clearFocusTimer = useCallback(() => {
    if (focusTimerRef.current !== null) {
      clearTimeout(focusTimerRef.current);
      focusTimerRef.current = null;
    }
  }, []);

  const scheduleFocusAndScroll = useCallback(
    (
      getTarget: () => HTMLElement | null,
      block: ScrollLogicalPosition = "start",
    ) => {
      clearFocusTimer();
      focusTimerRef.current = setTimeout(() => {
        focusTimerRef.current = null;
        const target = getTarget();
        target?.focus();
        safeScrollIntoView(target, block);
      }, 30);
    },
    [clearFocusTimer],
  );

  // Helper to invalidate any previous evaluation results
  const clearResults = useCallback(() => {
    clearFocusTimer();
    setActiveResponse(null);
    setActiveRequest(null);
  }, [clearFocusTimer]);

  const syncServerClock = useCallback(
    async (presetToApply?: PromiseGuardPresetId): Promise<boolean> => {
      clockAbortRef.current?.abort();
      const controller = new AbortController();
      clockAbortRef.current = controller;

      const targetPreset = presetToApply ?? pendingPresetRef.current;
      if (targetPreset) {
        pendingPresetRef.current = targetPreset;
      }

      const clockRequestId = ++clockRequestIdRef.current;
      setClockSyncState({ status: "syncing" });

      const outcome = await fetchServerTime(controller.signal);

      // If a newer clock request or user edit arrived, discard this late response
      if (clockRequestId !== clockRequestIdRef.current) return false;

      if (outcome.ok) {
        setServerTimestamp(outcome.timestamp);
        setClockSyncState({
          status: "synced",
          timestamp: outcome.timestamp,
          asOf: outcome.asOf,
        });

        if (targetPreset) {
          setDraft(
            presetToDraft(
              createPromiseGuardPreset(targetPreset, outcome.asOf),
              targetPreset,
            ),
          );
          pendingPresetRef.current = null;
        }
        return true;
      } else {
        if (outcome.kind === "cancelled") return false;
        setServerTimestamp(null);
        setClockSyncState({
          status: "error",
          message:
            "Failed to synchronize with CommerceOS server clock. Authoritative server time is required to evaluate synthetic presets.",
        });
        return false;
      }
    },
    [],
  );

  // Synchronize with server clock on mount — no browser clock fallback
  useEffect(() => {
    let ignore = false;
    const initServerClock = async () => {
      const controller = new AbortController();
      clockAbortRef.current = controller;
      const clockRequestId = ++clockRequestIdRef.current;
      pendingPresetRef.current = "supported";

      const outcome = await fetchServerTime(controller.signal);
      if (ignore || clockRequestId !== clockRequestIdRef.current) return;

      if (outcome.ok) {
        setServerTimestamp(outcome.timestamp);
        setClockSyncState({
          status: "synced",
          timestamp: outcome.timestamp,
          asOf: outcome.asOf,
        });
        setDraft(
          presetToDraft(
            createPromiseGuardPreset("supported", outcome.asOf),
            "supported",
          ),
        );
        pendingPresetRef.current = null;
      } else {
        if (outcome.kind === "cancelled") return;
        setServerTimestamp(null);
        setClockSyncState({
          status: "error",
          message:
            "Failed to synchronize with CommerceOS server clock. Authoritative server time is required to evaluate synthetic presets.",
        });
      }
    };

    void initServerClock();

    return () => {
      ignore = true;
      clearFocusTimer();
      clockAbortRef.current?.abort();
      abortControllerRef.current?.abort();
    };
  }, [clearFocusTimer]);

  const handleSelectPreset = useCallback(
    async (presetId: PromiseGuardPresetId) => {
      clearResults();
      setFieldErrors([]);
      setGeneralError(null);

      // Invalidate any active analysis
      analysisRequestIdRef.current++;
      abortControllerRef.current?.abort();
      setIsAnalyzing(false);

      pendingPresetRef.current = presetId;
      setSelectedPreset(presetId);

      // Fetch fresh server time to avoid skew, and populate preset
      const ok = await syncServerClock(presetId);
      if (ok) {
        setLiveAnnouncement(
          `Loaded ${presetId.replace("_", " ")} scenario preset into the evidence form.`,
        );
      }
    },
    [clearResults, syncServerClock],
  );

  const handleResetToPreset = useCallback(async () => {
    clearResults();
    setFieldErrors([]);
    setGeneralError(null);

    // Invalidate any active analysis
    analysisRequestIdRef.current++;
    abortControllerRef.current?.abort();
    setIsAnalyzing(false);

    pendingPresetRef.current = selectedPreset;

    // Fetch fresh server time and reapply selected preset
    const ok = await syncServerClock(selectedPreset);
    if (ok) {
      setLiveAnnouncement("Form reset to current scenario preset.");
    }
  }, [clearResults, selectedPreset, syncServerClock]);

  const handleRetryClockSync = useCallback(async () => {
    setGeneralError(null);
    const targetPreset =
      pendingPresetRef.current ?? (draft === null ? selectedPreset : undefined);
    const ok = await syncServerClock(targetPreset);
    if (ok) {
      setLiveAnnouncement(
        "Server clock synchronized. Scenario preset is ready.",
      );
    }
  }, [draft, selectedPreset, syncServerClock]);

  const handleDraftChange = useCallback(
    (nextDraft: PromiseGuardDraft) => {
      // Invalidate any in-flight clock requests so late arrivals don't overwrite user edits
      clockRequestIdRef.current++;
      clockAbortRef.current?.abort();
      pendingPresetRef.current = null;

      // Invalidate any in-flight analysis
      analysisRequestIdRef.current++;
      abortControllerRef.current?.abort();
      setIsAnalyzing(false);

      // Invalidate previous evaluation results immediately
      clearResults();

      setDraft(nextDraft);

      if (fieldErrors.length > 0) {
        setFieldErrors([]);
      }
      if (generalError) {
        setGeneralError(null);
      }
    },
    [clearResults, fieldErrors.length, generalError],
  );

  const handleSubmit = useCallback(async () => {
    clearResults();
    setFieldErrors([]);
    setGeneralError(null);

    // Fail safely if server clock is not synchronized or a preset switch failed clock sync
    if (
      clockSyncState.status !== "synced" ||
      !serverTimestamp ||
      pendingPresetRef.current !== null
    ) {
      setGeneralError(
        "Cannot evaluate scenario: authoritative server clock synchronization is required. Please synchronize with the server clock.",
      );
      return;
    }

    if (!draft) {
      setGeneralError("Evidence draft is empty.");
      return;
    }

    const validation = validateDraft(draft);
    if (!validation.ok) {
      setFieldErrors(validation.errors);
      scheduleFocusAndScroll(() => errorSummaryRef.current, "start");
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    const analysisRequestId = ++analysisRequestIdRef.current;

    setIsAnalyzing(true);
    setActiveRequest(validation.request);
    setLiveAnnouncement(
      "Evaluating commitment and operational evidence. Please wait.",
    );

    const outcome = await requestPromiseGuardAnalysis(
      validation.request,
      controller.signal,
    );

    // If cancelled, edited, or superseded by a newer request, discard
    if (analysisRequestId !== analysisRequestIdRef.current) return;

    setIsAnalyzing(false);
    abortControllerRef.current = null;

    if (outcome.kind === "success") {
      setActiveResponse(outcome.response);
      const assessmentLabel =
        outcome.response.deterministic.data.assessment.replace("_", " ");
      setLiveAnnouncement(
        `Evaluation complete. Readiness assessment is ${assessmentLabel}.`,
      );
      scheduleFocusAndScroll(() => resultsHeadingRef.current, "start");
      return;
    }

    // Results remain cleared on any non-success outcome
    clearResults();

    if (outcome.kind === "cancelled") {
      setGeneralError("Evaluation was cancelled.");
      return;
    }

    if (outcome.kind === "network") {
      setGeneralError(
        "Network connection error. Check your connection to the CommerceOS server.",
      );
      scheduleFocusAndScroll(() => errorSummaryRef.current, "start");
      return;
    }

    if (outcome.kind === "api_error") {
      const serverErrors = mapServerFieldErrors(
        outcome.envelope.error.fieldErrors,
      );
      setGeneralError(outcome.envelope.error.message);
      if (serverErrors.length > 0) {
        setFieldErrors(serverErrors);
      }
      scheduleFocusAndScroll(() => errorSummaryRef.current, "start");
      return;
    }

    if (outcome.kind === "contract_mismatch") {
      setGeneralError(
        "The server returned a response that did not match the expected PromiseGuard contract schema.",
      );
      scheduleFocusAndScroll(() => errorSummaryRef.current, "start");
      return;
    }

    setGeneralError("An unexpected server error occurred during evaluation.");
    scheduleFocusAndScroll(() => errorSummaryRef.current, "start");
  }, [
    clearResults,
    clockSyncState.status,
    draft,
    scheduleFocusAndScroll,
    serverTimestamp,
  ]);

  const handleCancel = useCallback(() => {
    analysisRequestIdRef.current++;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsAnalyzing(false);
    clearResults();
    setLiveAnnouncement("Evaluation cancelled.");
  }, [clearResults]);

  const handleFocusField = useCallback((key: FieldKey) => {
    const domId = fieldDomId(key);
    const el = document.getElementById(domId);
    if (el) {
      el.focus();
      safeScrollIntoView(el, "center");
    } else {
      formHeadingRef.current?.focus();
      safeScrollIntoView(formHeadingRef.current, "start");
    }
  }, []);

  const handleReviseEvidence = useCallback(() => {
    formHeadingRef.current?.focus();
    safeScrollIntoView(formHeadingRef.current, "start");
  }, []);

  const errorsMap = useMemo(() => {
    const map: Partial<Record<FieldKey, string>> = {};
    for (const err of fieldErrors) {
      if (err.key && !map[err.key]) {
        map[err.key] = err.message;
      }
    }
    return map;
  }, [fieldErrors]);

  return (
    <div className="pg-workspace">
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {liveAnnouncement}
      </div>

      <div className="pg-workspace-container">
        <ScenarioPicker
          selectedId={selectedPreset}
          onSelect={handleSelectPreset}
          disabled={isAnalyzing}
        />

        {clockSyncState.status === "error" && (
          <div
            className="pg-clock-error-banner"
            role="alert"
            data-testid="clock-sync-error"
          >
            <div className="pg-clock-error-content">
              <strong className="pg-clock-error-title">
                Server Clock Synchronization Failed
              </strong>
              <p className="pg-clock-error-msg">{clockSyncState.message}</p>
            </div>
            <button
              type="button"
              className="pg-button pg-button-secondary"
              onClick={handleRetryClockSync}
            >
              Retry Clock Synchronization
            </button>
          </div>
        )}

        {clockSyncState.status === "syncing" && (
          <div className="pg-clock-syncing" role="status">
            <span className="sync-spinner" aria-hidden="true" />
            <p>Synchronizing with CommerceOS server clock…</p>
          </div>
        )}

        <ErrorSummary
          ref={errorSummaryRef}
          generalMessage={generalError}
          fieldErrors={fieldErrors}
          onFieldClick={handleFocusField}
        />

        {isAnalyzing && <AnalysisProgress onCancel={handleCancel} />}

        {draft && (
          <EvidenceForm
            draft={draft}
            errors={errorsMap}
            disabled={isAnalyzing || clockSyncState.status !== "synced"}
            serverTime={serverTimestamp}
            headingRef={formHeadingRef}
            onChange={handleDraftChange}
            onSubmit={handleSubmit}
            onReset={handleResetToPreset}
          />
        )}

        {activeResponse && activeRequest && (
          <ResultView
            response={activeResponse}
            request={activeRequest}
            headingRef={resultsHeadingRef}
            onReviseEvidence={handleReviseEvidence}
            onFocusField={handleFocusField}
          />
        )}
      </div>
    </div>
  );
};
