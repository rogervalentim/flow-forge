import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { Search, Terminal } from "lucide-react";
import { Input } from "./Input";

const meta = {
  title: "Design System/Input",
  component: Input,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Single-line field: flat dark surface, 1px hairline border, 6px radius. " +
          "Focus raises the border to the accent token. `mono` is used for IDs, model names and numeric telemetry.",
      },
    },
  },
  args: { placeholder: "Search workflows", onChange: fn(), wrapperClassName: "w-[280px]" },
  argTypes: {
    size: { control: "inline-radio", options: ["sm", "md"] },
    invalid: { control: "boolean" },
    mono: { control: "boolean" },
    disabled: { control: "boolean" },
  },
  decorators: [
    (Story) => (
      <div className="bg-bg-panel p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByPlaceholderText("Search workflows");
    await userEvent.type(input, "latency");
    await expect(input).toHaveValue("latency");
    await expect(args.onChange).toHaveBeenCalled();
  },
};

export const WithLabelAndHint: Story = {
  args: {
    label: "Workflow ID",
    hint: "Lowercase, hyphen-separated. Immutable once published.",
    mono: true,
    placeholder: "wf_summarize-transcript",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText("Workflow ID");
    await expect(input).toBeVisible();
    await expect(input).toHaveAccessibleDescription(
      "Lowercase, hyphen-separated. Immutable once published.",
    );
  },
};

export const WithLeadingIcon: Story = {
  args: { leadingIcon: <Search size={14} strokeWidth={1.5} />, placeholder: "Filter nodes" },
};

export const WithTrailingSlot: Story = {
  args: {
    label: "Max tokens",
    mono: true,
    defaultValue: "4096",
    trailingSlot: <span className="font-mono text-[10px] uppercase tracking-[0.06em]">tok</span>,
  },
};

export const Terminal_ = {
  name: "Mono / terminal",
  args: {
    label: "Prompt key",
    mono: true,
    leadingIcon: <Terminal size={14} strokeWidth={1.5} />,
    placeholder: "prompt.system.v3",
  },
} satisfies Story;

export const Invalid: Story = {
  args: {
    label: "Webhook URL",
    hint: "Must start with https://",
    invalid: true,
    defaultValue: "http://internal/hook",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText("Webhook URL");
    await expect(input).toHaveAttribute("aria-invalid", "true");
  },
};

export const Disabled: Story = {
  args: { label: "Model", mono: true, disabled: true, defaultValue: "gpt-4o-mini" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByLabelText("Model")).toBeDisabled();
  },
};

export const Small: Story = {
  args: { size: "sm", placeholder: "sm — h-7", wrapperClassName: "w-[220px]" },
};
