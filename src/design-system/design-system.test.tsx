import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "./components/Button/Button";
import { Badge } from "./components/Badge/Badge";
import { Input } from "./components/Input/Input";
import { NodeCard } from "./components/NodeCard/NodeCard";
import { cn } from "./utils/cn";

describe("cn", () => {
  it("drops falsy values and joins the rest", () => {
    expect(cn("a", false, null, undefined, "b")).toBe("a b");
  });
});

describe("Button", () => {
  it("defaults to a secondary, medium button", () => {
    render(<Button>Run</Button>);
    const button = screen.getByRole("button", { name: "Run" });
    expect(button).toHaveAttribute("data-variant", "secondary");
    expect(button).toHaveAttribute("data-size", "md");
    expect(button).toHaveAttribute("type", "button");
  });

  it("is disabled and busy while loading", () => {
    render(<Button loading>Saving</Button>);
    const button = screen.getByRole("button", { name: "Saving" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });
});

describe("Badge", () => {
  it("exposes its semantic tone", () => {
    render(<Badge tone="error">429 Rate Limit</Badge>);
    expect(screen.getByText("429 Rate Limit")).toHaveAttribute("data-tone", "error");
  });
});

describe("Input", () => {
  it("links label and hint to the control", () => {
    render(<Input label="Model" hint="Read only in prod" defaultValue="gpt-4o-mini" />);
    const input = screen.getByLabelText("Model");
    expect(input).toHaveValue("gpt-4o-mini");
    expect(input).toHaveAccessibleDescription("Read only in prod");
  });

  it("marks the field invalid for assistive tech", () => {
    render(<Input label="Webhook" invalid />);
    expect(screen.getByLabelText("Webhook")).toHaveAttribute("aria-invalid", "true");
  });
});

describe("NodeCard", () => {
  it("renders telemetry and status", () => {
    render(
      <NodeCard
        kind="llm.call"
        title="Summarize transcript"
        status="success"
        metrics={[{ label: "lat", value: "142ms" }]}
      />,
    );
    expect(screen.getByText("Summarize transcript")).toBeInTheDocument();
    expect(screen.getByText("200 OK")).toBeInTheDocument();
    expect(screen.getByText("142ms")).toBeInTheDocument();
  });

  it("marks the selected node", () => {
    render(<NodeCard kind="llm.call" title="Selected" selected />);
    expect(screen.getByText("Selected").closest("[data-selected]")).toHaveAttribute(
      "data-selected",
      "true",
    );
  });
});
