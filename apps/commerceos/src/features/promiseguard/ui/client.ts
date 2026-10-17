import {
  errorEnvelopeSchema,
  healthResponseSchema,
  promiseGuardEvaluationResponseSchema,
  type ErrorEnvelope,
  type PromiseGuardEvaluationRequest,
  type PromiseGuardEvaluationResponse,
} from "@commerceos/contracts";

/**
 * Thin browser client for the approved endpoints. Every response is parsed
 * with the approved Zod schema; a body that does not match is reported as a
 * contract mismatch and is never rendered. There are no fallback responses.
 */

export type ServerTimeOutcome =
  | { ok: true; asOf: Date; timestamp: string }
  | { ok: false; kind: "network" | "http" | "contract" | "cancelled" };

const isAbort = (error: unknown): boolean =>
  error instanceof DOMException && error.name === "AbortError";

const readJson = async (response: Response): Promise<unknown> => {
  try {
    return (await response.json()) as unknown;
  } catch {
    return undefined;
  }
};

/**
 * Reads the SERVER clock from the approved health endpoint. Synthetic scenario
 * timestamps are generated relative to this value, never the browser clock.
 */
export const fetchServerTime = async (
  signal?: AbortSignal,
): Promise<ServerTimeOutcome> => {
  try {
    const response = await fetch("/api/v1/health", {
      cache: "no-store",
      signal,
    });
    if (!response.ok) return { ok: false, kind: "http" };
    const parsed = healthResponseSchema.safeParse(await readJson(response));
    if (!parsed.success) return { ok: false, kind: "contract" };
    return {
      ok: true,
      asOf: new Date(parsed.data.timestamp),
      timestamp: parsed.data.timestamp,
    };
  } catch (error) {
    return { ok: false, kind: isAbort(error) ? "cancelled" : "network" };
  }
};

export type AnalyzeOutcome =
  | { kind: "success"; response: PromiseGuardEvaluationResponse }
  | { kind: "cancelled" }
  | { kind: "network" }
  | { kind: "api_error"; status: number; envelope: ErrorEnvelope }
  | { kind: "unexpected_http"; status: number }
  | { kind: "contract_mismatch"; status: number };

export const requestPromiseGuardAnalysis = async (
  request: PromiseGuardEvaluationRequest,
  signal?: AbortSignal,
): Promise<AnalyzeOutcome> => {
  let response: Response;
  try {
    response = await fetch("/api/v1/promiseguard/analyze", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
      cache: "no-store",
      signal,
    });
  } catch (error) {
    return { kind: isAbort(error) ? "cancelled" : "network" };
  }

  let body: unknown;
  try {
    body = (await response.json()) as unknown;
  } catch (error) {
    if (isAbort(error)) return { kind: "cancelled" };
    body = undefined;
  }

  if (response.ok) {
    const parsed = promiseGuardEvaluationResponseSchema.safeParse(body);
    return parsed.success
      ? { kind: "success", response: parsed.data }
      : { kind: "contract_mismatch", status: response.status };
  }

  const envelope = errorEnvelopeSchema.safeParse(body);
  return envelope.success
    ? { kind: "api_error", status: response.status, envelope: envelope.data }
    : { kind: "unexpected_http", status: response.status };
};
