import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { Badge } from "./Badge";

const meta = {
  title: "Design System/Badge",
  component: Badge,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Compact status chip. Carries state only — never an action. " +
          "Tones map to the status tokens: success (`200 OK`), warning (token limit), error (`429 Rate Limit`).",
      },
    },
  },
  args: { children: "200 OK", tone: "success", mono: true, dot: true },
  argTypes: {
    tone: { control: "inline-radio", options: ["neutral", "accent", "success", "warning", "error"] },
    mono: { control: "boolean" },
    dot: { control: "boolean" },
    outlined: { control: "boolean" },
  },
  decorators: [
    (Story) => (
      <div className="bg-bg-panel p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Success: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const badge = canvas.getByText("200 OK");
    await expect(badge).toBeVisible();
    await expect(badge.closest("[data-tone]")).toHaveAttribute("data-tone", "success");
  },
};

export const Error: Story = {
  args: { children: "429 Rate Limit", tone: "error", mono: true, dot: true },
};

export const Warning: Story = {
  args: { children: "Token limit 98%", tone: "warning", mono: false, dot: true },
};

export const Accent: Story = {
  args: { children: "Streaming", tone: "accent", mono: false, dot: true },
};

export const Neutral: Story = {
  args: { children: "Draft", tone: "neutral", mono: false, dot: false },
};

export const AllTones: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-2">
      <Badge {...args} tone="neutral">
        Draft
      </Badge>
      <Badge {...args} tone="accent" dot>
        Streaming
      </Badge>
      <Badge {...args} tone="success" mono dot>
        200 OK
      </Badge>
      <Badge {...args} tone="warning" mono dot>
        Tok 98%
      </Badge>
      <Badge {...args} tone="error" mono dot>
        429 Limit
      </Badge>
    </div>
  ),
};

export const Outlined: Story = {
  args: { children: "gpt-4o-mini", tone: "neutral", mono: true, outlined: true },
};
