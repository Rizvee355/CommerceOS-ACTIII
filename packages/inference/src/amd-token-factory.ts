import {
  promiseGuardActionCodeSchema,
  promiseGuardFindingSchema,
  type InferenceMetadata,
} from "@commerceos/contracts";
import { z, type ZodType } from "zod";

import {
  InferenceProviderError,
  type InferenceProvider,
  type InferenceRequest,
  type InferenceResult,
} from "./index";

export const AMD_TOKEN_FACTORY_CHAT_COMPLETIONS_URL =
  "https://developer.amd.com.cn/radeon/api/v1/chat/completions";
export const AMD_TOKEN_FACTORY_DEFAULT_MODEL = "DeepSeek-V4-Flash";

const ADAPTER_VERSION = "1.0.0";
const DEFAULT_TIMEOUT_MS = 60_000;

const amdInputSchema = z.strictObject({
  assessment: z.enum(["supported", "at_risk", "indeterminate"]),
  findingCodes: z.array(z.string().trim().min(1).max(128)).min(1).max(32),
  findings: z.array(promiseGuardFindingSchema).min(1).max(32),
  allowedActions: z
    .array(
      z.strictObject({
        actionCode: promiseGuardActionCodeSchema,
        evidenceIds: z.array(z.string().trim().min(1).max(128)).min(1).max(8),
      }),
    )
    .max(5),
});

const upstreamResponseSchema = z.object({
  id: z.string().optional(),
  model: z.string().trim().min(1).max(128),
  choices: z
    .array(
      z.object({
        finish_reason: z.string().nullable().optional(),
        message: z.object({ content: z.string().trim().min(1) }),
      }),
    )
    .min(1),
});

const apiKeyPattern = /^rc-[0-9A-Fa-f]{48}$/;
const modelPattern = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,127}$/;

type FetchImplementation = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export type AmdTokenFactoryProviderOptions = {
  apiKey: string;
  fetch?: FetchImplementation;
  model?: string;
  monotonicNow?: () => number;
  now?: () => Date;
  timeoutMs?: number;
};

const SYSTEM_PROMPT = `You are the advisory explanation layer for CommerceOS PromiseGuard.
The deterministic evaluation in the user message is authoritative. Never change, recompute, or contradict its assessment.
Use only the supplied synthetic findings, evidence identifiers, and allowedActions.
Return one JSON object only, without Markdown, with this exact shape:
{"data":{"operationalSummary":"string","actions":[{"actionCode":"allowed action code","priority":1,"explanation":"string","evidenceIds":["allowed evidence id"]}]},"reasoningSummary":"string","evidenceRefs":["supplied evidence id"]}
Use an empty actions array when no action is needed. If actions are returned, use only allowedActions, keep priorities consecutive from 1, and copy only the evidence IDs allowed for that action.
Do not promise delivery, invent evidence, expose hidden reasoning, or make financial calculations.`;

const providerFailure = (
  status: number,
): {
  code:
    "INVALID_PROVIDER_CONFIGURATION" | "PROVIDER_UNAVAILABLE" | "RATE_LIMITED";
  message: string;
  retryable: boolean;
} => {
  if (status === 429) {
    return {
      code: "RATE_LIMITED",
      message: "AMD Token Factory rate limit was reached.",
      retryable: true,
    };
  }
  if (status === 400 || status === 401 || status === 403) {
    return {
      code: "INVALID_PROVIDER_CONFIGURATION",
      message: "AMD Token Factory rejected the provider configuration.",
      retryable: false,
    };
  }
  return {
    code: "PROVIDER_UNAVAILABLE",
    message: "AMD Token Factory is unavailable.",
    retryable: status >= 500,
  };
};

export class AmdTokenFactoryProvider implements InferenceProvider {
  readonly providerId = "amd-token-factory";

  readonly #apiKey: string;
  readonly #fetch: FetchImplementation;
  readonly #model: string;
  readonly #monotonicNow: () => number;
  readonly #now: () => Date;
  readonly #timeoutMs: number;

