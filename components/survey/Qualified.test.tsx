// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { Qualified } from "./Qualified";

afterEach(cleanup);

describe("Qualified — restart survey control", () => {
  it("does not render a restart control when onRestart is not provided", () => {
    render(<Qualified segment="bmw_customer" />);
    expect(
      screen.queryByRole("button", { name: /restart survey/i }),
    ).not.toBeInTheDocument();
  });

  it("renders a restart control when onRestart is provided", () => {
    render(<Qualified segment="bmw_customer" onRestart={() => {}} />);
    expect(
      screen.getByRole("button", { name: /restart survey/i }),
    ).toBeInTheDocument();
  });

  it("calls onRestart when the restart control is clicked", async () => {
    const onRestart = vi.fn();
    render(<Qualified segment="bmw_customer" onRestart={onRestart} />);
    fireEvent.click(screen.getByRole("button", { name: /restart survey/i }));
    expect(onRestart).toHaveBeenCalledTimes(1);
  });

  it("disables the restart control and shows a pending label while restarting", () => {
    render(
      <Qualified segment="bmw_customer" onRestart={() => {}} restarting />,
    );
    const button = screen.getByRole("button", { name: /restarting/i });
    expect(button).toBeDisabled();
  });
});
