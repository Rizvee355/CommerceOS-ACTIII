import { describe, expect, it } from "vitest";

import { scanText } from "./scan-secrets.mjs";

describe("secret scanner", () => {
  it("detects a synthetic GitHub token without retaining its value", () => {
    const syntheticToken = ["ghp", "A".repeat(36)].join("_");
    const findings = scanText("unsafe.txt", `token=${syntheticToken}`);

    expect(findings).toEqual([{ file: "unsafe.txt", rule: "github-token" }]);
    expect(JSON.stringify(findings)).not.toContain(syntheticToken);
  });

  it("allows empty credential placeholders", () => {
    expect(
      scanText(
        ".env.example",
        "AMD_TOKEN_FACTORY_API_KEY=\nAMD_TOKEN_FACTORY_ENDPOINT=\n",
      ),
    ).toEqual([]);
  });

  it("detects a credential-like AMD assignment", () => {
    const syntheticValue = ["tf", "A".repeat(24)].join("_");
    const findings = scanText(
      ".env.local",
      `AMD_TOKEN_FACTORY_API_KEY=${syntheticValue}`,
    );

    expect(findings).toEqual([
      { file: ".env.local", rule: "amd-token-factory-key-assignment" },
    ]);
    expect(JSON.stringify(findings)).not.toContain(syntheticValue);
  });
});
