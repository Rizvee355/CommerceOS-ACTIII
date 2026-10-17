import {
  promiseGuardEvaluationRequestSchema,
  type PromiseGuardEvaluationRequest,
} from "@commerceos/contracts";

export type PromiseGuardPresetId = "supported" | "at_risk" | "indeterminate";

const atMinutes = (asOf: Date, minutes: number): string =>
  new Date(asOf.getTime() + minutes * 60_000).toISOString();

export const createPromiseGuardPreset = (
  presetId: PromiseGuardPresetId,
  asOf: Date,
): PromiseGuardEvaluationRequest => {
  const sequence =
    presetId === "supported" ? "001" : presetId === "at_risk" ? "002" : "003";
  const shared = {
    schemaVersion: "1.0" as const,
    moduleId: "promiseguard" as const,
    scenario: {
      scenarioId: `pg-${presetId.replace("_", "-")}`,
      synthetic: true,
    },
    fulfillmentRef: `FUL-SYN-${sequence}`,
    commitment: {
      evidenceId: `ev-commitment-${sequence}`,
      kind: "dispatch_by" as const,
      dispatchBy: atMinutes(asOf, presetId === "at_risk" ? 300 : 360),
    },
  };

  const request =
    presetId === "indeterminate"
      ? {
          ...shared,
          operationalEvidence: {
            inventoryAllocation: {
              evidenceId: `ev-inventory-${sequence}`,
              origin: "synthetic_fixture",
              observedAt: atMinutes(asOf, -30),
              validUntil: null,
              status: "unknown",
            },
            fulfillmentState: {
              evidenceId: `ev-fulfillment-${sequence}`,
              origin: "synthetic_fixture",
              observedAt: atMinutes(asOf, -25),
              validUntil: atMinutes(asOf, 390),
              state: "in_progress",
            },
            blockingState: {
              evidenceId: `ev-blocker-${sequence}`,
              origin: "synthetic_fixture",
              observedAt: atMinutes(asOf, -20),
              validUntil: null,
              status: "unknown",
              codes: [],
            },
          },
        }
      : {
          ...shared,
          operationalEvidence: {
            inventoryAllocation: {
              evidenceId: `ev-inventory-${sequence}`,
              origin: "synthetic_fixture",
              observedAt: atMinutes(asOf, -30),
              validUntil: atMinutes(asOf, 390),
              status: presetId === "supported" ? "secured" : "not_secured",
            },
            fulfillmentState: {
              evidenceId: `ev-fulfillment-${sequence}`,
              origin: "synthetic_fixture",
              observedAt: atMinutes(asOf, -25),
              validUntil: atMinutes(asOf, 390),
              state: presetId === "supported" ? "in_progress" : "blocked",
            },
            blockingState: {
              evidenceId: `ev-blocker-${sequence}`,
              origin: "synthetic_fixture",
              observedAt: atMinutes(asOf, -20),
              validUntil: atMinutes(asOf, 390),
              status: presetId === "supported" ? "none_known" : "active",
              codes: presetId === "supported" ? [] : ["inventory_shortage"],
            },
            readyTimeEstimate: {
              evidenceId: `ev-estimate-${sequence}`,
              origin: "synthetic_fixture",
              observedAt: atMinutes(asOf, -15),
              validUntil: atMinutes(asOf, 240),
              estimatedReadyAt: atMinutes(
                asOf,
                presetId === "supported" ? 210 : 480,
              ),
            },
          },
        };

  return promiseGuardEvaluationRequestSchema.parse(request);
};
