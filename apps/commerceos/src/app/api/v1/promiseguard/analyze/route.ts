import {
  promiseGuardEvaluationRequestSchema,
  type ErrorEnvelope,
} from "@commerceos/contracts";
import type { InferenceProvider } from "@commerceos/inference";
import { randomUUID } from "node:crypto";

import { analyzePromiseGuard } from "../../../../../features/promiseguard/server/analyze";
import {
  createApiErrorResponse,
  createErrorResponse,
  type ServerContextFactory,
} from "../../../../../server/api/responses";
import { initializeServerConfiguration } from "../../../../../server/configuration";

export const runtime = "nodejs";

const MAX_REQUEST_BYTES = 16 * 1024;

type BodyReadResult =
  | { status: "ok"; text: string }
  | { status: "too_large" }
  | { status: "read_error" };

const readRequestBody = async (request: Request): Promise<BodyReadResult> => {
  if (!request.body) return { status: "ok", text: "" };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_REQUEST_BYTES) {
        await reader.cancel().catch(() => undefined);
        return { status: "too_large" };
      }
      chunks.push(value);
    }
  } catch {
    return { status: "read_error" };
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return {
      status: "ok",
      text: new TextDecoder("utf-8", { fatal: true }).decode(body),
    };
  } catch {
    return { status: "read_error" };
  }
};

export type PromiseGuardRouteDependencies = ServerContextFactory & {
  getInferenceProvider: () => InferenceProvider | null;
};

const defaultDependencies: PromiseGuardRouteDependencies = {
  now: () => new Date(),
  randomUUID,
  getInferenceProvider: () => initializeServerConfiguration().inferenceProvider,
};

const errorResponse = (
  status: number,
  error: ErrorEnvelope["error"],
  dependencies: PromiseGuardRouteDependencies,
): Response =>
  Response.json(createApiErrorResponse(error, dependencies), { status });

const validationPath = (path: PropertyKey[]): string => {
  if (path.length === 0) return "/";
  return `/${path
    .map((segment) =>
      String(segment).replaceAll("~", "~0").replaceAll("/", "~1"),
    )
    .join("/")}`;
};

export const createPromiseGuardAnalyzeHandler =
  (dependencies: PromiseGuardRouteDependencies = defaultDependencies) =>
  async (request: Request): Promise<Response> => {
    const mediaType = request.headers
      .get("content-type")
      ?.split(";", 1)[0]
      ?.trim()
      .toLowerCase();
    if (mediaType !== "application/json") {
      return errorResponse(
        415,
        {
          code: "UNSUPPORTED_MEDIA_TYPE",
          category: "validation",
          message: "Content-Type must be application/json.",
          retryable: false,
        },
        dependencies,
      );
    }

    const declaredLength = Number(request.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
      return errorResponse(
        413,
        {
          code: "PAYLOAD_TOO_LARGE",
          category: "validation",
          message: "The request exceeds the 16 KiB limit.",
          retryable: false,
        },
        dependencies,
      );
    }

    const body = await readRequestBody(request);
    if (body.status === "read_error") {
      return errorResponse(
        400,
        {
          code: "MALFORMED_JSON",
          category: "validation",
          message: "The request body is not valid JSON.",
          retryable: false,
        },
        dependencies,
      );
    }
    if (body.status === "too_large") {
      return errorResponse(
        413,
        {
          code: "PAYLOAD_TOO_LARGE",
          category: "validation",
          message: "The request exceeds the 16 KiB limit.",
          retryable: false,
        },
        dependencies,
      );
    }

    let input: unknown;
    try {
      input = JSON.parse(body.text);
    } catch {
      return errorResponse(
        400,
        {
          code: "MALFORMED_JSON",
          category: "validation",
          message: "The request body is not valid JSON.",
          retryable: false,
        },
        dependencies,
      );
    }

    const parsed = promiseGuardEvaluationRequestSchema.safeParse(input);
    if (!parsed.success) {
      return errorResponse(
        422,
        {
          code: "INVALID_REQUEST",
          category: "validation",
          message: "The request did not match the PromiseGuard contract.",
          retryable: false,
          fieldErrors: parsed.error.issues.slice(0, 64).map((issue) => ({
            path: validationPath(issue.path),
            code: "INVALID_FIELD",
            message: "The field is invalid.",
          })),
        },
        dependencies,
      );
    }

    try {
      const response = await analyzePromiseGuard(parsed.data, {
        inferenceProvider: dependencies.getInferenceProvider(),
        now: dependencies.now,
        randomUUID: dependencies.randomUUID,
      });
      return Response.json(response);
    } catch (error) {
      return Response.json(createErrorResponse(error, dependencies), {
        status: 500,
      });
    }
  };

export const POST = createPromiseGuardAnalyzeHandler();
