import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { Bot, Braces, GitBranch, Webhook } from "lucide-react";
import { NodeCard } from "./NodeCard";

const meta = {
  title: "Design System/NodeCard",
  component: NodeCard,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A single step in the workflow canvas. 6px radius, 1px structural border, flat elevated surface, " +
          "monospace telemetry footer. Selection is a 1px accent border — never a glow or a scale transform.",
      },
    },
  },
  args: {
    kind: "llm.call",
    title: "Summarize transcript",
    subtitle: "gpt-4o-mini · temp 0.2",
    status: "success",
    icon: <Bot size={12} strokeWidth={1.5} />,
    onClick: fn(),
    metrics: [
      { label: "lat", value: "142ms" },
      { label: "tok", value: "1.2k" },
    ],
  },
  argTypes: {
    status: { control: "inline-radio", options: ["idle", "running", "success", "warning", "error"] },
    selected: { control: "boolean" },
    ports: { control: "boolean" },
  },
  decorators: [
    (Story) => (
      <div className="bg-bg-canvas bg-dot-grid p-10">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof NodeCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Success: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Summarize transcript")).toBeVisible();
    await expect(canvas.getByText("200 OK")).toBeVisible();
    await userEvent.click(canvas.getByText("Summarize transcript"));
    await expect(args.onClick).toHaveBeenCalledTimes(1);
  },
};

export const Idle: Story = {
  args: {
    status: "idle",
    kind: "trigger.webhook",
    title: "Inbound webhook",
    subtitle: "POST /v1/runs",
    icon: <Webhook size={12} strokeWidth={1.5} />,
    metrics: [{ label: "req", value: "0" }],
  },
};

export const Running: Story = {
  args: {
    status: "running",
    kind: "agent.step",
    title: "Retrieve context",
    subtitle: "vector · top_k 8",
    icon: <GitBranch size={12} strokeWidth={1.5} />,
    progress: 62,
    metrics: [{ label: "tok", value: "812" }],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("RUNNING")).toBeVisible();
    const card = canvas.getByText("Retrieve context").closest("[data-status]");
    await expect(card).toHaveAttribute("data-status", "running");
  },
};

export const TokenWarning: Story = {
  args: {
    status: "warning",
    kind: "prompt.render",
    title: "Render system prompt",
    subtitle: "system.v3 · 7.9k tok",
    icon: <Braces size={12} strokeWidth={1.5} />,
    metrics: [{ label: "tok", value: "7.9k/8k", tone: "warning" }],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("TOK LIMIT")).toBeVisible();
  },
};

export const RateLimited: Story = {
  args: {
    status: "error",
    kind: "llm.call",
    title: "Classify intent",
    subtitle: "claude-sonnet · retry 2/3",
    metrics: [
      { label: "lat", value: "1.8s", tone: "error" },
      { label: "tok", value: "0" },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("429 LIMIT")).toBeVisible();
  },
};

export const Selected: Story = {
  args: { selected: true, status: "running", progress: 30 },
};

export const CanvasRow: Story = {
  render: (args) => (
    <div className="flex items-center gap-6">
      <NodeCard {...args} status="success" />
      <NodeCard
        {...args}
        kind="agent.step"
        title="Retrieve context"
        subtitle="vector · top_k 8"
        icon={<GitBranch size={12} strokeWidth={1.5} />}
        status="running"
        progress={48}
        metrics={[{ label: "tok", value: "812" }]}
      />
      <NodeCard
        {...args}
        kind="prompt.render"
        title="Render system prompt"
        subtitle="system.v3"
        icon={<Braces size={12} strokeWidth={1.5} />}
        status="warning"
        metrics={[{ label: "tok", value: "7.9k/8k", tone: "warning" }]}
      />
    </div>
  ),
};
