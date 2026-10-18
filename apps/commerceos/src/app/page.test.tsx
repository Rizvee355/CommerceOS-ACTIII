// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import HomePage from "./page";

describe("CommerceOS overview", () => {
  it("shows truthful foundation states without invented product data", () => {
    render(<HomePage />);

    expect(
      screen.getByRole("heading", {
        name: "Commerce intelligence, one system.",
      }),
    ).toBeInTheDocument();

    const promiseGuard = screen.getByTestId("capability-promiseguard");
    const marginLeak = screen.getByTestId("capability-marginleak");
    const rescueCart = screen.getByTestId("capability-rescuecart");

    expect(within(promiseGuard).getByText("Stub")).toBeInTheDocument();
    expect(within(marginLeak).getByText("Planned")).toBeInTheDocument();
    expect(within(rescueCart).getByText("Disabled")).toBeInTheDocument();
    expect(within(rescueCart).queryByRole("link")).not.toBeInTheDocument();

    expect(screen.getByText("AMD integration verified")).toBeInTheDocument();
    expect(
      screen.getByText(/Public Token Factory access remains disabled/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Synthetic preview available")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Open synthetic workspace/i }),
    ).toHaveAttribute("href", "/promiseguard");
    expect(
      screen.queryByText(/revenue|orders evaluated|margin saved/i),
    ).not.toBeInTheDocument();
  });
});
