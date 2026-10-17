import { z } from "zod";

const utcTimestampSchema = z
  .string()
  .datetime({ offset: false })
  .describe("RFC 3339 UTC timestamp");

export const promiseGuardOpaqueIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);

const syntheticEvidenceShape = {
  evidenceId: promiseGuardOpaqueIdSchema,
  origin: z.literal("synthetic_fixture"),
  observedAt: utcTimestampSchema,
  validUntil: utcTimestampSchema.nullable(),
};

export const dispatchCommitmentSchema = z.strictObject({
  evidenceId: promiseGuardOpaqueIdSchema,
  kind: z.literal("dispatch_by"),
  dispatchBy: utcTimestampSchema,
});

export const inventoryAllocationEvidenceSchema = z.strictObject({
  ...syntheticEvidenceShape,
  status: z.enum(["secured", "not_secured", "unknown"]),
});

export const fulfillmentStateEvidenceSchema = z.strictObject({
  ...syntheticEvidenceShape,
  state: z.enum(["not_started", "in_progress", "ready", "blocked", "unknown"]),
});

export const promiseGuardBlockerCodeSchema = z.enum([
  "inventory_shortage",
  "fulfillment_hold",
  "capacity_constraint",
  "cutoff_missed",
  "other_operational_blocker",
]);

export const blockingStateEvidenceSchema = z
  .strictObject({
    ...syntheticEvidenceShape,
    status: z.enum(["none_known", "active", "unknown"]),
    codes: z.array(promiseGuardBlockerCodeSchema).max(8),
  })
  .superRefine((value, context) => {
    if (value.status === "active" && value.codes.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["codes"],
        message: "Active blocking evidence requires an allowlisted code.",
      });
    }
    if (value.status !== "active" && value.codes.length > 0) {
      context.addIssue({
        code: "custom",
        path: ["codes"],
        message: "Only active blocking evidence may contain blocker codes.",
      });
    }
  });

export const readyTimeEstimateEvidenceSchema = z.strictObject({
  ...syntheticEvidenceShape,
  estimatedReadyAt: utcTimestampSchema,
});

export const promiseGuardOperationalEvidenceSchema = z.strictObject({
  inventoryAllocation: inventoryAllocationEvidenceSchema,
  fulfillmentState: fulfillmentStateEvidenceSchema,
  blockingState: blockingStateEvidenceSchema,
  readyTimeEstimate: readyTimeEstimateEvidenceSchema.optional(),
});

export const promiseGuardAssessmentSchema = z.enum([
  "supported",
  "at_risk",
  "indeterminate",
]);

export const promiseGuardFindingCodeSchema = z.enum([
  "DISPATCH_DEADLINE_OPEN",
  "DISPATCH_DEADLINE_ELAPSED",
  "INVENTORY_SECURED",
  "INVENTORY_NOT_SECURED",
  "UNKNOWN_INVENTORY_STATE",
  "FULFILLMENT_READY",
  "FULFILLMENT_BLOCKED",
  "UNKNOWN_FULFILLMENT_STATE",
  "NO_ACTIVE_BLOCKERS",
  "ACTIVE_BLOCKER_REPORTED",
  "UNKNOWN_BLOCKER_STATE",
  "READY_ESTIMATE_WITHIN_DEADLINE",
  "READY_ESTIMATE_AFTER_DEADLINE",
  "READY_ESTIMATE_ELAPSED",
  "READY_ESTIMATE_IGNORED_AFTER_READY",
  "MISSING_READY_ESTIMATE",
  "EXPIRED_EVIDENCE",
  "UNKNOWN_EVIDENCE_VALIDITY",
  "FUTURE_DATED_EVIDENCE",
  "CONTRADICTORY_OPERATIONAL_STATE",
]);

const evidenceTraceSchema = z.strictObject({
  kind: z.literal("evidence"),
  evidenceIds: z.array(promiseGuardOpaqueIdSchema).min(1).max(8),
});

const fieldPathTraceSchema = z.strictObject({
  kind: z.literal("field_path"),
  fieldPaths: z.array(z.string().startsWith("/").max(512)).min(1).max(8),
});

export const promiseGuardFindingSchema = z.strictObject({
  code: promiseGuardFindingCodeSchema,
  impact: z.enum(["supporting", "adverse", "uncertain"]),
  trace: z.discriminatedUnion("kind", [
    evidenceTraceSchema,
    fieldPathTraceSchema,
  ]),
});

export const promiseGuardDeterministicDataSchema = z.strictObject({
  assessment: promiseGuardAssessmentSchema,
  decisionScope: z.literal("dispatch_readiness_not_delivery_guarantee"),
  evidenceCompleteness: z.enum(["complete", "incomplete", "conflicted"]),
  findings: z.array(promiseGuardFindingSchema).min(1).max(32),
  derived: z.strictObject({
    deadlineState: z.enum(["open", "elapsed"]),
    readyByDeadline: z.boolean().nullable(),
  }),
});

export const promiseGuardActionCodeSchema = z.enum([
  "verify_inventory_allocation",
  "obtain_current_readiness_estimate",
  "resolve_identified_blocker",
  "escalate_to_fulfillment_lead",
  "reassess_customer_facing_commitment",
]);

export const promiseGuardMitigationActionSchema = z.strictObject({
  actionCode: promiseGuardActionCodeSchema,
  priority: z.number().int().min(1).max(5),
  explanation: z.string().trim().min(1).max(280),
  evidenceIds: z.array(promiseGuardOpaqueIdSchema).min(1).max(8),
});

export const promiseGuardAiDataSchema = z
  .strictObject({
    operationalSummary: z.string().trim().min(1).max(500),
    actions: z.array(promiseGuardMitigationActionSchema).max(5),
  })
  .superRefine((value, context) => {
    const codes = new Set<string>();
    value.actions.forEach((action, index) => {
      if (action.priority !== index + 1) {
        context.addIssue({
          code: "custom",
          path: ["actions", index, "priority"],
          message: "Mitigation priorities must be unique and consecutive.",
        });
      }
      if (codes.has(action.actionCode)) {
        context.addIssue({
          code: "custom",
          path: ["actions", index, "actionCode"],
          message: "Mitigation action codes must be unique.",
        });
      }
      codes.add(action.actionCode);
    });
  });

export type DispatchCommitment = z.infer<typeof dispatchCommitmentSchema>;
export type InventoryAllocationEvidence = z.infer<
  typeof inventoryAllocationEvidenceSchema
>;
export type FulfillmentStateEvidence = z.infer<
  typeof fulfillmentStateEvidenceSchema
>;
export type BlockingStateEvidence = z.infer<typeof blockingStateEvidenceSchema>;
export type ReadyTimeEstimateEvidence = z.infer<
  typeof readyTimeEstimateEvidenceSchema
>;
export type PromiseGuardOperationalEvidence = z.infer<
  typeof promiseGuardOperationalEvidenceSchema
>;
export type PromiseGuardAssessment = z.infer<
  typeof promiseGuardAssessmentSchema
>;
export type PromiseGuardFinding = z.infer<typeof promiseGuardFindingSchema>;
export type PromiseGuardDeterministicData = z.infer<
  typeof promiseGuardDeterministicDataSchema
>;
export type PromiseGuardActionCode = z.infer<
  typeof promiseGuardActionCodeSchema
>;
export type PromiseGuardAiData = z.infer<typeof promiseGuardAiDataSchema>;
