// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const notFoundMock = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});

vi.mock("next/navigation", () => ({
  notFound: () => notFoundMock(),
}));

import MarginLeakPage from "./page";

describe("MarginLeakPage server-side runtime gate", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    notFoundMock.mockClear();
  });

  it("fails closed on the server via notFound() when NODE_ENV is production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(() => MarginLeakPage()).toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });

  it("renders the synthetic development preview workspace when NODE_ENV is development or test", () => {
    vi.stubEnv("NODE_ENV", "development");
    render(<MarginLeakPage />);
    expect(
      screen.getByText("PLANNED · SYNTHETIC DEVELOPMENT PREVIEW"),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", {
        name: /Contribution-Margin Variance & Leakage Intelligence/i,
      }),
    ).toBeTruthy();
  });
});
