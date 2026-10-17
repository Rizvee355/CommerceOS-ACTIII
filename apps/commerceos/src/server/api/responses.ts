import {
  capabilitiesResponseSchema,
  errorEnvelopeSchema,
  healthResponseSchema,
  SCHEMA_VERSION,
  type CapabilitiesResponse,
  type ErrorEnvelope,
  type HealthResponse,
} from "@commerceos/contracts";
import { randomUUID } from "node:crypto";

import { moduleRegistry } from "../../features/module-registry";

export type ServerContextFactory = {
  now: () => Date;
  randomUUID: () => string;
};

const defaultContextFactory: ServerContextFactory = {
  now: () => new Date(),
  randomUUID,
};

const createApiMetadata = (factory: ServerContextFactory) => ({
  schemaVersion: SCHEMA_VERSION,
  requestId: factory.randomUUID(),
  traceId: factory.randomUUID(),
  timestamp: factory.now().toISOString(),
});

export const createHealthResponse = (
  factory: ServerContextFactory = defaultContextFactory,
): HealthResponse =>
  healthResponseSchema.parse({
    ...createApiMetadata(factory),
    status: "ok",
    service: "commerceos",
    version: "0.1.0",
  });

export const createCapabilitiesResponse = (
  factory: ServerContextFactory = defaultContextFactory,
): CapabilitiesResponse =>
  capabilitiesResponseSchema.parse({
    ...createApiMetadata(factory),
    capabilities: moduleRegistry,
  });

export const createApiErrorResponse = (
  error: ErrorEnvelope["error"],
  factory: ServerContextFactory = defaultContextFactory,
): ErrorEnvelope =>
  errorEnvelopeSchema.parse({
    ...createApiMetadata(factory),
    error,
  });

export const createErrorResponse = (
  _error: unknown,
  factory: ServerContextFactory = defaultContextFactory,
): ErrorEnvelope =>
  createApiErrorResponse(
    {
      code: "INTERNAL_ERROR",
      category: "internal",
      message: "The request could not be completed.",
      retryable: false,
    },
    factory,
  );