  constructor(options: AmdTokenFactoryProviderOptions) {
    if (!apiKeyPattern.test(options.apiKey)) {
      throw new InferenceProviderError(
        "LIVE_PROVIDER_NOT_ACTIVATED",
        "AMD Token Factory requires a valid server-side credential.",
        false,
      );
    }
    const model = options.model ?? AMD_TOKEN_FACTORY_DEFAULT_MODEL;
    if (!modelPattern.test(model)) {
      throw new InferenceProviderError(
        "INVALID_PROVIDER_CONFIGURATION",
        "The AMD Token Factory model configuration is invalid.",
        false,
      );
    }
    if (
      options.timeoutMs !== undefined &&
      (!Number.isSafeInteger(options.timeoutMs) || options.timeoutMs < 1_000)
    ) {
      throw new InferenceProviderError(
        "INVALID_PROVIDER_CONFIGURATION",
        "The AMD Token Factory timeout configuration is invalid.",
        false,
      );
    }

    this.#apiKey = options.apiKey;
    this.#fetch = options.fetch ?? fetch;
    this.#model = model;
    this.#monotonicNow =
      options.monotonicNow ?? performance.now.bind(performance);
    this.#now = options.now ?? (() => new Date());
    this.#timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async generateStructured<T>(
    request: InferenceRequest,
    outputSchema: ZodType<T>,
    signal?: AbortSignal,
  ): Promise<InferenceResult<T>> {
    if (!request.scenario.synthetic) {
      throw new InferenceProviderError(
        "INVALID_PROVIDER_CONFIGURATION",
        "AMD Token Factory accepts CommerceOS synthetic demonstrations only.",
        false,
      );
    }

    const input = amdInputSchema.safeParse(request.input);
    if (!input.success) {
      throw new InferenceProviderError(
        "INVALID_PROVIDER_CONFIGURATION",
        "AMD Token Factory received an unsupported advisory input.",
        false,
      );
    }
    if (signal?.aborted) {
      throw new InferenceProviderError(
        "TIMEOUT",
        "AMD Token Factory request was cancelled.",
        true,
      );
    }

    const startedAt = this.#monotonicNow();
    const timeoutController = new AbortController();
    const timeout = setTimeout(
      () => timeoutController.abort(),
      this.#timeoutMs,
    );
    const abortFromCaller = () => timeoutController.abort();
    signal?.addEventListener("abort", abortFromCaller, { once: true });

    let response: Response;
    try {
      response = await this.#fetch(AMD_TOKEN_FACTORY_CHAT_COMPLETIONS_URL, {
        method: "POST",
        headers: {
          accept: "application/json",
          authorization: `Bearer ${this.#apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: this.#model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "user",
              content: JSON.stringify({
                purpose: "promiseguard_advisory_explanation",
                ...input.data,
              }),
            },
          ],
          max_tokens: 600,
          temperature: 0.1,
          stream: false,
        }),
        cache: "no-store",
        signal: timeoutController.signal,
      });
    } catch {
      if (timeoutController.signal.aborted || signal?.aborted) {
        throw new InferenceProviderError(
          "TIMEOUT",
          "AMD Token Factory request timed out.",
          true,
        );
      }
      throw new InferenceProviderError(
        "PROVIDER_UNAVAILABLE",
        "AMD Token Factory is unavailable.",
        true,
      );
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abortFromCaller);
    }

    if (!response.ok) {
      const normalized = providerFailure(response.status);
      throw new InferenceProviderError(
        normalized.code,
        normalized.message,
        normalized.retryable,
      );
    }

    let upstream: z.infer<typeof upstreamResponseSchema>;
    try {
      upstream = upstreamResponseSchema.parse(await response.json());
    } catch {
      throw new InferenceProviderError(
        "MALFORMED_OUTPUT",
        "AMD Token Factory returned an invalid response envelope.",
        false,
      );
    }

    const firstChoice = upstream.choices[0];
    if (!firstChoice || firstChoice.finish_reason === "length") {
      throw new InferenceProviderError(
        "MALFORMED_OUTPUT",
        "AMD Token Factory returned an incomplete response.",
        false,
      );
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(firstChoice.message.content);
    } catch {
      throw new InferenceProviderError(
        "MALFORMED_OUTPUT",
        "AMD Token Factory returned malformed structured output.",
        false,
      );
    }
    const output = outputSchema.safeParse(parsedJson);
    if (!output.success) {
      throw new InferenceProviderError(
        "MALFORMED_OUTPUT",
        "AMD Token Factory output did not match the approved schema.",
        false,
      );
    }

    const metadata: Extract<InferenceMetadata, { status: "available" }> = {
      status: "available",
      providerId: this.providerId,
      modelId: upstream.model,
      adapterVersion: ADAPTER_VERSION,
      generatedAt: this.#now().toISOString(),
      durationMs: Math.max(0, Math.round(this.#monotonicNow() - startedAt)),
      provenance: "live",
    };
    return { output: output.data, metadata };
  }
}
