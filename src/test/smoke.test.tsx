import { render, screen } from "@testing-library/react";
import { describe, expect,it } from "vitest";

describe("Smoke test", () => {
  it("renders a simple div", () => {
    render(<div data-testid="test-div">Hello World</div>);
    expect(screen.getByTestId("test-div")).toBeInTheDocument();
    expect(screen.getByText("Hello World")).toBeInTheDocument();
  });
});
