import {
  marginLeakEvaluationRequestSchema,
  type ErrorEnvelope,
} from "@commerceos/contracts";
import { randomUUID } from "node:crypto";

import {
  analyzeMarginLeak,
  type MarginLeakAnalysisDependencies,
} from "../../../../../features/marginleak/server/analyze";
import { readJsonRequest } from "../../../../../server/api/json-request";
import {
  createApiErrorResponse,
  createErrorResponse,
  type ServerContextFactory,
} from "../../../../../server/api/responses";

export const runtime = "nodejs";

export type MarginLeakRouteDependencies = ServerContextFactory & {
  analyze: typeof analyzeMarginLeak;
};

const defaultDependencies: MarginLeakRouteDependencies = {
  now: () => new Date(),
  randomUUID,
  analyze: analyzeMarginLeak,
};

const errorResponse = (
  status: number,
  error: ErrorEnvelope["error"],
  dependencies: MarginLeakRouteDependencies,
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

const isPreviewRuntimeAllowed = (): boolean =>
  process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test";

export const createMarginLeakAnalyzeHandler =
  (dependencies: MarginLeakRouteDependencies = defaultDependencies) =>
  async (request: Request): Promise<Response> => {
    if (!isPreviewRuntimeAllowed()) {
      return errorResponse(
        403,
        {
          code: "MARGINLEAK_PREVIEW_UNAVAILABLE",
          category: "authorization",
          message: "The MarginLeak synthetic preview is unavailable.",
          retryable: false,
        },
        dependencies,
      );
    }

    const body = await readJsonRequest(request);
    if (body.status === "unsupported_media_type") {
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
    if (body.status === "malformed_json") {
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

    const parsed = marginLeakEvaluationRequestSchema.safeParse(body.value);
    if (!parsed.success) {
      return errorResponse(
        422,
        {
          code: "INVALID_REQUEST",
          category: "validation",
          message: "The request did not match the MarginLeak contract.",
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
      const analysisDependencies: MarginLeakAnalysisDependencies = {
        now: dependencies.now,
        randomUUID: dependencies.randomUUID,
      };
      const response = dependencies.analyze(parsed.data, analysisDependencies);
      return Response.json(response);
    } catch (error) {
      return Response.json(createErrorResponse(error, dependencies), {
        status: 500,
      });
    }
  };

export const POST = createMarginLeakAnalyzeHandler();
