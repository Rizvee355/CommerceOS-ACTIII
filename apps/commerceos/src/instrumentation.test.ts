import { afterEach, describe, expect, it, vi } from "vitest";

import { register } from "./instrumentation";

const setNodeRuntime = (provider: string): void => {
  vi.stubEnv("NEXT_RUNTIME", "nodejs");
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("INFERENCE_PROVIDER", provider);
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Next.js server configuration initialization", () => {
  it("allows production startup with inference explicitly disabled", async () => {
    setNodeRuntime("disabled");

    await expect(register()).resolves.toBeUndefined();
  });

  it("rejects production startup with mock inference", async () => {
    setNodeRuntime("mock");

    await expect(register()).rejects.toMatchObject({
      code: "MOCK_FORBIDDEN_IN_PRODUCTION",
    });
  });

  it("rejects startup with an unknown provider", async () => {
    setNodeRuntime("unknown-provider");

    await expect(register()).rejects.toMatchObject({
      code: "INVALID_PROVIDER_CONFIGURATION",
    });
  });

  it("does not evaluate runtime-only configuration during a production build", async () => {
    setNodeRuntime("mock");
    vi.stubEnv("NEXT_PHASE", "phase-production-build");

    await expect(register()).resolves.toBeUndefined();
  });
});
