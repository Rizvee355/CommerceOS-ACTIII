import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z, type ZodType } from "zod";

import {
  analysisResponseEnvelopeSchema,
  capabilitiesResponseSchema,
  capabilityStatusSchema,
  errorEnvelopeSchema,
  evidenceRefSchema,
  healthResponseSchema,
  humanReviewMetadataSchema,
  inferenceMetadataSchema,
  marginLeakEvaluationRequestSchema,
  marginLeakEvaluationResponseSchema,
  moneySchema,
  promiseGuardEvaluationRequestSchema,
  promiseGuardEvaluationResponseSchema,
  requestMetadataSchema,
  responseMetadataSchema,
  scenarioRefSchema,
} from "../src/v1/index";

const schemaDefinitions = {
  AnalysisResponseEnvelope: analysisResponseEnvelopeSchema,
  CapabilitiesResponse: capabilitiesResponseSchema,
  CapabilityStatus: capabilityStatusSchema,
  ErrorEnvelope: errorEnvelopeSchema,
  EvidenceRef: evidenceRefSchema,
  HealthResponse: healthResponseSchema,
  HumanReviewMetadata: humanReviewMetadataSchema,
  InferenceMetadata: inferenceMetadataSchema,
  MarginLeakEvaluationRequest: marginLeakEvaluationRequestSchema,
  MarginLeakEvaluationResponse: marginLeakEvaluationResponseSchema,
  Money: moneySchema,
  PromiseGuardEvaluationRequest: promiseGuardEvaluationRequestSchema,
  PromiseGuardEvaluationResponse: promiseGuardEvaluationResponseSchema,
  RequestMetadata: requestMetadataSchema,
  ResponseMetadata: responseMetadataSchema,
  ScenarioRef: scenarioRefSchema,
} satisfies Record<string, ZodType>;

const fileNames: Record<keyof typeof schemaDefinitions, string> = {
  AnalysisResponseEnvelope: "analysis-response-envelope.schema.json",
  CapabilitiesResponse: "capabilities-response.schema.json",
  CapabilityStatus: "capability-status.schema.json",
  ErrorEnvelope: "error-envelope.schema.json",
  EvidenceRef: "evidence-ref.schema.json",
  HealthResponse: "health-response.schema.json",
  HumanReviewMetadata: "human-review-metadata.schema.json",
  InferenceMetadata: "inference-metadata.schema.json",
  MarginLeakEvaluationRequest: "marginleak-evaluation-request.schema.json",
  MarginLeakEvaluationResponse: "marginleak-evaluation-response.schema.json",
  Money: "money.schema.json",
  PromiseGuardEvaluationRequest: "promiseguard-evaluation-request.schema.json",
  PromiseGuardEvaluationResponse:
    "promiseguard-evaluation-response.schema.json",
  RequestMetadata: "request-metadata.schema.json",
  ResponseMetadata: "response-metadata.schema.json",
  ScenarioRef: "scenario-ref.schema.json",
};

const asJsonSchema = (
  name: string,
  schema: ZodType,
): Record<string, unknown> => ({
  ...z.toJSONSchema(schema, { target: "draft-2020-12" }),
  $id: `https://commerceos.dev/contracts/v1/${fileNames[name as keyof typeof fileNames]}`,
  title: name,
  "x-commerceos-runtime-validation": true,
});

export const createArtifacts = (): Map<string, unknown> => {
  const artifacts = new Map<string, unknown>();
  const components: Record<string, unknown> = {};

  for (const [name, schema] of Object.entries(schemaDefinitions)) {
    const jsonSchema = asJsonSchema(name, schema);
    components[name] = jsonSchema;
    artifacts.set(
      `json-schema/${fileNames[name as keyof typeof fileNames]}`,
      jsonSchema,
    );
  }

  artifacts.set("openapi/openapi.json", {
    openapi: "3.1.0",
    info: {
      title: "CommerceOS API",
      version: "1.0.0",
      description:
        "CommerceOS foundation endpoints and synthetic-only analysis operations.",
    },
    paths: {
      "/api/v1/capabilities": {
        get: {
          operationId: "getCapabilities",
          summary: "Report truthful module readiness",
          responses: {
            "200": {
              description: "Capability status",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/CapabilitiesResponse" },
                },
              },
            },
          },
        },
      },
      "/api/v1/health": {
        get: {
          operationId: "getHealth",
          summary: "Report application process health",
          responses: {
            "200": {
              description: "Healthy application process",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/HealthResponse" },
                },
              },
            },
          },
        },
      },
      "/api/v1/marginleak/analyze": {
        post: {
          operationId: "analyzeMarginLeak",
          summary: "Evaluate synthetic contribution-margin evidence",
          description:
            "Available only in development and test runtimes. Production requests are denied before payload processing.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/MarginLeakEvaluationRequest",
                },
              },
            },
          },
          responses: {
            "200": {
              description: "MarginLeak deterministic evaluation",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/MarginLeakEvaluationResponse",
                  },
                },
              },
            },
            "400": { $ref: "#/components/responses/ErrorResponse" },
            "403": { $ref: "#/components/responses/ErrorResponse" },
            "413": { $ref: "#/components/responses/ErrorResponse" },
            "415": { $ref: "#/components/responses/ErrorResponse" },
            "422": { $ref: "#/components/responses/ErrorResponse" },
            "500": { $ref: "#/components/responses/ErrorResponse" },
          },
        },
      },
      "/api/v1/promiseguard/analyze": {
        post: {
          operationId: "analyzePromiseGuard",
          summary: "Evaluate synthetic dispatch-readiness evidence",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/PromiseGuardEvaluationRequest",
                },
              },
            },
          },
          responses: {
            "200": {
              description: "PromiseGuard evaluation",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/PromiseGuardEvaluationResponse",
                  },
                },
              },
            },
            "400": { $ref: "#/components/responses/ErrorResponse" },
            "413": { $ref: "#/components/responses/ErrorResponse" },
            "415": { $ref: "#/components/responses/ErrorResponse" },
            "422": { $ref: "#/components/responses/ErrorResponse" },
            "500": { $ref: "#/components/responses/ErrorResponse" },
          },
        },
      },
    },
    components: {
      schemas: components,
      responses: {
        ErrorResponse: {
          description: "Sanitized CommerceOS error",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorEnvelope" },
            },
          },
        },
      },
    },
  });

  return artifacts;
};

const sortKeys = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, sortKeys(nested)]),
    );
  }
  return value;
};

const serialize = (value: unknown): string =>
  `${JSON.stringify(sortKeys(value), null, 2)}\n`;

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = resolve(packageRoot, "generated");

const run = (): void => {
  const check = process.argv.includes("--check");
  const mismatches: string[] = [];

  for (const [relativePath, content] of createArtifacts()) {
    const target = resolve(outputRoot, relativePath);
    const expected = serialize(content);

    if (check) {
      if (!existsSync(target) || readFileSync(target, "utf8") !== expected) {
        mismatches.push(relativePath);
      }
      continue;
    }

    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, expected, "utf8");
  }

  if (mismatches.length > 0) {
    throw new Error(
      `Generated contract artifacts are stale: ${mismatches.join(", ")}`,
    );
  }
};

const invokedDirectly =
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (invokedDirectly) run();
