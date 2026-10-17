import {
  capabilitiesResponseSchema,
  healthResponseSchema,
} from "@commerceos/contracts";
import { describe, expect, it } from "vitest";

import { GET as getCapabilities } from "../../app/api/v1/capabilities/route";
import { GET as getHealth } from "../../app/api/v1/health/route";

describe("approved skeleton routes", () => {
  it("returns a validated health response", async () => {
    const response = await getHealth();
    expect(response.status).toBe(200);
    expect(healthResponseSchema.safeParse(await response.json()).success).toBe(
      true,
    );
  });

  it("returns validated truthful capabilities", async () => {
    const response = await getCapabilities();
    expect(response.status).toBe(200);
    expect(
      capabilitiesResponseSchema.safeParse(await response.json()).success,
    ).toBe(true);
  });
});
