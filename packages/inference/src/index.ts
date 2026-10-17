import type { InferenceMetadata, ScenarioRef } from "@commerceos/contracts";
import { type ZodType } from "zod";

export type InferenceErrorCode =
  | "INVALID_MOCK_SCENARIO"
  | "INVALID_PROVIDER_CONFIGURATION"
  | "LIVE_PROVIDER_NOT_ACTIVATED"
  | "MALFORMED_OUTPUT"
  | "MOCK_FORBIDDEN_IN_PRODUCTION"
  | "PROVIDER_UNAVAILABLE"
  | "RATE_LIMITED"
  | "TIMEOUT";

export class InferenceProviderError extends Error {
  readonly code: InferenceErrorCode;
  readonly retryable: boolean;

  constructor(code: InferenceErrorCode, message: string, retryable: boolean) {
    super(message);
    this.name = "InferenceProviderError";
    this.code = code;
    this.retryable = retryable;
  }

  toJSON(): { code: InferenceErrorCode; message: string; retryable: boolean } {
    return {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
    };
  }
}

export type InferenceRequest = {
  requestId: string;
  traceId: string;
  scenario: ScenarioRef;
  input: Readonly<Record<string, unknown>>;
};

export type InferenceResult<T> = {
  output: T;
  metadata: Extract<InferenceMetadata, { status: "available" }>;
};

export interface InferenceProvider {
  readonly providerId: string;

  generateStructured<T>(
    request: InferenceRequest,
    outputSchema: ZodType<T>,
    signal?: AbortSignal,
  ): Promise<InferenceResult<T>>;
}

type Fixture =
  | {
      kind: "output";
      value: Readonly<Record<string, unknown>>;
      expectedAssessment?: "supported" | "at_risk" | "indeterminate";
      expectedFindingCodes?: readonly string[];
    }
  | {
      kind: "error";
      code: InferenceErrorCode;
      message: string;
      retryable: boolean;
    };

