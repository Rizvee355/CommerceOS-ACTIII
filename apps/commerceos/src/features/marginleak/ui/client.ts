import {
  errorEnvelopeSchema,
  marginLeakEvaluationResponseSchema,
  type ErrorEnvelope,
  type MarginLeakEvaluationRequest,
  type MarginLeakEvaluationResponse,
} from "@commerceos/contracts";

/**
 * Thin browser client for `/api/v1/marginleak/analyze`.
 *
 * Every response is validated against the canonical Zod contract. If the server
 * returns HTTP 403 (`MARGINLEAK_PREVIEW_UNAVAILABLE`), the outcome is surfaced
 * as `restricted_preview` so the UI renders a dedicated non-retryable
 * governance explanation.
 */

const isAbort = (error: unknown): boolean =>
  (error instanceof DOMException && error.name === "AbortError") ||
  (error instanceof Error && error.name === "AbortError");

export type MarginLeakAnalyzeOutcome =
  | { ok: true; data: MarginLeakEvaluationResponse }
  | { ok: false; kind: "cancelled" }
  | { ok: false; kind: "network"; message: string }
  | {
      ok: false;
      kind: "restricted_preview";
      httpStatus: number;
      envelope: ErrorEnvelope;
    }
  | {
      ok: false;
      kind: "api_error";
      httpStatus: number;
      envelope: ErrorEnvelope;
    }
  | { ok: false; kind: "contract_mismatch"; message: string };

export const requestMarginLeakAnalysis = async (
  request: MarginLeakEvaluationRequest,
  options?: {
    signal?: AbortSignal;
    fetchImpl?: typeof fetch;
  },
): Promise<MarginLeakAnalyzeOutcome> => {
  const fetcher = options?.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetcher("/api/v1/marginleak/analyze", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
      cache: "no-store",
      signal: options?.signal,
    });
  } catch (error) {
    if (isAbort(error)) {
      return { ok: false, kind: "cancelled" };
    }
    return {
      ok: false,
      kind: "network",
      message:
        error instanceof Error && error.message
          ? error.message
          : "Network request failed before receiving a server response.",
    };
  }

  let body: unknown;
  try {
    body = (await response.json()) as unknown;
  } catch (error) {
    if (isAbort(error)) {
      return { ok: false, kind: "cancelled" };
    }
    body = undefined;
  }

  if (response.ok) {
    const parsed = marginLeakEvaluationResponseSchema.safeParse(body);
    return parsed.success
      ? { ok: true, data: parsed.data }
      : {
          ok: false,
          kind: "contract_mismatch",
          message:
            "The server returned HTTP 200, but the response payload did not satisfy marginLeakEvaluationResponseSchema.",
        };
  }

  const envelope = errorEnvelopeSchema.safeParse(body);
  if (envelope.success) {
    if (
      response.status === 403 ||
      envelope.data.error.code === "MARGINLEAK_PREVIEW_UNAVAILABLE"
    ) {
      return {
        ok: false,
        kind: "restricted_preview",
        httpStatus: response.status,
        envelope: envelope.data,
      };
    }
    return {
      ok: false,
      kind: "api_error",
      httpStatus: response.status,
      envelope: envelope.data,
    };
  }

  return {
    ok: false,
    kind: "contract_mismatch",
    message: `Unexpected non-contract response (HTTP ${response.status}).`,
  };
};
