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

    expect(
      screen.getByRole("heading", {
        name: "AMD Token Factory — Integration Verified",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("AMD API")).toBeInTheDocument();
    expect(
      screen.getByText("Verified", { selector: "dd" }),
    ).toBeInTheDocument();
    expect(screen.getByText("PromiseGuard AI Integration")).toBeInTheDocument();
    expect(
      screen.getByText("Verified in controlled testing"),
    ).toBeInTheDocument();
    expect(screen.getByText("Public AI Availability")).toBeInTheDocument();
    expect(
      screen.getByText("Disabled", { selector: "dd" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Public live inference remains disabled/i),
    ).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(
      /AMD connection pending|API access not issued|AMD inference never verified|authentication blocked|awaiting Token Factory authorization/i,
    );
    expect(screen.getByText("Synthetic preview available")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Open synthetic workspace/i }),
    ).toHaveAttribute("href", "/promiseguard");
    expect(
      screen.queryByText(/revenue|orders evaluated|margin saved/i),
    ).not.toBeInTheDocument();
  });
});