const fixtures: Readonly<Record<string, Fixture>> = {
  success: {
    kind: "output",
    value: { fixture: "synthetic-foundation-output" },
  },
  "needs-review": {
    kind: "output",
    value: { fixture: "synthetic-foundation-output" },
  },
  timeout: {
    kind: "error",
    code: "TIMEOUT",
    message: "Synthetic inference timeout.",
    retryable: true,
  },
  "rate-limited": {
    kind: "error",
    code: "RATE_LIMITED",
    message: "Synthetic inference rate limit.",
    retryable: true,
  },
  unavailable: {
    kind: "error",
    code: "PROVIDER_UNAVAILABLE",
    message: "Synthetic inference provider unavailable.",
    retryable: true,
  },
  "malformed-output": {
    kind: "output",
    value: { malformed: true },
  },
  "pg-supported": {
    kind: "output",
    expectedAssessment: "supported",
    expectedFindingCodes: [
      "DISPATCH_DEADLINE_OPEN",
      "INVENTORY_SECURED",
      "NO_ACTIVE_BLOCKERS",
      "READY_ESTIMATE_WITHIN_DEADLINE",
    ],
    value: {
      data: {
        operationalSummary:
          "Current evidence supports dispatch readiness; continue operational monitoring.",
        actions: [],
      },
      reasoningSummary:
        "Inventory is secured, no blocker is reported, and readiness is estimated within the deadline.",
      evidenceRefs: ["ev-inventory-001", "ev-estimate-001"],
    },
  },
  "pg-at-risk": {
    kind: "output",
    expectedAssessment: "at_risk",
    expectedFindingCodes: [
      "ACTIVE_BLOCKER_REPORTED",
      "DISPATCH_DEADLINE_OPEN",
      "FULFILLMENT_BLOCKED",
      "INVENTORY_NOT_SECURED",
      "READY_ESTIMATE_AFTER_DEADLINE",
    ],
    value: {
      data: {
        operationalSummary:
          "Current allocation and blocking evidence require immediate operational review.",
        actions: [
          {
            actionCode: "resolve_identified_blocker",
            priority: 1,
            explanation: "Resolve the current inventory-related blocker.",
            evidenceIds: ["ev-blocker-002", "ev-fulfillment-002"],
          },
          {
            actionCode: "verify_inventory_allocation",
            priority: 2,
            explanation:
              "Verify whether inventory can be secured for this fulfillment.",
            evidenceIds: ["ev-inventory-002"],
          },
          {
            actionCode: "reassess_customer_facing_commitment",
            priority: 3,
            explanation:
              "Reassess the dispatch commitment after operational review.",
            evidenceIds: ["ev-commitment-002", "ev-estimate-002"],
          },
          {
            actionCode: "escalate_to_fulfillment_lead",
            priority: 4,
            explanation:
              "Escalate the combined adverse findings for human review.",
            evidenceIds: ["ev-fulfillment-002"],
          },
        ],
      },
      reasoningSummary:
        "Current evidence shows unsecured inventory, an active blocker, and readiness after the commitment deadline.",
      evidenceRefs: [
        "ev-blocker-002",
        "ev-fulfillment-002",
        "ev-inventory-002",
        "ev-commitment-002",
        "ev-estimate-002",
      ],
    },
  },
  "pg-indeterminate": {
    kind: "output",
    expectedAssessment: "indeterminate",
    expectedFindingCodes: [
      "DISPATCH_DEADLINE_OPEN",
      "MISSING_READY_ESTIMATE",
      "UNKNOWN_EVIDENCE_VALIDITY",
      "UNKNOWN_EVIDENCE_VALIDITY",
    ],
    value: {
      data: {
        operationalSummary:
          "Current evidence is insufficient to support the dispatch commitment.",
        actions: [
          {
            actionCode: "verify_inventory_allocation",
            priority: 1,
            explanation: "Obtain a current inventory allocation status.",
            evidenceIds: ["ev-inventory-003"],
          },
          {
            actionCode: "obtain_current_readiness_estimate",
            priority: 2,
            explanation:
              "Obtain a current readiness estimate before relying on the commitment.",
            evidenceIds: ["ev-fulfillment-003"],
          },
          {
            actionCode: "escalate_to_fulfillment_lead",
            priority: 3,
            explanation: "Escalate the evidence gaps for human review.",
            evidenceIds: ["ev-inventory-003", "ev-fulfillment-003"],
          },
        ],
      },
      reasoningSummary:
        "Inventory and blocker states are unknown and no readiness estimate is available.",
      evidenceRefs: ["ev-inventory-003", "ev-fulfillment-003"],
    },
  },
  "pg-malformed-ai": {
    kind: "output",
    value: {
      data: {
        operationalSummary: "This fixture is intentionally invalid.",
        actions: [
          {
            actionCode: "guarantee_dispatch",
            priority: 1,
            explanation: "This action is forbidden.",
            evidenceIds: ["ev-commitment-001"],
          },
        ],
      },
      reasoningSummary: "This output must be rejected.",
      evidenceRefs: ["ev-commitment-001"],
    },
  },
};

export class DeterministicMockProvider implements InferenceProvider {
  readonly providerId = "deterministic-mock";

  async generateStructured<T>(
    request: InferenceRequest,
    outputSchema: ZodType<T>,
    signal?: AbortSignal,
  ): Promise<InferenceResult<T>> {
    if (signal?.aborted) {
      throw new InferenceProviderError(
        "TIMEOUT",
        "Synthetic inference was cancelled.",
        true,
      );
    }

    if (!request.scenario.synthetic) {
      throw new InferenceProviderError(
        "INVALID_MOCK_SCENARIO",
        "Mock inference accepts visibly synthetic scenarios only.",
        false,
      );
    }

    const fixture = fixtures[request.scenario.scenarioId];
    if (!fixture) {
      throw new InferenceProviderError(
        "INVALID_MOCK_SCENARIO",
        "The requested synthetic scenario is not registered.",
        false,
      );
    }

    if (fixture.kind === "error") {
      throw new InferenceProviderError(
        fixture.code,
        fixture.message,
        fixture.retryable,
      );
    }

    if (
      fixture.expectedAssessment &&
      request.input.assessment !== fixture.expectedAssessment
    ) {
      throw new InferenceProviderError(
        "MALFORMED_OUTPUT",
        "The synthetic fixture does not match the deterministic assessment.",
        false,
      );
    }

    if (fixture.expectedFindingCodes) {
      const actualFindingCodes = request.input.findingCodes;
      const expected = [...fixture.expectedFindingCodes].sort();
      const actual = Array.isArray(actualFindingCodes)
        ? actualFindingCodes.filter(
            (findingCode): findingCode is string =>
              typeof findingCode === "string",
          )
        : [];
      if (
        actual.length !== expected.length ||
        actual
          .sort()
          .some((findingCode, index) => findingCode !== expected[index])
      ) {
        throw new InferenceProviderError(
          "MALFORMED_OUTPUT",
          "The synthetic fixture does not match the deterministic findings.",
          false,
        );
      }
    }

    const parsed = outputSchema.safeParse(fixture.value);
    if (!parsed.success) {
      throw new InferenceProviderError(
        "MALFORMED_OUTPUT",
        "Inference output did not match the approved output schema.",
        false,
      );
    }

    return {
      output: parsed.data,
      metadata: {
        status: "available",
        providerId: this.providerId,
        modelId: "fixture-v1",
        adapterVersion: "1.0.0",
        generatedAt: "2026-10-15T00:00:00.000Z",
        durationMs: 0,
        provenance: "synthetic_mock",
      },
    };
  }
}

export type ProviderSelection = {
  provider: "disabled" | "mock" | "amd-token-factory";
  environment: "development" | "test" | "production";
};

export type InferenceEnvironment = {
  INFERENCE_PROVIDER?: string;
  NODE_ENV?: string;
};

export type AmdTokenFactoryBoundary = {
  provider: "amd-token-factory";
  activationStatus: "pending_credentials";
  officialPlatform: "https://notebooks.amd.com/tokenfactory";
};

export const amdTokenFactoryBoundary: AmdTokenFactoryBoundary = {
  provider: "amd-token-factory",
  activationStatus: "pending_credentials",
  officialPlatform: "https://notebooks.amd.com/tokenfactory",
};

export const createInferenceProvider = (
  selection: ProviderSelection,
): InferenceProvider | null => {
  if (selection.provider === "disabled") {
    return null;
  }

  if (selection.provider === "amd-token-factory") {
    throw new InferenceProviderError(
      "LIVE_PROVIDER_NOT_ACTIVATED",
      "AMD Token Factory is not activated in the G2 foundation.",
      false,
    );
  }

  if (selection.environment === "production") {
    throw new InferenceProviderError(
      "MOCK_FORBIDDEN_IN_PRODUCTION",
      "Mock inference is not authorized in production.",
      false,
    );
  }

  return new DeterministicMockProvider();
};

export const initializeInferenceFromEnvironment = (
  environment: InferenceEnvironment,
): InferenceProvider | null => {
  const runtimeEnvironment = environment.NODE_ENV;
  if (
    runtimeEnvironment !== "development" &&
    runtimeEnvironment !== "test" &&
    runtimeEnvironment !== "production"
  ) {
    throw new InferenceProviderError(
      "INVALID_PROVIDER_CONFIGURATION",
      "The runtime environment is not supported.",
      false,
    );
  }

  const provider = environment.INFERENCE_PROVIDER;
  if (
    provider !== "disabled" &&
    provider !== "mock" &&
    provider !== "amd-token-factory"
  ) {
    throw new InferenceProviderError(
      "INVALID_PROVIDER_CONFIGURATION",
      "The inference provider configuration is invalid.",
      false,
    );
  }

  return createInferenceProvider({
    provider,
    environment: runtimeEnvironment,
  });
};
